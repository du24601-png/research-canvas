import { useState } from 'react'
import { Text } from '@fluentui/react-components'
import type { ResearchUiBlock } from '@opptrix/shared/research-ui-spec'
import PreviewPlot from '../chat/research-canvas/PreviewPlot'
import { ViewSwitcher } from '../chat/research-canvas/ViewSwitcher'
import { researchMetricLabel } from '../chat/research-canvas/sourcePresentation'
import type { Dataset } from '../chat/research-canvas/types'
import { BlockFrame, useBlockStyles } from './BlockFrame'
import { hostActions, periodRange, type BlockProps, type BlockView } from './types'

type ComparisonBlock = Extract<ResearchUiBlock, { component: 'ComparisonView' }>

/** 多个 Dataset 纵向排列（F3-A）：每个数据集原样画一张图，不合并、不改值；图种 / 年份切换对几张图同时生效 */
export default function ComparisonView({ block, getDataset, onAction }: BlockProps<ComparisonBlock>) {
  const s = useBlockStyles()
  const [view, setView] = useState<BlockView>({ type: 'line_chart' })
  const datasets = block.datasetIds.map(getDataset).filter((d): d is Dataset => Boolean(d))
  const title = block.title ?? datasets.map(d => researchMetricLabel(d.metric)).join('与') + '对比'
  const first = datasets[0]
  return (
    <BlockFrame title={title} kind="ComparisonView" actions={hostActions(block, onAction, view)}>
      {first ? (
        <ViewSwitcher dataset={first} type={view.type} period={view.period} onChange={next => setView({ type: next.type, period: next.period })} />
      ) : null}
      <div className={s.grid}>
        {datasets.map(dataset => (
          <div key={dataset.id} className={s.gridItem} data-dataset-id={dataset.id}>
            <Text className={s.note} block>
              {researchMetricLabel(dataset.metric)}（{dataset.unit || '单位未记录'}）· {periodRange(dataset)}
            </Text>
            <div className={s.plot} data-view-type={view.type}>
              <PreviewPlot type={view.type} dataset={dataset} period={view.period} />
            </div>
          </div>
        ))}
      </div>
    </BlockFrame>
  )
}
