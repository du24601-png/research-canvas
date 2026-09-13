import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ProgressBar,
  Spinner,
  Text,
  makeStyles,
  mergeClasses,
} from '@fluentui/react-components'
import {
  ArrowDownloadRegular,
  CheckmarkCircleRegular,
  DismissRegular,
} from '@fluentui/react-icons'
import { getConfig, news, type PublicProvider } from '../../api/client'
import type { NewsSettings, NewsTranslationSettings } from '../../types/schemas'
import OpptrixButton from '../../components/opptrix/OpptrixButton'
import OpptrixSelect, { OpptrixOption } from '../../components/opptrix/OpptrixSelect'
import {
  SettingsAddBar,
  SettingsGroup,
  SettingsHint,
  SettingsListPanel,
  SettingsListRow,
  SettingsListScroll,
  SettingsRow,
  SettingsSectionLabel,
  SettingsStaticBlock,
} from './SettingsPrimitives'
import SettingsRemoteModelSelector from './SettingsRemoteModelSelector'
import TranslationOfflinePanel from './TranslationOfflinePanel'
import { useSettingsToast } from './SettingsToast'
import { useDebouncedEffect } from '../../hooks/useDebouncedEffect'
import { opptrixCssVars } from '../../theme/tokens'
import { ghostInteractive } from '../../theme/mixins'
import {
  isElectron,
  type TranslationDownloadProgress,
  type TranslationEngineStatus,
  type TranslationModelsResult,
} from '../../platform/detect'

const SETTINGS_SAVE_MS = 500

const useStyles = makeStyles({
  sectionBlock: {
    marginTop: '20px',
  },
  emptyHint: {
    fontSize: 'var(--opptrix-font-base)',
    color: opptrixCssVars.textSecondary,
    lineHeight: 1.55,
  },
  saveHint: {
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
    padding: '4px 2px 0',
    minHeight: '16px',
  },
  saveHintActive: {
    color: opptrixCssVars.textSecondary,
  },
  intervalSelect: {
    minWidth: '160px',
  },
  remoteModelControl: {
    display: 'flex',
    justifyContent: 'flex-end',
    minWidth: '140px',
    maxWidth: '240px',
  },
})

type SaveState = 'idle' | 'pending' | 'saved' | 'error'

const DEFAULT_ENRICHMENT: NewsSettings['enrichment'] = {
  enabled: false,
  processing_mode: 'on_demand',
  extract_images: true,
  extract_audio: true,
  extract_video: true,
  service_mode: 'remote',
  offline_vision_model: '__auto__',
  offline_whisper_model: 'q8',
  remote_provider_id: null,
  remote_model: null,
}

const DEFAULT_TRANSLATION: NewsTranslationSettings = {
  service_mode: 'remote',
  offline_model: '__auto__',
  remote_provider_id: null,
  remote_model: null,
}

