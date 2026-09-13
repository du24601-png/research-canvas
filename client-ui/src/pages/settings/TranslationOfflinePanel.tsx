/**
 * 离线翻译面板 — 离线引擎状态、模型目录与下载进度的布局段。
 * 状态与下载逻辑留在 TranslationSettingsSection，本文件只承载布局。
 */
import {
  ProgressBar,
  Text,
  makeStyles,
  mergeClasses,
} from '@fluentui/react-components'
import {
  ArrowDownloadRegular,
  CheckmarkCircleRegular,
  DismissRegular,
} from '@fluentui/react-icons'
import type {
  TranslationDownloadProgress,
  TranslationEngineStatus,
  TranslationModelsResult,
} from '../../platform/detect'
import { isElectron } from '../../platform/detect'
import type { NewsSettings } from '../../types/schemas'
import OpptrixButton from '../../components/opptrix/OpptrixButton'
import OpptrixSelect, { OpptrixOption } from '../../components/opptrix/OpptrixSelect'
import {
  SettingsAddBar,
  SettingsListPanel,
  SettingsListRow,
  SettingsListScroll,
} from './SettingsPrimitives'
import { opptrixCssVars } from '../../theme/tokens'
import { ghostInteractive } from '../../theme/mixins'

const useStyles = makeStyles({
  sectionBlock: {
    marginTop: '20px',
  },
  sectionHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '0 2px 8px',
  },
  sectionHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
    flex: 1,
  },
  sectionLabel: {
    fontSize: 'var(--opptrix-font-md)',
    fontWeight: 400,
    color: opptrixCssVars.textSecondary,
    lineHeight: '16px',
    flexShrink: 0,
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textSecondary,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  statusReady: {
    color: opptrixCssVars.success,
  },
  modelSelect: {
    minWidth: '140px',
    maxWidth: '220px',
    flexShrink: 0,
  },
  progressBlock: {
    flexShrink: 0,
    padding: '10px 14px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    borderTop: `1px solid ${opptrixCssVars.separator}`,
    backgroundColor: opptrixCssVars.canvasAlt,
  },
  progressTopRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    minWidth: 0,
  },
  progressInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  progressLabel: {
    fontSize: 'var(--opptrix-font-sm)',
    fontWeight: 600,
    color: opptrixCssVars.textTertiary,
    lineHeight: 1.35,
  },
  progressFilename: {
    fontSize: 'var(--opptrix-font-md)',
    fontWeight: 500,
    color: opptrixCssVars.textPrimary,
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  progressSub: {
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  progressActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
  },
  progressPct: {
    fontSize: 'var(--opptrix-font-md)',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    color: opptrixCssVars.textPrimary,
    lineHeight: 1.35,
    minWidth: '36px',
    textAlign: 'right',
  },
  progressBarTrack: {
    width: '100%',
    minHeight: '6px',
  },
  progressCancel: {
    minWidth: 'auto',
    height: '24px',
    padding: '0 6px',
    fontSize: 'var(--opptrix-font-md)',
    color: opptrixCssVars.textTertiary,
    ':hover': {
      color: opptrixCssVars.textPrimary,
    },
  },
  panelFooter: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
    lineHeight: 1.5,
    padding: '8px 2px 0',
  },
  panelFooterText: {
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
    lineHeight: 1.5,
  },
  panelFooterDirRow: {
    minWidth: 0,
  },
  panelFooterDirMuted: {
    display: 'block',
    fontFamily: 'var(--opptrix-font-mono)',
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textSecondary,
    lineHeight: 1.45,
  },
  panelFooterDir: {...ghostInteractive,

    display: 'block',
    width: '100%',
    fontFamily: 'var(--opptrix-font-mono)',
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.accent,
    wordBreak: 'break-all',
    textAlign: 'left',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    padding: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    lineHeight: 1.45,
':hover': {
      color: opptrixCssVars.accent,
      opacity: 0.85,
    },
  },
})

function formatDownloadProgress(progress: TranslationDownloadProgress | null | undefined): string {
  if (!progress) return ''
  const pct = progress.totalBytes > 0
    ? Math.min(100, Math.round((progress.receivedBytes / progress.totalBytes) * 100))
    : 0
  return `${pct}%`
}

function formatDownloadBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

