import { useState } from 'react'
import { Text } from '@fluentui/react-components'
import type { ResearchUiBlock } from '@opptrix/shared/research-ui-spec'
import { largestAbsDelta, yoyDeltaDataset } from '@opptrix/shared/research-dataset-delta'
import PreviewPlot from '../chat/research-canvas/PreviewPlot'
import { ViewSwitcher } from '../chat/research-canvas/ViewSwitcher'
import { researchMetricLabel } from '../chat/research-canvas/sourcePresentation'
import type { Dataset } from '../chat/research-canvas/types'
import { BlockFrame, useBlockStyles } from './BlockFrame'
import { hostActions, periodRange, type BlockProps, type BlockView } from './types'

type TrendBlock = Extract<ResearchUiBlock, { component: 'TrendView' }>

/** 「变化最大的一处」：数字取自同比变化 Dataset（代码已算好），这里只挑最大并照抄 */
export function largestChangeNote(dataset: Dataset, delta: Dataset): string | null {
  const best = largestAbsDelta(delta)
  if (!best || best.value == null) return null
  const name = dataset.entities.find(entity => entity.id === best.entityId)?.name ?? best.entityId
  const sign = best.value > 0 ? '+' : best.value < 0 ? '−' : ''
  return `${name} ${best.period} 年较上年 ${sign}${Math.abs(best.value)} ${delta.unit}，是这组数据里变化最大的一处。`
}

/** Spec 没给同比变化数据集时就地用同一份 shared 代码计算 */
function localDelta(dataset: Dataset): Dataset | undefined {
  const body = yoyDeltaDataset(dataset)
  if ('error' in body) return undefined
  return { ...body, id: `${dataset.id}-yoy-local`, parentDatasetId: dataset.id, transform: { type: 'yoy_delta' } }
}

export default function TrendView({ block, getDataset, onAction }: BlockProps<TrendBlock>) {
  const s = useBlockStyles()
  const [highlight, setHighlight] = useState(false)
  const [view, setView] = useState<BlockView>({ type: 'line_chart' })
  const dataset = getDataset(block.datasetId)
  if (!dataset) return null
  const delta = block.deltaDatasetId ? getDataset(block.deltaDatasetId) : localDelta(dataset)
  const canHighlight = Boolean(delta && block.actions?.includes('highlight_largest_change'))
  const actions = [
    ...(canHighlight ? [{
      key: 'highlight_largest_change',
      label: highlight ? '取消高亮' : '看变化最大的年份',
      pressed: highlight,
      onClick: () => setHighlight(value => !value),
    }] : []),
    ...hostActions(block, onAction, view),
  ]
  const note = highlight && delta ? largestChangeNote(dataset, delta) : null
  return (
    <BlockFrame title={block.title ?? view.title ?? `${researchMetricLabel(dataset.metric)}走势`} kind="TrendView" actions={actions}>
      <Text className={s.note} block>{dataset.unit || '单位未记录'} · {periodRange(dataset)}</Text>
      <ViewSwitcher dataset={dataset} type={view.type} period={view.period} onChange={next => setView({ type: next.type, period: next.period, title: next.title })} />
      <div className={s.plot} data-view-type={view.type}>
        <PreviewPlot type={view.type} dataset={dataset} period={view.period} />
      </div>
      {note ? <Text className={s.note} block data-largest-change>由代码计算：{note}</Text> : null}
    </BlockFrame>
  )
}
