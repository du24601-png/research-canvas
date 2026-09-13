import { memo, useCallback, useMemo, useState } from 'react'
import type { CallbackDataParams } from 'echarts/types/dist/shared'
import { useTheme } from '../../theme/ThemeContext'
import { buildLineChartOption } from './chartOptions'
import { getResearchChartTheme } from './chartTheme'
import type { ChartContentMode } from './chartResponsive'
import { resolveChartStyleAgainstEntities, type ChartStyle } from '@opptrix/shared/research-chart-style'
import type { Dataset } from './types'
import ChartWithSourceSelection from './ChartWithSourceSelection'
import { resolveLineChartCell } from './chartSourceClick'
import { buildLineChartView } from './views'

interface Props {
  dataset: Dataset
  topN?: number
  style?: ChartStyle
}

function LineChartWidget({ dataset, topN, style }: Props) {
  const { resolvedScheme } = useTheme()
  const theme = useMemo(() => getResearchChartTheme(resolvedScheme), [resolvedScheme])
  const [mode, setMode] = useState<ChartContentMode>('compact')
  const view = useMemo(() => buildLineChartView(dataset, topN), [dataset, topN])
  const boundStyle = useMemo(
    () => resolveChartStyleAgainstEntities(style, dataset.entities),
    [style, dataset.entities],
  )
  const option = useMemo(
    () => buildLineChartOption(view, theme, mode, boundStyle),
    [theme, view, mode, boundStyle],
  )
  const resolveCell = useCallback(
    (params: CallbackDataParams) => resolveLineChartCell(view, boundStyle, params),
    [view, boundStyle],
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

export default memo(LineChartWidget)
