import { memo, useMemo, useState } from 'react'
import { useTheme } from '../../theme/ThemeContext'
import { buildHeatmapOption } from './chartOptionsHeatmap'
import { getResearchChartTheme } from './chartTheme'
import type { ChartContentMode } from './chartResponsive'
import type { Dataset } from './types'
import EchartsFill from './EchartsFill'
import { buildHeatmapView } from './views'

function HeatmapWidget({ dataset }: { dataset: Dataset }) {
  const { resolvedScheme } = useTheme()
  const theme = useMemo(() => getResearchChartTheme(resolvedScheme), [resolvedScheme])
  const [mode, setMode] = useState<ChartContentMode>('compact')
  const view = useMemo(() => buildHeatmapView(dataset), [dataset])
  const option = useMemo(() => buildHeatmapOption(view, theme, mode), [theme, view, mode])
  if (!view.cells.some(cell => cell[2] != null)) {
    return <div>这一段没有可展示的数字。换一个年份范围，或改看表格。</div>
  }
  return <EchartsFill option={option} onContentModeChange={setMode} />
}

export default memo(HeatmapWidget)
