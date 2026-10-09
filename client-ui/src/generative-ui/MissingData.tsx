import { Text } from '@fluentui/react-components'
import type { ResearchUiBlock } from '@opptrix/shared/research-ui-spec'
import type { Dataset } from '../chat/research-canvas/types'
import { BlockFrame, useBlockStyles } from './BlockFrame'
import type { BlockProps } from './types'

type MissingBlock = Extract<ResearchUiBlock, { component: 'MissingData' }>

/** 每家公司缺哪些期：只列位置，不补值 */
export function missingCells(dataset: Dataset): Array<{ name: string; periods: string[] }> {
  const present = new Set(dataset.data.filter(p => p.value != null).map(p => `${p.entityId}\t${p.period}`))
  return dataset.entities
    .map(entity => ({ name: entity.name, periods: dataset.periods.filter(period => !present.has(`${entity.id}\t${period}`)) }))
    .filter(row => row.periods.length > 0)
}

export default function MissingData({ block, getDataset }: BlockProps<MissingBlock>) {
  const s = useBlockStyles()
  const dataset = getDataset(block.datasetId)
  if (!dataset) return null
  const rows = missingCells(dataset)
  return (
    <BlockFrame title={rows.length ? '有数据没取到' : '数据完整'} kind="MissingData">
      {rows.length ? (
        <>
          {rows.map(row => (
            <Text key={row.name} className={s.note} block>{row.name}：{row.periods.join('、')} 年没有取到</Text>
          ))}
          <Text className={s.note} block>图表和表格里这些位置显示为 —，不补值，也不按零处理。可以改看数据完整的年份，或换一个指标。</Text>
        </>
      ) : (
        <Text className={s.note} block>这组数据每家公司每一期都有值。</Text>
      )}
    </BlockFrame>
  )
}
