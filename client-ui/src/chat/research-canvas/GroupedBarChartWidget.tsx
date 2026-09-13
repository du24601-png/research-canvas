import { memo, useCallback, useMemo, useState } from 'react'
import type { CallbackDataParams } from 'echarts/types/dist/shared'
import { resolveChartStyleAgainstEntities, type ChartStyle } from '@opptrix/shared/research-chart-style'
import { useTheme } from '../../theme/ThemeContext'
import { buildGroupedBarOption } from './chartOptionsGrouped'
import { getResearchChartTheme } from './chartTheme'
import type { ChartContentMode } from './chartResponsive'
import type { Dataset } from './types'
import ChartWithSourceSelection from './ChartWithSourceSelection'
import { resolveGroupedBarCell } from './chartSourceClick'
import { isSeriesVisible } from './chartStyleApply'
import { buildGroupedBarView } from './views'

interface Props {
  dataset: Dataset
  style?: ChartStyle
}

function GroupedBarChartWidget({ dataset, style }: Props) {
  const { resolvedScheme } = useTheme()
  const theme = useMemo(() => getResearchChartTheme(resolvedScheme), [resolvedScheme])
  const [mode, setMode] = useState<ChartContentMode>('compact')
  const view = useMemo(() => buildGroupedBarView(dataset), [dataset])
  const boundStyle = useMemo(
    () => resolveChartStyleAgainstEntities(style, dataset.entities),
    [style, dataset.entities],
  )
  const visibleEntityIds = useMemo(
    () => view.series.filter(item => isSeriesVisible(item.entityId, boundStyle)).map(item => item.entityId),
    [view.series, boundStyle],
  )
  const option = useMemo(
    () => buildGroupedBarOption(view, theme, mode, boundStyle),
    [theme, view, mode, boundStyle],
  )
  const resolveCell = useCallback(
    (params: CallbackDataParams) => resolveGroupedBarCell(dataset, view.periods, visibleEntityIds, params),
    [dataset, view.periods, visibleEntityIds],
  )

  return (
    <ChartWithSourceSelection
      dataset={dataset}
      option={option}
      onContentModeChange={setMode}
      resolveCell={resolveCell}
    />
  )
}

export default memo(GroupedBarChartWidget)
