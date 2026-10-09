import { makeStyles } from '@fluentui/react-components'
import { PinRegular } from '@fluentui/react-icons'
import OpptrixButton from '../../components/opptrix/OpptrixButton'
import { opptrixCssVars, opptrixTokens } from '../../theme/tokens'
import { usePinBoard } from './PinBoardContext'

const useStyles = makeStyles({
  count: {
    marginLeft: '6px',
    minWidth: '18px',
    padding: '0 6px',
    borderRadius: opptrixTokens.radiusFull,
    backgroundColor: opptrixCssVars.accent,
    color: opptrixCssVars.accentForeground,
    fontSize: 'var(--opptrix-font-xs)',
    lineHeight: '18px',
    fontVariantNumeric: 'tabular-nums',
  },
})

/** 顶栏「看板」入口；仅对话优先布局显示。 */
export default function PinBoardButton() {
  const s = useStyles()
  const { chatFirst, open, pinnedCount, toggleBoard } = usePinBoard()
  if (!chatFirst) return null
  return (
    <OpptrixButton
      variant="ghost"
      size="small"
      icon={<PinRegular />}
      aria-pressed={open}
      aria-label={`看板，已钉住 ${pinnedCount} 项`}
      onClick={toggleBoard}
      data-pin-board-button
    >
      看板
      <span className={s.count} aria-hidden>{pinnedCount}</span>
    </OpptrixButton>
  )
}
