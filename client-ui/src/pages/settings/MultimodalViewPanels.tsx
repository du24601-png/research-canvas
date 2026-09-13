/**
 * 多模态设置 — 四个视图布局段（媒体处理 / 离线翻译 / 图片理解 / 音视频转写）。
 * 状态与保存逻辑留在 MultimodalSettingsSection，本文件只承载布局。
 */
import { Text, makeStyles, mergeClasses } from '@fluentui/react-components'
import type { MultimodalStatusResponse, NewsSettings } from '../../types/schemas'
import type { PublicProvider } from '../../api/client'
import OpptrixButton from '../../components/opptrix/OpptrixButton'
import OpptrixSelect, { OpptrixOption } from '../../components/opptrix/OpptrixSelect'
import {
  SettingsGroup,
  SettingsListPanel,
  SettingsListRow,
  SettingsRow,
  SettingsStaticBlock,
} from './SettingsPrimitives'
import SettingsRemoteModelSelector from './SettingsRemoteModelSelector'
import { speechSettingsSenseVoicePresentation } from '../../chat/speechReadinessCopy'
import { opptrixCssVars } from '../../theme/tokens'

type SpeechPresentation = ReturnType<typeof speechSettingsSenseVoicePresentation>

const useStyles = makeStyles({
  tabPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  tabSectionBlock: {
    marginTop: 0,
  },
  sectionBlock: { marginTop: '20px' },
  saveHint: {
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
    padding: '4px 2px 0',
    minHeight: '16px',
  },
  saveHintActive: { color: opptrixCssVars.textSecondary },
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
  intervalSelect: { minWidth: '160px' },
  remoteModelControl: {
    display: 'flex',
    justifyContent: 'flex-end',
    minWidth: '140px',
    maxWidth: '240px',
  },
  panelFooter: {
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
    lineHeight: 1.5,
    padding: '8px 2px 0',
  },
  emptyHint: {
    fontSize: 'var(--opptrix-font-base)',
    color: opptrixCssVars.textSecondary,
    lineHeight: 1.55,
  },
})

export type MultimodalSettingsUpdater = (
  updater: (prev: NewsSettings) => NewsSettings,
) => void

/** 媒体处理视图 */
export function MultimodalEnrichmentPanel({
  settings,
  onChange,
  saveHintText,
  saveActive,
}: {
  settings: NewsSettings
  onChange: MultimodalSettingsUpdater
  saveHintText: string
  saveActive: boolean
}) {
  const s = useStyles()
  return (
    <div className={s.tabPanel}>
      <div className={mergeClasses(s.sectionBlock, s.tabSectionBlock)}>
        <SettingsGroup>
          <SettingsRow
            title="启用媒体提取"
            desc="从文章中的图片、音频、视频提取可读文字，供阅读与 Agent 使用"
            control={(
              <OpptrixSelect
                className={s.intervalSelect}
                size="small"
                selectedOptions={[settings.enrichment.enabled ? 'on' : 'off']}
                onOptionSelect={(_, d) => {
                  onChange(prev => ({
                    ...prev,
                    enrichment: { ...prev.enrichment, enabled: d.optionValue === 'on' },
                  }))
                }}
              >
                <OpptrixOption value="on">开启</OpptrixOption>
                <OpptrixOption value="off">关闭</OpptrixOption>
              </OpptrixSelect>
            )}
          />
          <SettingsRow
            title="处理时机"
            desc="按需：首次由 Agent 读取或阅读器手动触发；后台：RSS 更新后自动排队全量处理"
            control={(
              <OpptrixSelect
                className={s.intervalSelect}
                size="small"
                selectedOptions={[settings.enrichment.processing_mode]}
                onOptionSelect={(_, d) => {
                  const mode = d.optionValue === 'background' ? 'background' : 'on_demand'
                  onChange(prev => ({
                    ...prev,
                    enrichment: { ...prev.enrichment, processing_mode: mode },
                  }))
                }}
              >
                <OpptrixOption value="on_demand">按需处理（默认）</OpptrixOption>
                <OpptrixOption value="background">后台全量自动</OpptrixOption>
              </OpptrixSelect>
            )}
          />
          <SettingsRow
            title="提取范围"
            desc="图片需配置下方远程视觉模型；音视频在本机转写"
            control={(
              <OpptrixSelect
                className={s.intervalSelect}
                size="small"
                selectedOptions={[
                  [
                    settings.enrichment.extract_images && 'img',
                    settings.enrichment.extract_audio && 'aud',
                    settings.enrichment.extract_video && 'vid',
                  ].filter(Boolean).join(',') || 'none',
                ]}
                onOptionSelect={(_, d) => {
                  const val = d.optionValue ?? ''
                  onChange(prev => ({
                    ...prev,
                    enrichment: {
                      ...prev.enrichment,
                      extract_images: val.includes('img') || val === 'all',
                      extract_audio: val.includes('aud') || val === 'all',
                      extract_video: val.includes('vid') || val === 'all',
                    },
                  }))
                }}
              >
                <OpptrixOption value="img,aud,vid">图片 + 音频 + 视频</OpptrixOption>
                <OpptrixOption value="img">仅图片</OpptrixOption>
                <OpptrixOption value="aud,vid">仅音视频</OpptrixOption>
                <OpptrixOption value="img,aud">图片 + 音频</OpptrixOption>
              </OpptrixSelect>
            )}
            last
          />
        </SettingsGroup>
        <Text className={mergeClasses(s.saveHint, saveActive && s.saveHintActive)} block>
          {saveHintText}
        </Text>
      </div>
    </div>
  )
}

