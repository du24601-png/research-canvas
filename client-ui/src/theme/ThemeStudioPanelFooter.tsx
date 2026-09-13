/**
 * ThemeStudioPanelFooter — 主题工坊底部操作区。
 *
 * 导出 / 导入主题文件（隐藏文件选择器）、全部还原（二次确认由父级处理）、
 * 覆盖计数与操作结果提示。提示为面板内联状态，不依赖全局通知。
 */
import { useRef } from 'react'
import { makeStyles, Text } from '@fluentui/react-components'
import { opptrixCssVars } from './tokens'
import OpptrixButton from '../components/opptrix/OpptrixButton'

export interface ThemeStudioNote {
  tone: 'success' | 'error'
  text: string
}

const useStyles = makeStyles({
  footer: {
    borderTop: `1px solid ${opptrixCssVars.separator}`,
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  footerActions: {
    display: 'flex',
    gap: '8px',
  },
  hiddenInput: {
    display: 'none',
  },
  noteSuccess: {
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.success,
  },
  noteError: {
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.error,
  },
  hint: {
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
  },
})

export interface ThemeStudioPanelFooterProps {
  note: ThemeStudioNote | null
  count: number
  onExport: () => void
  onImportFile: (file: File) => void
  onResetAll: () => void
}

export function ThemeStudioPanelFooter({
  note,
  count,
  onExport,
  onImportFile,
  onResetAll,
}: ThemeStudioPanelFooterProps) {
  const s = useStyles()
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <footer className={s.footer}>
      {note && (
        <Text className={note.tone === 'error' ? s.noteError : s.noteSuccess} block role="status">
          {note.text}
        </Text>
      )}
      <div className={s.footerActions}>
        <OpptrixButton variant="secondary" size="small" onClick={onExport}>
          导出主题
        </OpptrixButton>
        <OpptrixButton
          variant="secondary"
          size="small"
          onClick={() => fileInputRef.current?.click()}
        >
          导入主题
        </OpptrixButton>
        <OpptrixButton variant="danger" size="small" onClick={onResetAll}>
          全部还原
        </OpptrixButton>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className={s.hiddenInput}
        aria-hidden
        tabIndex={-1}
        onChange={event => {
          const file = event.target.files?.[0]
          if (file) onImportFile(file)
          event.target.value = ''
        }}
      />
      <Text className={s.hint} block>
        {count > 0
          ? `已定制 ${count} 项；修改会立即生效并自动保存。`
          : '全部为默认样式，修改任意颜色即可开始定制。'}
      </Text>
    </footer>
  )
}
