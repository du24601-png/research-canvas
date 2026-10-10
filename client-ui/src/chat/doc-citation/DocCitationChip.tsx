import { useState, type ReactNode } from 'react'
import { makeStyles, mergeClasses } from '@fluentui/react-components'
import { opptrixCssVars, opptrixTokens } from '../../theme/tokens'
import { docCitationLabel, textOfChildren, type DocCitationTarget } from './docCitationLink'
import { useOpenDocCitation } from './useOpenDocCitation'

/** 与 generative-ui/CitationChip 同一浅蓝样式（不引其内部模块，避免依赖缠绕） */
const useStyles = makeStyles({
  chip: {
    display: 'inline-block',
    padding: '0 6px',
    margin: '0 2px',
    border: 'none',
    borderRadius: opptrixTokens.radiusMd,
    backgroundColor: 'rgba(10, 132, 255, 0.12)',
    color: 'inherit',
    font: 'inherit',
    fontSize: '0.92em',
    lineHeight: 'inherit',
    fontVariantNumeric: 'tabular-nums',
    verticalAlign: 'baseline',
    cursor: 'pointer',
    ':hover': { backgroundColor: 'rgba(10, 132, 255, 0.2)' },
    ':focus-visible': { outline: '2px solid rgba(10, 132, 255, 0.6)', outlineOffset: '1px' },
  },
  muted: {
    cursor: 'default',
    color: opptrixCssVars.textSecondary,
    ':hover': { backgroundColor: 'rgba(10, 132, 255, 0.12)' },
  },
})

type ChipProps = {
  target: DocCitationTarget
  text: string
  /** 缺省时只展示、不可点（例如不在对话界面内渲染） */
  onOpen?: (target: DocCitationTarget) => void
  unavailable?: boolean
}

/** 「《文件名》p.37」引用 chip：点击打开原文件并跳到该页 */
export function DocCitationChip({ target, text, onOpen, unavailable = false }: ChipProps) {
  const s = useStyles()
  const label = docCitationLabel(text, target.page)
  if (!onOpen || unavailable) {
    const hint = unavailable ? '暂时找不到这份文件，可以在资料库里确认后重新上传' : `出处：${text}`
    return (
      <span className={mergeClasses(s.chip, s.muted)} title={hint} data-doc-citation-page={target.page}>
        {label}
      </span>
    )
  }
  return (
    <button
      type="button"
      className={s.chip}
      title={`打开原文：${text}`}
      aria-label={`打开原文 ${label}`}
      data-doc-citation-page={target.page}
      onClick={event => {
        event.stopPropagation()
        onOpen(target)
      }}
    >
      {label}
    </button>
  )
}

/** markdown 里的引用链接：接到预览面板；找不到文件时降级为不可点 chip */
export function DocCitationLink({ target, children, sessionId }: {
  target: DocCitationTarget
  children?: ReactNode
  sessionId?: string | null
}) {
  const open = useOpenDocCitation(sessionId)
  const [unavailable, setUnavailable] = useState(false)
  const text = textOfChildren(children)
  const name = /《([^》]+)》/.exec(text)?.[1]?.trim() || undefined
  const handleOpen = open
    ? (t: DocCitationTarget) => {
      void open(t, name).then(ok => setUnavailable(!ok))
    }
    : undefined
  return (
    <DocCitationChip
      target={target}
      text={text}
      onOpen={handleOpen}
      unavailable={unavailable}
    />
  )
}