export default function TranslationOfflinePanel({
  settings,
  onChange,
  status,
  models,
  download,
  offlineOptions,
  downloadDir,
  onDownload,
  onCancelDownload,
  onOpenDownloadDir,
}: {
  settings: NewsSettings
  onChange: (updater: (prev: NewsSettings) => NewsSettings) => void
  status: TranslationEngineStatus | null
  models: TranslationModelsResult | null
  download: TranslationDownloadProgress | null
  offlineOptions: Array<{ value: string; label: string }>
  downloadDir: string | null
  onDownload: (modelId: string) => void
  onCancelDownload: () => void
  onOpenDownloadDir: () => void
}) {
  const s = useStyles()
  return (
    <div className={s.sectionBlock}>
      <div className={s.sectionHeaderRow}>
        <div className={s.sectionHeaderLeft}>
          <Text className={s.sectionLabel}>离线翻译</Text>
          <span className={mergeClasses(s.statusBadge, status?.ready && s.statusReady)}>
            {status?.ready
              ? <><CheckmarkCircleRegular fontSize={14} /> 已就绪</>
              : status?.loading
                ? '加载中…'
                : status?.modelFound
                  ? '待加载'
                  : '未安装'}
          </span>
        </div>
        <OpptrixSelect
          className={s.modelSelect}
          size="small"
          selectedOptions={[settings.translation.offline_model]}
          onOptionSelect={(_, d) => {
            onChange(prev => ({
              ...prev,
              translation: {
                ...prev.translation,
                offline_model: d.optionValue ?? '__auto__',
              },
            }))
          }}
        >
          {offlineOptions.map(opt => (
            <OpptrixOption key={opt.value} value={opt.value}>{opt.label}</OpptrixOption>
          ))}
        </OpptrixSelect>
      </div>

      <SettingsListPanel height="360px">
        <SettingsAddBar
          meta={status?.ready
            ? `当前：${status.modelName}`
            : status?.modelFound
              ? `已安装 ${status.modelName}，首次翻译时加载`
              : `下载离线模型（默认 ${models?.defaultDownloadSource ?? 'hf-mirror'}，失败自动换源）`}
        />

        <SettingsListScroll>
          {(models?.catalog ?? []).map(item => (
            <SettingsListRow
              key={item.id}
              title={`${item.name}${item.recommended ? ' · 推荐' : ''}${item.purposeLabel ? ` · ${item.purposeLabel}` : ''}`}
              titleTitle={item.name}
              meta={`${item.sizeLabel}${item.installed ? ' · 已安装' : ''}`}
              trailing={item.installed ? (
                <span className={mergeClasses(s.statusBadge, s.statusReady)}>
                  <CheckmarkCircleRegular fontSize={14} /> 已安装
                </span>
              ) : (
                <OpptrixButton
                  variant="secondary"
                  size="small"
                  icon={<ArrowDownloadRegular fontSize={12} />}
                  disabled={Boolean(download?.status === 'downloading')}
                  onClick={() => onDownload(item.id)}
                >
                  下载
                </OpptrixButton>
              )}
            />
          ))}

          {(models?.installed ?? [])
            .filter(installed => !(models?.catalog ?? []).some(item => item.filename === installed.filename))
            .map(item => (
              <SettingsListRow
                key={item.path}
                title={item.filename}
                titleTitle={item.filename}
                meta={`${item.sizeLabel} · 本地文件`}
                trailing={(
                  <span className={mergeClasses(s.statusBadge, s.statusReady)}>
                    <CheckmarkCircleRegular fontSize={14} /> 已安装
                  </span>
                )}
              />
            ))}
        </SettingsListScroll>

        {download?.status === 'downloading' && (() => {
          const downloadName = models?.catalog?.find(item => item.id === download.modelId)?.name
            ?? download.filename
          const sizeHint = download.totalBytes > 0
            ? `${formatDownloadBytes(download.receivedBytes)} / ${formatDownloadBytes(download.totalBytes)}`
            : null
          const subParts = [
            download.sourceLabel,
            sizeHint,
          ].filter(Boolean)

          return (
            <div className={s.progressBlock}>
              <div className={s.progressTopRow}>
                <div className={s.progressInfo}>
                  <Text className={s.progressLabel} block>正在下载</Text>
                  <Text className={s.progressFilename} block title={downloadName}>
                    {downloadName}
                  </Text>
                  {subParts.length > 0 && (
                    <Text className={s.progressSub} block>
                      {subParts.join(' · ')}
                    </Text>
                  )}
                </div>
                <div className={s.progressActions}>
                  <span className={s.progressPct}>{formatDownloadProgress(download)}</span>
                  <OpptrixButton
                    variant="ghost"
                    size="small"
                    className={s.progressCancel}
                    icon={<DismissRegular fontSize={12} />}
                    onClick={onCancelDownload}
                  >
                    取消
                  </OpptrixButton>
                </div>
              </div>
              <ProgressBar
                className={s.progressBarTrack}
                value={download.totalBytes > 0 ? download.receivedBytes / download.totalBytes : undefined}
                thickness="medium"
                color="brand"
                shape="rounded"
              />
            </div>
          )
        })()}
      </SettingsListPanel>
      <div className={s.panelFooter}>
        <Text className={s.panelFooterText} block>
          若自动下载失败，可自行下载腾讯 HY-MT 的 Q4_K_M 或更高量化 GGUF 文件，保存后应用会自动识别。
        </Text>
        <div className={s.panelFooterDirRow}>
          {downloadDir ? (
            isElectron() && window.electronAPI?.translationOpenDownloadDir ? (
              <OpptrixButton
                variant="ghost"
                size="small"
                className={s.panelFooterDir}
                title="点击打开文件夹"
                onClick={onOpenDownloadDir}
              >
                {downloadDir}
              </OpptrixButton>
            ) : (
              <span className={s.panelFooterDirMuted} title={downloadDir}>{downloadDir}</span>
            )
          ) : (
            <span className={s.panelFooterDirMuted}>加载中…</span>
          )}
        </div>
      </div>
    </div>
  )
}
