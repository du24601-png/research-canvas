import {
  resolveChartStyleAgainstEntities,
  type ChartStyle,
  type ResearchDataset,
} from '@opptrix/shared'

export function bindChartStyle(
  style: ChartStyle | undefined,
  datasetId: string | undefined,
  records: readonly ResearchDataset[],
): ChartStyle | undefined {
  if (!style || !datasetId) return style
  const record = records.find(item => item.id === datasetId)
  if (!record) return style
  return resolveChartStyleAgainstEntities(style, record.entities)
}
