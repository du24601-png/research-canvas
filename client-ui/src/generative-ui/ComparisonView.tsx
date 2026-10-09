import { Text } from '@fluentui/react-components'
import type { ResearchUiBlock } from '@opptrix/shared/research-ui-spec'
import LineChartWidget from '../chat/research-canvas/LineChartWidget'
import { researchMetricLabel } from '../chat/research-canvas/sourcePresentation'
import type { Dataset } from '../chat/research-canvas/types'
import { BlockFrame, useBlockStyles } from './BlockFrame'
import { hostActions, periodRange, type BlockProps } from './types'

type ComparisonBlock = Extract<ResearchUiBlock, { component: 'ComparisonView' }>

/** 多个 Dataset 并排（F3-A）：每个数据集原样画一张图，不合并、不改值 */
export default function ComparisonView({ block, getDataset, onAction }: BlockProps<ComparisonBlock>) {
  const s = useBlockStyles()
  const datasets = block.datasetIds.map(getDataset).filter((d): d is Dataset => Boolean(d))
  const title = block.title ?? datasets.map(d => researchMetricLabel(d.metric)).join('与') + '对比'
  return (
    <BlockFrame title={title} kind="ComparisonView" actions={hostActions(block, onAction)}>
      <div className={s.grid}>
        {datasets.map(dataset => (
          <div key={dataset.id} data-dataset-id={dataset.id}>
            <Text className={s.note} block>
              {researchMetricLabel(dataset.metric)}（{dataset.unit || '单位未记录'}）· {periodRange(dataset)}
            </Text>
            <div className={s.plot}>
              <LineChartWidget dataset={dataset} />
            </div>
          </div>
        ))}
      </div>
    </BlockFrame>
  )
}
