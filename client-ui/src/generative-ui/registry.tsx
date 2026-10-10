import type { ReactElement } from 'react'
import {
  parseResearchUiSpec,
  type ResearchUiBlock,
  type ResearchUiDatasetRef,
  type ResearchUiSpecResult,
} from '@opptrix/shared/research-ui-spec'
import type { Dataset } from '../chat/research-canvas/types'
import ComparisonView from './ComparisonView'
import EvidencePanel from './EvidencePanel'
import KeyPoints from './KeyPoints'
import KpiRow from './KpiRow'
import MetricTable from './MetricTable'
import MissingData from './MissingData'
import NumberSentence from './NumberSentence'
import TrendView from './TrendView'
import type { SpecActionHandler } from './types'

/** 已注册组件。新增组件要同时进 shared 的 RESEARCH_UI_COMPONENTS 和这里 */
export function renderBlock(
  block: ResearchUiBlock,
  key: string,
  getDataset: (id: string) => Dataset | undefined,
  onAction?: SpecActionHandler,
): ReactElement {
  if (block.component === 'ComparisonView') return <ComparisonView key={key} block={block} getDataset={getDataset} onAction={onAction} />
  if (block.component === 'TrendView') return <TrendView key={key} block={block} getDataset={getDataset} onAction={onAction} />
  if (block.component === 'KpiRow') return <KpiRow key={key} block={block} getDataset={getDataset} />
  if (block.component === 'NumberSentence') return <NumberSentence key={key} block={block} getDataset={getDataset} />
  if (block.component === 'MetricTable') return <MetricTable key={key} block={block} getDataset={getDataset} />
  if (block.component === 'KeyPoints') return <KeyPoints key={key} block={block} getDataset={getDataset} />
  if (block.component === 'EvidencePanel') return <EvidencePanel key={key} block={block} getDataset={getDataset} />
  return <MissingData key={key} block={block} getDataset={getDataset} />
}

export function datasetRefs(datasets: readonly Dataset[]): Map<string, ResearchUiDatasetRef> {
  return new Map(datasets.map(dataset => [dataset.id, {
    entityIds: dataset.entities.map(entity => entity.id),
    periods: [...dataset.periods],
    ...(dataset.parentDatasetId ? { parentDatasetId: dataset.parentDatasetId } : {}),
    ...(dataset.transform ? { transformType: dataset.transform.type } : {}),
  }]))
}

/** 只认本轮已知 Dataset；任何不合规整份拒绝 */
export function validateSpec(raw: unknown, datasets: readonly Dataset[]): ResearchUiSpecResult {
  return parseResearchUiSpec(raw, datasetRefs(datasets))
}
