import { useEffect, useState } from 'react'
import { Text, makeStyles, mergeClasses } from '@fluentui/react-components'
import { InfoRegular } from '@fluentui/react-icons'
import OpptrixButton from '../../components/opptrix/OpptrixButton'
import { opptrixCssVars, opptrixTokens } from '../../theme/tokens'
import { subscribeResearchCanvasEvents } from './researchCanvasBus'

const TOAST_MS = 6000

const useStyles = makeStyles({
  host: {
    position: 'sticky',
    top: '4px',
    zIndex: 6,
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
    padding: '0 8px',
  },
  toast: {
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    maxWidth: 'min(420px, 100%)',
    padding: '10px 12px',
    borderRadius: opptrixTokens.radiusMd,
    border: `1px solid ${opptrixCssVars.separator}`,
    backgroundColor: opptrixCssVars.surface,
    boxShadow: opptrixTokens.shadowPanel,
  },
  icon: {
    flexShrink: 0,
    marginTop: '1px',
    color: opptrixCssVars.textSecondary,
  },
  message: {
    flex: 1,
    minWidth: 0,
    fontSize: 'var(--opptrix-font-sm)',
    lineHeight: 1.45,
    color: opptrixCssVars.textPrimary,
  },
})

export default function ResearchCanvasToast({ removedTitle, onUndo, onDismiss }: {
  removedTitle?: string | null
  onUndo?: () => void
  onDismiss?: () => void
}) {
  const s = useStyles()
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => subscribeResearchCanvasEvents((event) => {
    if (typeof event !== 'object' || event === null) return
    const record = event as Record<string, unknown>
    if (record.type !== 'canvas_notice') return
    const next = typeof record.message === 'string' ? record.message.trim() : ''
    if (next) setMessage(next)
  }), [])

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [message])

  if (!message && !removedTitle) return null

  return (
    <div className={s.host} role="status" aria-live="polite">
      <div className={mergeClasses(s.toast, 'research-canvas-no-drag')}>
        <InfoRegular className={s.icon} fontSize={16} aria-hidden />
        <Text className={s.message} block>{removedTitle ? `已移除「${removedTitle}」` : message}</Text>
        {removedTitle ? <OpptrixButton variant="secondary" size="small" onClick={onUndo}>撤销</OpptrixButton> : null}
        <OpptrixButton variant="ghost" size="small" onClick={() => { setMessage(null); onDismiss?.() }}>
          知道了
        </OpptrixButton>
      </div>
    </div>
  )
}
