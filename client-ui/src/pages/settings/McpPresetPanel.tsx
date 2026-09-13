/**
 * MCP 预设面板 — 预置服务的展示与启用（预设模式布局段）。
 * 状态与保存逻辑留在 McpServersSettingsSection，本组件只承载布局。
 */
import { Spinner, Switch, makeStyles } from '@fluentui/react-components'
import { CodeRegular } from '@fluentui/react-icons'
import { mcpPresetNeedsSecret, type McpPresetDef } from '../../api/client'
import OpptrixButton from '../../components/opptrix/OpptrixButton'
import McpApiKeyField from '../../components/opptrix/McpApiKeyField'
import {
  SettingsEmptyState,
  SettingsGroup,
  SettingsHint,
  SettingsRow,
  SettingsSectionLabel,
  SettingsStaticBlock,
} from './SettingsPrimitives'
import { openExternalUrl } from '../../platform/openUrl'
import { opptrixCssVars, opptrixTokens } from '../../theme/tokens'
import { ghostInteractive, motion } from '../../theme/mixins'

const useStyles = makeStyles({
  keyBlock: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  homepageLink: {
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.accent,
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    fontWeight: 500,
    padding: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    marginTop: '6px',
    alignSelf: 'flex-start',
    ':hover': {
      color: opptrixCssVars.accentHover,
    },
  },
  advancedLink: {
    ...ghostInteractive,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    borderRadius: opptrixTokens.radiusMd,
    fontSize: 'var(--opptrix-font-md)',
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    color: opptrixCssVars.textSecondary,
    textAlign: 'left',
    width: '100%',
    transitionProperty: 'background-color',
    transitionDuration: motion.fast,
  },
  presetList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  serviceHintLine: {
    display: 'block',
    marginTop: '2px',
  },
})

export default function McpPresetPanel({
  presets,
  presetsLoading,
  apiKeys,
  testing,
  applying,
  onToggle,
  onTest,
  onKeyChange,
  onKeyBlur,
  onSwitchToJson,
}: {
  presets: McpPresetDef[]
  presetsLoading: boolean
  apiKeys: Record<string, string>
  testing: Record<string, boolean>
  applying: Record<string, boolean>
  onToggle: (presetId: string, enabled: boolean) => void
  onTest: (preset: McpPresetDef) => void
  onKeyChange: (presetId: string, value: string) => void
  onKeyBlur: (presetId: string) => void
  onSwitchToJson: () => void
}) {
  const s = useStyles()

  const isPresetConfigured = (preset: McpPresetDef) =>
    preset.services.some(svc => svc.configured)

  return (
    <>
      <SettingsHint>
        部分服务需要数据密钥，填好后打开开关即可使用；网页搜索用于一般公开资料，不是行情或公告来源，无需数据密钥。问财支持自然语言选股与资讯检索；同花顺（扶摇）一次配置可覆盖多项行情能力。
      </SettingsHint>
      <SettingsSectionLabel spaced>预置服务</SettingsSectionLabel>

      {presetsLoading ? (
        <Spinner size="tiny" label="正在加载预置服务…" />
      ) : presets.length === 0 ? (
        <SettingsGroup>
          <SettingsEmptyState
            title="还没有可用的预置服务"
            desc="可切换到高级配置自行添加，或稍后再试。"
          />
        </SettingsGroup>
      ) : (
        <div className={s.presetList}>
          {presets.map(preset => {
            const configured = isPresetConfigured(preset)
            const needsSecret = mcpPresetNeedsSecret(preset)
            const serviceHint = preset.services.length > 1
              ? preset.services.map(svc => svc.title).join('、')
              : null
            return (
              <SettingsGroup key={preset.id}>
                <SettingsRow
                  title={preset.title}
                  desc={(
                    <>
                      <span>{preset.description}</span>
                      {serviceHint && (
                        <span className={s.serviceHintLine}>
                          包含：{serviceHint}
                        </span>
                      )}
                    </>
                  )}
                  control={(
                    <Switch
                      checked={configured}
                      disabled={applying[preset.id]}
                      onChange={(_, d) => onToggle(preset.id, !!d.checked)}
                    />
                  )}
                />
                {needsSecret && (
                  <SettingsStaticBlock>
                    <div className={s.keyBlock}>
                      <McpApiKeyField
                        value={apiKeys[preset.id] ?? ''}
                        configured={configured}
                        testing={testing[preset.id]}
                        onValueChange={v => onKeyChange(preset.id, v)}
                        onBlur={() => onKeyBlur(preset.id)}
                        onTest={() => onTest(preset)}
                        placeholder={preset.services.length > 1 ? '输入共用数据密钥' : '输入数据密钥'}
                      />
                      {preset.homepage ? (
                        <button
                          type="button"
                          className={s.homepageLink}
                          onClick={() => {
                            const url = preset.homepage
                            if (url) openExternalUrl(url)
                          }}
                        >
                          前往获取数据密钥
                        </button>
                      ) : null}
                    </div>
                  </SettingsStaticBlock>
                )}
              </SettingsGroup>
            )
          })}
        </div>
      )}

      <OpptrixButton
        variant="ghost"
        block
        className={s.advancedLink}
        onClick={onSwitchToJson}
      >
        <CodeRegular fontSize={14} />
        高级：编辑完整配置
      </OpptrixButton>
    </>
  )
}
