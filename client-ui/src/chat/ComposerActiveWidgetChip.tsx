import { useCallback, useSyncExternalStore } from 'react'
import { makeStyles } from '@fluentui/react-components'
import { DismissRegular } from '@fluentui/react-icons'
import { opptrixCssVars, opptrixTokens } from '../theme/tokens'
import {
  getActiveWidgetSelection,
  setActiveWidget,
  subscribeActiveWidget,
} from './research-canvas/activeWidgetSelection'

const useStyles = makeStyles({
  row: {
    display: 'inline-flex',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: 'min(100%, 280px)',
    minWidth: 0,
    height: '22px',
    margin: '0 0 2px',
    padding: '0 2px 0 8px',
    borderRadius: opptrixTokens.radiusFull,
    border: `1px solid ${opptrixCssVars.separator}`,
    backgroundColor: opptrixCssVars.canvasAlt,
    color: opptrixCssVars.textSecondary,
    boxSizing: 'border-box',
  },
  prefix: {
    flexShrink: 0,
    marginRight: '4px',
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
  },
  title: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 'var(--opptrix-font-sm)',
    fontWeight: 500,
    lineHeight: 1,
    color: opptrixCssVars.textPrimary,
  },
  dismiss: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: '20px',
    height: '20px',
    marginLeft: '2px',
    padding: 0,
    border: 'none',
    borderRadius: opptrixTokens.radiusFull,
    backgroundColor: 'transparent',
    color: opptrixCssVars.textTertiary,
    cursor: 'pointer',
    ':hover': {
      color: opptrixCssVars.textSecondary,
      backgroundColor: opptrixCssVars.surfaceHover,
    },
  },
})

export default function ComposerActiveWidgetChip() {
  const s = useStyles()
  const selection = useSyncExternalStore(
    subscribeActiveWidget,
    getActiveWidgetSelection,
    getActiveWidgetSelection,
  )
  const handleClear = useCallback(() => {
    setActiveWidget(null)
  }, [])

  if (!selection) return null

  return (
    <div className={s.row} data-active-widget-chip={selection.id}>
      <span className={s.prefix} aria-hidden>↳</span>
      <span className={s.title} title={selection.title}>{selection.title}</span>
      <button
        type="button"
        className={s.dismiss}
        title="停止围绕此图提问"
        aria-label="停止围绕此图提问"
        onClick={handleClear}
      >
        <DismissRegular fontSize={11} />
      </button>
    </div>
  )
}
