import type { Dataset } from './types'
import { MOCK_GROSS_MARGIN_DATASET } from './mockGrossMarginDataset'
import { sourceProviderLabel } from './sourcePresentation'

export function coverageLabel(dataset: Dataset): string {
  const total = dataset.entities.length * dataset.periods.length
  const keys = new Set(dataset.data.filter(point => point.value != null)
    .map(point => `${point.entityId}\t${point.period}`))
  const present = dataset.entities.reduce((count, entity) => count + dataset.periods
    .filter(period => keys.has(`${entity.id}\t${period}`)).length, 0)
  if (!total) return ''
  if (dataset.metric === 'kline') return `已获取 ${dataset.ohlc?.length ?? 0} 条行情`
  return present === total ? '数据完整' : `部分数据缺失（${present}/${total}）`
}

export function sourceLabel(dataset: Dataset): string {
  const providers = [...new Set(
    dataset.sources
      .map(source => sourceProviderLabel(source.provider))
      .filter(label => label !== '来源未标注'),
  )]
  return providers.join(' · ')
}

export function datasetMetaLine(dataset: Dataset): string {
  if (dataset.id === MOCK_GROSS_MARGIN_DATASET.id) return '示例数据，不用于研究'
  const first = dataset.periods[0] ?? ''
  const last = dataset.periods[dataset.periods.length - 1] ?? first
  const period = first === last ? first : `${first}–${last}`
  return [period, dataset.unit, coverageLabel(dataset)].filter(Boolean).join(' · ')
}

export function datasetSubtitle(dataset: Dataset): string {
  const names = dataset.entities.map(entity => entity.name).join('、')
  const first = dataset.periods[0] ?? ''
  const last = dataset.periods[dataset.periods.length - 1] ?? first
  const years = first && last && first !== last ? `${first}–${last}` : first
  return [names, years].filter(Boolean).join(' · ')
}
