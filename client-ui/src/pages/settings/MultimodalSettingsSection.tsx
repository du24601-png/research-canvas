import { useCallback, useEffect, useRef, useState } from 'react'
import { Spinner, makeStyles, mergeClasses } from '@fluentui/react-components'
import { getConfig, news, type PublicProvider } from '../../api/client'
import type {
  MultimodalStatusResponse,
  NewsEnrichmentSettings,
  NewsSettings,
} from '../../types/schemas'
import { SettingsHint, SettingsModeTabs } from './SettingsPrimitives'
import {
  MultimodalEnrichmentPanel,
  MultimodalSpeechPanel,
  MultimodalTranslationPanel,
  MultimodalVisionPanel,
} from './MultimodalViewPanels'
import { useSettingsToast } from './SettingsToast'
import { useDebouncedEffect } from '../../hooks/useDebouncedEffect'
import { opptrixCssVars } from '../../theme/tokens'
import {
  speechEnsureSuccessToastMessage,
  speechSettingsSenseVoicePresentation,
} from '../../chat/speechReadinessCopy'

const SETTINGS_SAVE_MS = 500

const DEFAULT_ENRICHMENT: NewsEnrichmentSettings = {
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

type SaveState = 'idle' | 'pending' | 'saved' | 'error'
type ViewMode = 'enrichment' | 'translation' | 'vision' | 'speech'

const useStyles = makeStyles({
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textSecondary,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  statusReady: { color: opptrixCssVars.success },
  statusWarn: { color: opptrixCssVars.warning },
})

export default function MultimodalSettingsSection() {
  const s = useStyles()
  const toast = useSettingsToast()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<NewsSettings>({
    refresh_interval_min: 15,
    retention_years: 3,
    max_articles: null,
    translation: {
      service_mode: 'remote',
      offline_model: '__auto__',
      remote_provider_id: null,
      remote_model: null,
    },
    enrichment: DEFAULT_ENRICHMENT,
  })
  const [providers, setProviders] = useState<PublicProvider[]>([])
  const [mmStatus, setMmStatus] = useState<MultimodalStatusResponse | null>(null)
  const [speechEnsuring, setSpeechEnsuring] = useState(false)
  const [speechEnsureMessage, setSpeechEnsureMessage] = useState('')
  const [speechEnsurePercent, setSpeechEnsurePercent] = useState(0)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [viewMode, setViewMode] = useState<ViewMode>('enrichment')
  const skipSettingsSave = useRef(true)
  const settingsBaseline = useRef<{ enrichment: NewsEnrichmentSettings; translation: NewsSettings['translation'] } | null>(null)
  const speechEnsureAbort = useRef<AbortController | null>(null)

  const refreshStatus = useCallback(async () => {
    const status = await news.getMultimodalStatus()
    setMmStatus(status)
    const ensure = status.sensevoiceEnsure
    if (ensure && (ensure.phase === 'preparing' || ensure.phase === 'downloading')) {
      if (!speechEnsureAbort.current) {
        setSpeechEnsuring(true)
        setSpeechEnsureMessage(ensure.message || '正在准备语音识别…')
        setSpeechEnsurePercent(ensure.percent || 0)
      }
    }
    return status
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [st, cfg] = await Promise.all([
        news.getSettings(),
        getConfig().catch(() => null),
      ])
      setSettings(st.settings)
      settingsBaseline.current = {
        enrichment: st.settings.enrichment,
        translation: st.settings.translation,
      }
      skipSettingsSave.current = true
      setProviders(cfg?.providers ?? [])
      await refreshStatus()
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [refreshStatus, toast])

  useEffect(() => { void load() }, [load])

  // bootstrap / 他处已启动的 ensure：进入设置页时接上同一 job 轮询，不双开
  useEffect(() => {
    const ensure = mmStatus?.sensevoiceEnsure
    if (!ensure || (ensure.phase !== 'preparing' && ensure.phase !== 'downloading')) {
      return undefined
    }
    // 显式「立即准备」已在轮询，避免双 toast / 双轮询
    if (speechEnsureAbort.current) return undefined
    setSpeechEnsuring(true)
    setSpeechEnsureMessage(ensure.message || '正在准备语音识别…')
    setSpeechEnsurePercent(ensure.percent || 0)
    const timer = window.setInterval(() => {
      if (speechEnsureAbort.current) return
      void news.getSenseVoiceEnsureJob()
        .then(({ job }) => {
          setSpeechEnsureMessage(job.message || '')
          setSpeechEnsurePercent(job.percent || 0)
          if (job.phase === 'ready') {
            setSpeechEnsuring(false)
            setSpeechEnsureMessage('')
            setSpeechEnsurePercent(0)
            void refreshStatus().then((status) => {
              toast.showSuccess(
                speechEnsureSuccessToastMessage(Boolean(status?.runtime?.ffmpeg?.ready)),
              )
            })
          } else if (job.phase === 'error') {
            setSpeechEnsuring(false)
            setSpeechEnsureMessage('')
            setSpeechEnsurePercent(0)
            toast.showError(job.error || job.message || '语音识别模型准备失败')
            void refreshStatus()
          }
        })
        .catch(() => { /* 轮询失败静默，下次重试 */ })
    }, 1500)
    return () => window.clearInterval(timer)
  }, [mmStatus?.sensevoiceEnsure?.phase, refreshStatus, toast])

  useDebouncedEffect(() => {
    if (loading || skipSettingsSave.current) {
      skipSettingsSave.current = false
      return
    }
    const baseline = settingsBaseline.current
    if (!baseline) return
    const nextEnrichment = settings.enrichment
    const nextTranslation = settings.translation
    if (
      JSON.stringify(baseline.enrichment) === JSON.stringify(nextEnrichment)
      && JSON.stringify(baseline.translation) === JSON.stringify(nextTranslation)
    ) return

    setSaveState('pending')
    news.saveSettings({ enrichment: nextEnrichment, translation: nextTranslation })
      .then(resp => {
        setSettings(resp.settings)
        settingsBaseline.current = {
          enrichment: resp.settings.enrichment,
          translation: resp.settings.translation,
        }
        setSaveState('saved')
        toast.showSuccess('已保存')
        void refreshStatus()
        window.setTimeout(() => setSaveState('idle'), 2000)
      })
      .catch((e: unknown) => {
        setSaveState('error')
        toast.showError(e instanceof Error ? e.message : '保存失败')
        window.setTimeout(() => setSaveState('idle'), 2000)
      })
  }, [settings.enrichment, settings.translation, loading, refreshStatus, toast], SETTINGS_SAVE_MS)

  const selectedProvider = providers.find(p => p.id === settings.enrichment.remote_provider_id) ?? null
  const runtime = mmStatus?.runtime

  const speechExtractionEnabled = settings.enrichment.enabled
    && (settings.enrichment.extract_audio || settings.enrichment.extract_video)

  const handleEnsureSpeech = async () => {
    if (!speechExtractionEnabled) {
      toast.showError('请先开启媒体提取并勾选音视频')
      return
    }
    speechEnsureAbort.current?.abort()
    const ac = new AbortController()
    speechEnsureAbort.current = ac
    setSpeechEnsuring(true)
    setSpeechEnsureMessage('正在准备语音识别…')
    setSpeechEnsurePercent(0)
    try {
      await news.ensureSenseVoiceModel({
        signal: ac.signal,
        onProgress: (job) => {
          setSpeechEnsureMessage(job.message || '正在准备语音识别…')
          setSpeechEnsurePercent(job.percent || 0)
        },
      })
      const status = await refreshStatus()
      toast.showSuccess(
        speechEnsureSuccessToastMessage(Boolean(status?.runtime?.ffmpeg?.ready)),
      )
    } catch (e) {
      if (!ac.signal.aborted) {
        toast.showError(e instanceof Error ? e.message : '语音识别模型准备失败')
      }
    } finally {
      if (speechEnsureAbort.current === ac) speechEnsureAbort.current = null
      setSpeechEnsuring(false)
      setSpeechEnsureMessage('')
      setSpeechEnsurePercent(0)
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
    if (!settings.enrichment.enabled) {
      return '多模态提取已关闭，阅读器与 Agent 将只使用文章正文 HTML。'
    }
    const parts: string[] = []
    if (settings.enrichment.extract_images) {
      parts.push(mmStatus?.canEnrichImages
        ? `图片：远程视觉模型（${mmStatus.remoteProviderName ?? '已配置'}）`
        : '图片：未配置远程视觉模型，将跳过图片（请在下方选择 GPT-4o / Qwen-VL 等）')
    }
    if (settings.enrichment.extract_audio || settings.enrichment.extract_video) {
      parts.push(mmStatus?.canEnrichSpeech
        ? '音视频：本机音视频转写'
        : '音视频：暂时无法处理，请检查服务端依赖')
    }
    return parts.join(' · ') || '请在下方配置提取能力'
  })()

  const translationBadge = (() => {
    if (settings.translation.service_mode === 'remote') return '未启用'
    if (mmStatus?.translation?.downloading) return '下载中…'
    if (mmStatus?.translation?.modelInstalled) return '模型已就绪'
    return '待下载 HY-MT'
  })()

  const visionBadge = mmStatus?.canEnrichImages ? '已配置' : '未配置'

  const speechSenseVoicePresentation = runtime?.sensevoice
    ? speechSettingsSenseVoicePresentation({
      sensevoiceReady: runtime.sensevoice.ready,
      ffmpegReady: Boolean(runtime.ffmpeg?.ready),
      source: runtime.sensevoice.source,
      ensuring: speechEnsuring,
      ensureMessage: speechEnsureMessage,
    })
    : null

  if (loading) return <Spinner size="tiny" label="加载多模态设置…" />

  return (
    <>
      <SettingsHint>{engineHint}</SettingsHint>

      <SettingsModeTabs
        value={viewMode}
        onChange={setViewMode}
        items={[
          { id: 'enrichment', label: '媒体处理' },
          {
            id: 'translation',
            label: '离线翻译',
            trailing: (
              <span className={mergeClasses(
                s.statusBadge,
                settings.translation.service_mode !== 'remote' && mmStatus?.translation?.modelInstalled && s.statusReady,
              )}>
                {translationBadge}
              </span>
            ),
          },
          {
            id: 'vision',
            label: '图片理解',
            trailing: (
              <span className={mergeClasses(s.statusBadge, mmStatus?.canEnrichImages && s.statusReady)}>
                {visionBadge}
              </span>
            ),
          },
          {
            id: 'speech',
            label: '音视频转写',
            trailing: (
              <span className={mergeClasses(s.statusBadge, runtime?.ffmpeg?.ready && s.statusReady)}>
                {runtime?.ffmpeg?.ready ? '已就绪' : '待配置'}
              </span>
            ),
          },
        ]}
        ariaLabel="多模态能力"
        spaced
        wrap
      />

      {viewMode === 'enrichment' && (
        <MultimodalEnrichmentPanel
          settings={settings}
          onChange={setSettings}
          saveHintText={saveHintText}
          saveActive={saveState !== 'idle'}
        />
      )}

      {viewMode === 'translation' && (
        <MultimodalTranslationPanel
          settings={settings}
          onChange={setSettings}
          mmStatus={mmStatus}
        />
      )}

      {viewMode === 'vision' && (
        <MultimodalVisionPanel
          settings={settings}
          onChange={setSettings}
          providers={providers}
        />
      )}

      {viewMode === 'speech' && (
        <MultimodalSpeechPanel
          extractionEnabled={speechExtractionEnabled}
          runtime={runtime}
          presentation={speechSenseVoicePresentation}
          ensuring={speechEnsuring}
          ensurePercent={speechEnsurePercent}
          onEnsure={() => { void handleEnsureSpeech() }}
        />
      )}
    </>
  )
}