/** 离线翻译视图 */
export function MultimodalTranslationPanel({
  settings,
  onChange,
  mmStatus,
}: {
  settings: NewsSettings
  onChange: MultimodalSettingsUpdater
  mmStatus: MultimodalStatusResponse | null
}) {
  const s = useStyles()
  return (
    <div className={s.tabPanel}>
      <div className={mergeClasses(s.sectionBlock, s.tabSectionBlock)}>
        <SettingsGroup>
          <SettingsRow
            title="启用离线翻译"
            desc="开启后后台检测并自动下载 HY-MT 模型（约 1.1 GB）；关闭则使用远程大模型翻译"
            control={(
              <OpptrixSelect
                className={s.intervalSelect}
                size="small"
                selectedOptions={[settings.translation.service_mode === 'offline' ? 'on' : 'off']}
                onOptionSelect={(_, d) => {
                  const offline = d.optionValue === 'on'
                  onChange(prev => ({
                    ...prev,
                    translation: {
                      ...prev.translation,
                      service_mode: offline ? 'offline' : 'remote',
                    },
                  }))
                }}
              >
                <OpptrixOption value="off">关闭（默认）</OpptrixOption>
                <OpptrixOption value="on">开启</OpptrixOption>
              </OpptrixSelect>
            )}
            last
          />
        </SettingsGroup>
        {settings.translation.service_mode === 'offline' && (
          <Text className={s.panelFooter} block>
            {mmStatus?.translation?.modelInstalled
              ? `当前模型：${mmStatus.translation.modelName ?? 'HY-MT'}`
              : '保存后后台将自动下载推荐模型 HY-MT1.5 Q4_K_M；也可在「翻译」页手动选择版本'}
          </Text>
        )}
      </div>
    </div>
  )
}

