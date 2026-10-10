import { makeStyles, Tooltip } from '@fluentui/react-components'
import type { ResearchUiBlock } from '@opptrix/shared/research-ui-spec'
import { opptrixCssVars, opptrixTokens } from '../theme/tokens'
import { sentenceParts, type Citation } from './numberText'
import type { BlockProps } from './types'

type SentenceBlock = Extract<ResearchUiBlock, { component: 'NumberSentence' }>

const useStyles = makeStyles({
  sentence: { margin: '4px 0 12px', fontSize: '19px', lineHeight: 1.7, color: opptrixCssVars.textPrimary },
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

function CitationTip({ citation }: { citation: Citation }) {
  const s = useStyles()
  return (
    <span className={s.tip}>
      <strong>{citation.entity ? `${citation.entity} · ${citation.period}` : citation.period}</strong>
      {citation.lines.map(line => <span key={line}>{line}</span>)}
    </span>
  )
}

/** 一句结论：文字来自模板，每个数字是代码从 Dataset 取/算的引用 chip，悬停或聚焦看来源 */
export default function NumberSentence({ block, getDataset }: BlockProps<SentenceBlock>) {
  const s = useStyles()
  const dataset = getDataset(block.datasetId)
  if (!dataset) return null
  const parts = sentenceParts(dataset, block.template)
  return (
    <p className={s.sentence} data-generative-ui-block="NumberSentence">
      {parts.map((part, i) => part.kind === 'text' ? <span key={i}>{part.text}</span> : (
        <Tooltip key={i} relationship="description" withArrow content={<CitationTip citation={part.citation} />}>
          <span className={s.chip} tabIndex={0} data-citation-index={part.index}>
            {part.text}
            <sup className={s.index}>{part.index}</sup>
          </span>
        </Tooltip>
      ))}
    </p>
  )
}
