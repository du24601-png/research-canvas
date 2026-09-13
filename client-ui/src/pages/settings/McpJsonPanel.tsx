/**
 * MCP 高级配置面板 — 完整配置的查看与编辑（JSON 模式布局段）。
 * 状态与校验逻辑留在 McpServersSettingsSection，本组件只承载布局与编辑器外观。
 */
import { json as jsonLanguage } from '@codemirror/lang-json'
import { linter, type Diagnostic } from '@codemirror/lint'
import { EditorView } from '@codemirror/view'
import { Spinner, Text, makeStyles } from '@fluentui/react-components'
import { CloudRegular } from '@fluentui/react-icons'
import OpptrixButton from '../../components/opptrix/OpptrixButton'
import SettingsMonospaceEditor from './SettingsMonospaceEditor'
import { SettingsHint, SettingsSectionLabel } from './SettingsPrimitives'
import { opptrixCssVars, opptrixTokens } from '../../theme/tokens'
import { ghostInteractive, motion } from '../../theme/mixins'

const useStyles = makeStyles({
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
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
  },
  toolbarRight: {
    display: 'flex',
    gap: '8px',
  },
  error: {
    fontSize: 'var(--opptrix-font-md)',
    color: opptrixCssVars.error,
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap',
  },
  syncHint: {
    padding: 0,
  },
})

const jsonLinter = linter((view): Diagnostic[] => {
  const text = view.state.doc.toString()
  try {
    JSON.parse(text)
    return []
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const match = /position (\d+)/.exec(msg)
    const pos = match ? Math.min(Number(match[1]), text.length) : 0
    return [{
      from: pos,
      to: Math.min(pos + 1, text.length),
      severity: 'error' as const,
      message: msg,
    }]
  }
})

const cmExtensions = [jsonLanguage(), jsonLinter, EditorView.lineWrapping]

export default function McpJsonPanel({
  raw,
  loading,
  saving,
  dirty,
  validationError,
  onRawChange,
  onFormat,
  onReset,
  onSave,
  onSwitchToPreset,
}: {
  raw: string
  loading: boolean
  saving: boolean
  dirty: boolean
  validationError: string | null
  onRawChange: (value: string) => void
  onFormat: () => void
  onReset: () => void
  onSave: () => void
  onSwitchToPreset: () => void
}) {
  const s = useStyles()

  return (
    <>
      <SettingsHint>
        适合自定义外部服务。保存后将替换当前全部配置；请确认内容无误后再保存。
      </SettingsHint>
      <SettingsSectionLabel spaced>高级配置</SettingsSectionLabel>

      {loading ? (
        <Spinner size="tiny" label="正在加载配置…" />
      ) : (
        <>
          <SettingsMonospaceEditor
            value={raw}
            height="360px"
            extensions={cmExtensions}
            onChange={onRawChange}
          />

          {validationError && (
            <Text className={s.error} block>{validationError}</Text>
          )}

          <div className={s.toolbar}>
            <SettingsHint className={s.syncHint}>
              {dirty ? '有未保存的修改' : '已与当前配置同步'}
            </SettingsHint>
            <div className={s.toolbarRight}>
              <OpptrixButton
                variant="secondary"
                disabled={saving}
                onClick={onFormat}
              >
                格式化
              </OpptrixButton>
              <OpptrixButton
                variant="secondary"
                disabled={saving}
                onClick={onReset}
              >
                重置
              </OpptrixButton>
              <OpptrixButton
                variant="primary"
                disabled={saving || !!validationError}
                onClick={onSave}
              >
                {saving ? '保存中…' : '保存'}
              </OpptrixButton>
            </div>
          </div>
        </>
      )}

      <OpptrixButton
        variant="ghost"
        block
        className={s.advancedLink}
        onClick={onSwitchToPreset}
      >
        <CloudRegular fontSize={14} />
        切换回预置服务
      </OpptrixButton>
    </>
  )
}