/** 图片理解视图 */
export function MultimodalVisionPanel({
  settings,
  onChange,
  providers,
}: {
  settings: NewsSettings
  onChange: MultimodalSettingsUpdater
  providers: PublicProvider[]
}) {
  const s = useStyles()
  const selectedProvider = providers.find(p => p.id === settings.enrichment.remote_provider_id) ?? null
  return (
    <div className={s.tabPanel}>
      <div className={mergeClasses(s.sectionBlock, s.tabSectionBlock)}>
        <SettingsGroup>
          {providers.length === 0 ? (
            <SettingsStaticBlock>
              <Text className={s.emptyHint} block>
                图片理解需要支持看图的远程模型。请先在「模型」页添加后，再选择如 GPT-4o、Qwen-VL、GLM-4V 等。
              </Text>
            </SettingsStaticBlock>
          ) : (
            <SettingsRow
              title="视觉模型"
              desc={selectedProvider
                ? `须支持看图 · 当前提供商：${selectedProvider.name}`
                : '须支持看图；按提供商分组，一次选定即可'}
              control={(
                <div className={s.remoteModelControl}>
                  <SettingsRemoteModelSelector
                    providers={providers}
                    providerId={settings.enrichment.remote_provider_id}
                    model={settings.enrichment.remote_model}
                    onChange={({ providerId, model }) => {
                      onChange(prev => ({
                        ...prev,
                        enrichment: {
                          ...prev.enrichment,
                          remote_provider_id: providerId,
                          remote_model: model,
                          service_mode: 'remote',
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
    </div>
  )
}

/** 音视频转写视图 */
export function MultimodalSpeechPanel({
  extractionEnabled,
  runtime,
  presentation,
  ensuring,
  ensurePercent,
  onEnsure,
}: {
  extractionEnabled: boolean
  runtime: MultimodalStatusResponse['runtime'] | undefined
  presentation: SpeechPresentation | null
  ensuring: boolean
  ensurePercent: number
  onEnsure: () => void
}) {
  const s = useStyles()
  return (
    <div className={s.tabPanel}>
      {extractionEnabled ? (
        <div className={mergeClasses(s.sectionBlock, s.tabSectionBlock)}>
          <SettingsListPanel>
            <SettingsListRow
              title="媒体下载"
              meta="处理时会把文章中的音视频暂存到本机，便于转写"
              trailing={<span className={mergeClasses(s.statusBadge, s.statusReady)}>已启用</span>}
            />
            <SettingsListRow
              title="媒体解码"
              meta={runtime?.ffmpeg?.ready ? '已就绪，可处理音视频' : '暂时不可用，请重启应用后再试'}
              trailing={(
                <span className={mergeClasses(s.statusBadge, runtime?.ffmpeg?.ready && s.statusReady)}>
                  {runtime?.ffmpeg?.ready ? '已就绪' : '不可用'}
                </span>
              )}
            />
            <SettingsListRow
              title="本机语音识别"
              meta={
                !runtime?.sensevoice || !presentation
                  ? '转写能力暂时不可用，请重启应用后再试'
                  : presentation.meta
              }
              trailing={
                !runtime?.sensevoice || !presentation ? (
                  <span className={mergeClasses(s.statusBadge, s.statusWarn)}>暂不可用</span>
                ) : ensuring ? (
                  <span className={mergeClasses(s.statusBadge)}>
                    {ensurePercent > 0
                      ? `准备中 ${ensurePercent}%`
                      : '准备中…'}
                  </span>
                ) : !runtime.sensevoice.ready ? (
                  <OpptrixButton
                    variant="secondary"
                    size="small"
                    disabled={ensuring}
                    onClick={onEnsure}
                  >
                    立即准备
                  </OpptrixButton>
                ) : (
                  <span className={mergeClasses(
                    s.statusBadge,
                    presentation.badgeReady && s.statusReady,
                    presentation.badgeWarn && s.statusWarn,
                  )}>
                    {presentation.badgeLabel}
                  </span>
                )
              }
            />
          </SettingsListPanel>
        </div>
      ) : (
        <div className={mergeClasses(s.sectionBlock, s.tabSectionBlock)}>
          <Text className={s.panelFooter} block>
            音视频转写需先开启「启用媒体提取」，并在提取范围中包含音频或视频。
          </Text>
        </div>
      )}
    </div>
  )
}
