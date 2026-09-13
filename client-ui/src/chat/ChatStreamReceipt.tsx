import { makeStyles, Text } from '@fluentui/react-components'
import { opptrixCssVars } from '../theme/tokens'

const useStyles = makeStyles({
  bar: {
    padding: '6px 12px',
    borderBottom: `1px solid ${opptrixCssVars.separatorHairline}`,
    backgroundColor: opptrixCssVars.canvasAlt,
    boxSizing: 'border-box',
  },
  text: {
    fontSize: 'var(--opptrix-font-sm)',
    lineHeight: 1.35,
    color: opptrixCssVars.textTertiary,
    letterSpacing: '0.01em',
  },
  button: {
    display: 'block',
    width: '100%',
    padding: '6px 12px',
    margin: 0,
    border: 'none',
    borderBottom: `1px solid ${opptrixCssVars.separatorHairline}`,
    backgroundColor: opptrixCssVars.canvasAlt,
    cursor: 'pointer',
    textAlign: 'left',
    boxSizing: 'border-box',
    ':hover': {
      backgroundColor: opptrixCssVars.canvasMuted,
    },
  },
})

interface Props {
  text: string
  onExpand?: () => void
}

export default function ChatStreamReceipt({ text, onExpand }: Props) {
  const s = useStyles()
  if (onExpand) {
    return (
      <button type="button" className={s.button} onClick={onExpand}>
        <Text className={s.text} block>{text}</Text>
      </button>
    )
  }
  return (
    <div className={s.bar}>
      <Text className={s.text} block>{text}</Text>
    </div>
  )
}
