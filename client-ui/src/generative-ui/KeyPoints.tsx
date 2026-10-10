import { makeStyles, mergeClasses } from '@fluentui/react-components'
import { computeKeyPoints, type KeyPoint } from '@opptrix/shared/research-key-points'
import type { ResearchUiBlock } from '@opptrix/shared/research-ui-spec'
import { opptrixCssVars } from '../theme/tokens'
import type { Dataset } from '../chat/research-canvas/types'
import { BlockFrame } from './BlockFrame'
import { SentenceContent } from './CitationChip'
import { sentenceParts, type SentencePart } from './numberText'
import type { BlockProps } from './types'

type PointsBlock = Extract<ResearchUiBlock, { component: 'KeyPoints' }>

const useStyles = makeStyles({
  list: { margin: 0, paddingLeft: '1.2em', display: 'flex', flexDirection: 'column', gap: '6px' },
  item: { fontSize: 'var(--opptrix-font-lg)', lineHeight: 1.7, color: opptrixCssVars.textPrimary },
  missing: { listStyleType: 'none', marginLeft: '-1.2em', color: opptrixCssVars.textSecondary },
  dot: {
    display: 'inline-block',
    width: '7px',
    height: '7px',
    marginRight: '8px',
    borderRadius: '50%',
    backgroundColor: opptrixCssVars.warning,
    verticalAlign: 'middle',
  },
})

export interface RenderedKeyPoint {
  point: KeyPoint
  parts: SentencePart[]
}

/** 要点 = shared 代码挑的信号 + 固定模板；数字由 sentenceParts 从 Dataset 填成引用 chip */
export function renderedKeyPoints(datasets: readonly Dataset[]): RenderedKeyPoint[] {
  return computeKeyPoints(datasets).flatMap(point => {
    const dataset = datasets.find(item => item.id === point.datasetId)
    return dataset ? [{ point, parts: sentenceParts(dataset, point.template) }] : []
  })
}

export default function KeyPoints({ block, getDataset }: BlockProps<PointsBlock>) {
  const s = useStyles()
  const datasets = block.datasetIds.map(getDataset).filter((d): d is Dataset => Boolean(d))
  const points = renderedKeyPoints(datasets)
  if (!points.length) return null
  return (
    <BlockFrame title="要点" kind="KeyPoints">
      <ul className={s.list}>
        {points.map(({ point, parts }) => (
          <li
            key={`${point.kind}-${point.datasetId}-${point.entityIds.join('-')}`}
            className={mergeClasses(s.item, point.kind === 'missing' && s.missing)}
            data-key-point={point.kind}
          >
            {point.kind === 'missing' ? <span className={s.dot} aria-hidden /> : null}
            <SentenceContent parts={parts} />
          </li>
        ))}
      </ul>
    </BlockFrame>
  )
}
