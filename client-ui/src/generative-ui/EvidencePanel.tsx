import { Fragment } from 'react'
import { Text } from '@fluentui/react-components'
import type { ResearchUiBlock } from '@opptrix/shared/research-ui-spec'
import { coverageLabel } from '../chat/research-canvas/datasetLabels'
import { readableFetchTime, researchMetricLabel, sourceProviderLabel } from '../chat/research-canvas/sourcePresentation'
import type { Dataset } from '../chat/research-canvas/types'
import { BlockFrame, useBlockStyles } from './BlockFrame'
import { periodRange, type BlockProps } from './types'

type EvidenceBlock = Extract<ResearchUiBlock, { component: 'EvidencePanel' }>

/** 来源名去重；Provider 为 mixed / unknown 时显示「来源未标注」，不猜 */
export function evidenceSourceText(dataset: Dataset): string {
  const labels = [...new Set(dataset.sources.map(source => sourceProviderLabel(source.provider)))]
  return labels.length ? labels.join(' · ') : '来源未标注'
}

export function evidenceFetchText(dataset: Dataset): string {
  const times = dataset.sources.map(source => source.fetchedAt).filter(Boolean).sort()
  const latest = times[times.length - 1] ?? dataset.createdAt
  return latest ? readableFetchTime(latest) : '获取时间未记录'
}

function EvidenceRows({ dataset }: { dataset: Dataset }) {
  const s = useBlockStyles()
  const period = periodRange(dataset)
  const rows: Array<[string, string]> = [
    ['指标', `${researchMetricLabel(dataset.metric)}（${dataset.unit || '单位未记录'}）`],
    ['来源', evidenceSourceText(dataset)],
    ['报告期', period ? `${period} 年报` : '未记录'],
    ['获取', evidenceFetchText(dataset)],
    ['覆盖', `${coverageLabel(dataset) || '未记录'}，缺失显示为 —，不补值`],
  ]
  return (
    <div className={s.rows} data-dataset-id={dataset.id}>
      {rows.map(([label, value]) => (
        <Fragment key={label}>
          <Text className={s.label}>{label}</Text>
          <Text>{value}</Text>
        </Fragment>
      ))}
    </div>
  )
}

export default function EvidencePanel({ block, getDataset }: BlockProps<EvidenceBlock>) {
  const s = useBlockStyles()
  const datasets = block.datasetIds.map(getDataset).filter((d): d is Dataset => Boolean(d))
  return (
    <BlockFrame title="来源与口径" kind="EvidencePanel">
      {datasets.map(dataset => <EvidenceRows key={dataset.id} dataset={dataset} />)}
      <Text className={s.note} block>获取时间不等于报告披露时间；目前能追到数据源和报告期，还不能定位到公告原文页。</Text>
    </BlockFrame>
  )
}
