import { useEffect, useRef } from 'react'
import { makeStyles } from '@fluentui/react-components'
import { opptrixCssVars } from '../theme/tokens'

const FADE_PX = 12
const LINE_HEIGHT = 1.65
const VISIBLE_LINES = 8

const MASK = `linear-gradient(to bottom, transparent 0, #000 ${FADE_PX}px, #000 calc(100% - ${Math.round(FADE_PX * 0.55)}px), transparent 100%)`

const useStyles = makeStyles({
  root: {
    alignSelf: 'stretch',
    maxHeight: `calc(var(--opptrix-font-lg) * ${LINE_HEIGHT} * ${VISIBLE_LINES})`,
    overflow: 'hidden',
    padding: '12px 14px 14px',
    boxSizing: 'border-box',
    maskImage: MASK,
    WebkitMaskImage: MASK,
  },
  rootFlat: {
    padding: '12px 14px 14px',
    maskImage: 'none',
    WebkitMaskImage: 'none',
    maxHeight: 'none',
    overflow: 'visible',
  },
  text: {
    margin: 0,
    padding: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontSize: 'var(--opptrix-font-lg)',
    lineHeight: LINE_HEIGHT,
    color: opptrixCssVars.textPrimary,
    fontFamily: 'inherit',
  },
  caret: {
    display: 'inline-block',
    width: '2px',
    height: '1em',
    marginLeft: '2px',
    background: opptrixCssVars.textTertiary,
    verticalAlign: 'text-bottom',
  },
})

interface Props {
  draft: string
  /** 已在 ChatStreamReplyShell 内时去掉渐隐裁切 */
  embedded?: boolean
}

export default function ChatReplyDraftPreview({ draft, embedded = false }: Props) {
  const s = useStyles()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (embedded) return
    const el = scrollRef.current
    if (!el) return
    const reduced = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({
      top: el.scrollHeight,
      behavior: reduced ? 'auto' : 'smooth',
    })
  }, [draft, embedded])

  if (!draft) return null

  return (
    <div
      ref={scrollRef}
      className={embedded ? s.rootFlat : s.root}
      aria-live="polite"
      aria-label="正在整理的回复"
    >
      <p className={s.text}>
        {draft}
        <span className={s.caret} aria-hidden />
      </p>
    </div>
  )
}