export default function TranslationSettingsSection() {
  const s = useStyles()
  const toast = useSettingsToast()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<NewsSettings>({
    refresh_interval_min: 15,
    retention_years: 3,
    max_articles: null,
    translation: DEFAULT_TRANSLATION,
    enrichment: DEFAULT_ENRICHMENT,
  })
  const [providers, setProviders] = useState<PublicProvider[]>([])
  const [status, setStatus] = useState<TranslationEngineStatus | null>(null)
  const [models, setModels] = useState<TranslationModelsResult | null>(null)
  const [download, setDownload] = useState<TranslationDownloadProgress | null>(null)
  const [downloadDir, setDownloadDir] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const skipSettingsSave = useRef(true)
  const settingsBaseline = useRef<NewsTranslationSettings | null>(null)

  const applyEngineState = useCallback((
    nextStatus: TranslationEngineStatus | null,
    nextModels: TranslationModelsResult | null,
    dir?: string | null,
  ) => {
    if (nextStatus) {
      setStatus(nextStatus)
      if (nextStatus.download) setDownload(nextStatus.download)
      else if (!nextStatus.downloading) setDownload(null)
    }
    if (nextModels) setModels(nextModels)
    const resolvedDir = dir
      ?? nextModels?.downloadDirLabel
      ?? nextModels?.downloadDir
      ?? nextStatus?.downloadDirLabel
      ?? nextStatus?.downloadDir
      ?? null
    if (resolvedDir) setDownloadDir(resolvedDir)
  }, [])

  const refreshEngine = useCallback(async () => {
    try {
      const [nextStatus, nextModels] = await Promise.all([
        news.getTranslationStatus(),
        news.getTranslationModels(),
      ])
      applyEngineState(nextStatus, nextModels)
      return
    } catch {
      // HTTP 不可达时再试桌面壳兜底
    }
    if (!window.electronAPI?.translationGetStatus) return
    const [nextStatus, nextModels, dir] = await Promise.all([
      window.electronAPI.translationGetStatus(),
      window.electronAPI.translationGetModels?.() ?? Promise.resolve(null),
      window.electronAPI.translationGetDownloadDir?.() ?? Promise.resolve(null),
    ])
    applyEngineState(nextStatus, nextModels, dir)
  }, [applyEngineState])

  const handleOpenDownloadDir = useCallback(async () => {
    if (!window.electronAPI?.translationOpenDownloadDir) return
    try {
      const dir = await window.electronAPI.translationOpenDownloadDir()
      setDownloadDir(dir)
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : '无法打开目录')
    }
  }, [toast])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [st, cfg] = await Promise.all([
        news.getSettings(),
        getConfig().catch(() => null),
      ])
      setSettings(st.settings)
      settingsBaseline.current = st.settings.translation
      skipSettingsSave.current = true
      setProviders(cfg?.providers ?? [])
      await refreshEngine()
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [refreshEngine, toast])

  useEffect(() => { void load() }, [load])

  // 下载中：轮询 status 端点（HTTP 主路径）；完成后提示
  const downloadTerminalRef = useRef<string | null>(null)
  useEffect(() => {
    if (download?.status !== 'downloading') {
      if (download?.status === 'completed' && downloadTerminalRef.current !== 'completed') {
        downloadTerminalRef.current = 'completed'
        toast.showSuccess('离线翻译模型已下载完成')
        void refreshEngine()
      } else if (download?.status === 'error' && downloadTerminalRef.current !== 'error') {
        downloadTerminalRef.current = 'error'
        toast.showError(download.error ?? '模型下载失败')
      }
      return
    }
    downloadTerminalRef.current = 'downloading'
    const timer = window.setInterval(() => {
      void refreshEngine()
    }, 1000)
    return () => window.clearInterval(timer)
  }, [download, refreshEngine, toast])

  useDebouncedEffect(() => {
    if (loading || skipSettingsSave.current) {
      skipSettingsSave.current = false
      return
    }
    const baseline = settingsBaseline.current
    if (!baseline) return
    const next = settings.translation
    if (
      baseline.service_mode === next.service_mode
      && baseline.offline_model === next.offline_model
      && baseline.remote_provider_id === next.remote_provider_id
      && baseline.remote_model === next.remote_model
    ) return

    setSaveState('pending')
    news.saveSettings({ translation: next })
      .then(resp => {
        setSettings(resp.settings)
        settingsBaseline.current = resp.settings.translation
        setSaveState('saved')
        toast.showSuccess('已保存')
        void refreshEngine()
        window.setTimeout(() => setSaveState('idle'), 2000)
      })
      .catch((e: unknown) => {
        setSaveState('error')
        toast.showError(e instanceof Error ? e.message : '保存失败')
        window.setTimeout(() => setSaveState('idle'), 2000)
      })
  }, [
    settings.translation.service_mode,
    settings.translation.offline_model,
    settings.translation.remote_provider_id,
    settings.translation.remote_model,
    loading,
  ], SETTINGS_SAVE_MS)

  const selectedProvider = providers.find(p => p.id === settings.translation.remote_provider_id) ?? null
  const isTranslationModelFilename = (filename: string) => /hy[-_]?mt/i.test(filename) && !/smolvlm/i.test(filename)
  const offlineOptions = [
    { value: '__auto__', label: '自动匹配 HY-MT' },
    ...(models?.installed ?? [])
      .filter(item => isTranslationModelFilename(item.filename))
      .map(item => ({
        value: item.filename,
        label: item.filename,
      })),
  ]

  const handleDownload = async (modelId: string) => {
    try {
      downloadTerminalRef.current = null
      let ack: {
        started: boolean
        download: TranslationDownloadProgress | null
        alreadyPresent?: boolean
      } | null = null
      try {
        ack = await news.startTranslationDownload(modelId)
      } catch {
        ack = await window.electronAPI?.translationStartDownload?.(modelId) ?? null
      }
      if (!ack) {
        toast.showError('无法开始下载，请确认服务已启动')
        return
      }
      if (ack.download) setDownload(ack.download)
      if (ack.alreadyPresent) {
        await refreshEngine()
        return
      }
      // 进度由 status 轮询 effect 驱动
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : '下载失败')
    }
  }

  const handleCancelDownload = async () => {
    try {
      try {
        await news.cancelTranslationDownload()
      } catch {
        await window.electronAPI?.translationCancelDownload?.()
      }
      await refreshEngine()
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : '取消失败')
    }
  }

  const saveHintText = (() => {
    switch (saveState) {
      case 'pending': return '保存中…'
      case 'saved': return '已保存'
      case 'error': return '保存失败，请重试'
      default: return ''
    }
  })()

  const engineHint = (() => {
    if (settings.translation.service_mode === 'remote') {
      return status?.remoteConfigured
        ? '将始终使用远程大模型翻译。'
        : '请先在下方选择用于翻译的远程模型。'
    }
    if (status?.ready) {
      return `当前使用本机服务端模型：${status.modelName ?? '已加载'}`
    }
    if (status?.localAvailable) {
      return '已找到本机服务端模型，首次翻译时将自动加载（约十几秒）。'
    }
    if (status?.remoteConfigured) {
      return '本机服务端模型尚未就绪，翻译时将自动使用远程大模型。'
    }
    return '请下载离线模型，或在下方配置远程翻译作为回退。'
  })()

  if (loading) return <Spinner size="tiny" label="加载翻译设置…" />

  return (
    <>
      <SettingsHint>{engineHint}</SettingsHint>

      <div className={s.sectionBlock}>
        <SettingsSectionLabel spaced>翻译服务</SettingsSectionLabel>
        <SettingsGroup>
          <SettingsRow
            title="服务类型"
            desc="离线优先时，本机服务端模型可用则用本机；否则回退到远程大模型"
            control={(
              <OpptrixSelect
                className={s.intervalSelect}
                size="small"
                selectedOptions={[settings.translation.service_mode]}
                onOptionSelect={(_, d) => {
                  const mode = d.optionValue === 'remote' ? 'remote' : 'offline'
                  setSettings(prev => ({
                    ...prev,
                    translation: { ...prev.translation, service_mode: mode },
                  }))
                }}
              >
                <OpptrixOption value="offline">离线翻译（优先）</OpptrixOption>
                <OpptrixOption value="remote">远程大模型</OpptrixOption>
              </OpptrixSelect>
            )}
            last
          />
        </SettingsGroup>
        <Text className={mergeClasses(s.saveHint, saveState !== 'idle' && s.saveHintActive)} block>
          {saveHintText}
        </Text>
      </div>

      {settings.translation.service_mode !== 'remote' && (
        <TranslationOfflinePanel
          settings={settings}
          onChange={setSettings}
          status={status}
          models={models}
          download={download}
          offlineOptions={offlineOptions}
          downloadDir={downloadDir}
          onDownload={modelId => { void handleDownload(modelId) }}
          onCancelDownload={() => { void handleCancelDownload() }}
          onOpenDownloadDir={() => { void handleOpenDownloadDir() }}
        />
      )}

      <div className={s.sectionBlock}>
        <SettingsSectionLabel spaced>远程翻译</SettingsSectionLabel>
        <SettingsGroup>
          {providers.length === 0 ? (
            <SettingsStaticBlock>
              <Text className={s.emptyHint} block>
                尚未配置模型。请先在「模型」页添加后，再回来选择用于远程翻译的模型。
              </Text>
            </SettingsStaticBlock>
          ) : (
            <SettingsRow
              title="翻译模型"
              desc={selectedProvider
                ? `当前提供商：${selectedProvider.name}`
                : '按提供商分组，一次选定即可'}
              control={(
                <div className={s.remoteModelControl}>
                  <SettingsRemoteModelSelector
                    providers={providers}
                    providerId={settings.translation.remote_provider_id}
                    model={settings.translation.remote_model}
                    onChange={({ providerId, model }) => {
                      setSettings(prev => ({
                        ...prev,
                        translation: {
                          ...prev.translation,
                          remote_provider_id: providerId,
                          remote_model: model,
                        },
                      }))
                    }}
                  />
                </div>
              )}
              last
            />
          )}
        </SettingsGroup>
      </div>
    </>
  )
}
