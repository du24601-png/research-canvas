import { memo, useCallback, useMemo, useState } from 'react'
import type { CallbackDataParams } from 'echarts/types/dist/shared'
import { useTheme } from '../../theme/ThemeContext'
import { buildBarChartOption } from './chartOptions'
import { getResearchChartTheme } from './chartTheme'
import type { ChartContentMode } from './chartResponsive'
import { resolveChartStyleAgainstEntities, type ChartStyle } from '@opptrix/shared/research-chart-style'
import type { Dataset } from './types'
import ChartWithSourceSelection from './ChartWithSourceSelection'
import { resolveBarChartCell } from './chartSourceClick'
import { buildBarChartView } from './views'

interface Props {
  dataset: Dataset
  period?: string
  style?: ChartStyle
}

function BarChartWidget({ dataset, period, style }: Props) {
  const { resolvedScheme } = useTheme()
  const theme = useMemo(() => getResearchChartTheme(resolvedScheme), [resolvedScheme])
  const [mode, setMode] = useState<ChartContentMode>('compact')
  const view = useMemo(() => buildBarChartView(dataset, period), [dataset, period])
  const boundStyle = useMemo(
    () => resolveChartStyleAgainstEntities(style, dataset.entities),
    [style, dataset.entities],
  )
  const option = useMemo(
    () => buildBarChartOption(view, theme, mode, boundStyle),
    [theme, view, mode, boundStyle],
  )
  const resolveCell = useCallback(
    (params: CallbackDataParams) => resolveBarChartCell(view, params),
    [view],
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

export default memo(BarChartWidget)
