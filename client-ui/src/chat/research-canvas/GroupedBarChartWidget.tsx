import { memo, useMemo, useState } from 'react'
import { resolveChartStyleAgainstEntities, type ChartStyle } from '@opptrix/shared/research-chart-style'
import { useTheme } from '../../theme/ThemeContext'
import { buildGroupedBarOption } from './chartOptionsGrouped'
import { getResearchChartTheme } from './chartTheme'
import type { ChartContentMode } from './chartResponsive'
import type { Dataset } from './types'
import EchartsFill from './EchartsFill'
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
  const option = useMemo(
    () => buildGroupedBarOption(view, theme, mode, boundStyle),
    [theme, view, mode, boundStyle],
  )
  return <EchartsFill option={option} onContentModeChange={setMode} />
}

export default memo(GroupedBarChartWidget)
