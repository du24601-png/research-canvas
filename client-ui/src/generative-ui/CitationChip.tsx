import { makeStyles, mergeClasses, Tooltip, type TooltipProps } from '@fluentui/react-components'
import { opptrixCssVars, opptrixTokens } from '../theme/tokens'
import type { Citation, SentencePart } from './numberText'

const useStyles = makeStyles({
  chip: {
    display: 'inline-block',
    padding: '0 6px',
    margin: '0 2px',
    borderRadius: opptrixTokens.radiusMd,
    backgroundColor: 'rgba(10, 132, 255, 0.12)',
    fontFamily: 'var(--opptrix-font-mono)',
    fontVariantNumeric: 'tabular-nums',
    cursor: 'help',
    ':focus-visible': { outline: '2px solid rgba(10, 132, 255, 0.6)', outlineOffset: '1px' },
  },
  index: { fontSize: '11px', marginLeft: '2px', color: opptrixCssVars.textSecondary },
  tip: { display: 'flex', flexDirection: 'column', gap: '2px', fontSize: 'var(--opptrix-font-md)' },
})

/** 来源浮层：公司、期间、指标口径与来源（只显示 Dataset 里记录了的） */
export function CitationTip({ citation }: { citation: Citation }) {
  const s = useStyles()
  return (
    <span className={s.tip}>
      <strong>{citation.entity ? `${citation.entity} · ${citation.period}` : citation.period}</strong>
      {citation.lines.map(line => <span key={line}>{line}</span>)}
    </span>
  )
}

/** 任意元素加上来源浮层（悬停或键盘聚焦都能看到） */
export function WithCitation({ citation, children }: { citation: Citation; children: TooltipProps['children'] }) {
  return (
    <Tooltip relationship="description" withArrow content={<CitationTip citation={citation} />}>
      {children}
    </Tooltip>
  )
}

/** 浅蓝引用 chip：数字由代码算好传进来，这里只负责展示和来源浮层 */
export function CitationChip({ text, index, citation, className }: { text: string; index: number; citation: Citation; className?: string }) {
  const s = useStyles()
  return (
    <WithCitation citation={citation}>
      <span className={mergeClasses(s.chip, className)} tabIndex={0} data-citation-index={index}>
        {text}
        <sup className={s.index}>{index}</sup>
      </span>
    </WithCitation>
  )
}

/** 文本段 + 引用 chip 的一串内容（NumberSentence 与 KeyPoints 共用） */
export function SentenceContent({ parts }: { parts: readonly SentencePart[] }) {
  return (
    <>
      {parts.map((part, i) => part.kind === 'text'
        ? <span key={i}>{part.text}</span>
        : <CitationChip key={i} text={part.text} index={part.index} citation={part.citation} />)}
    </>
  )
}
