import { memo, useMemo, useState } from 'react'
import { useTheme } from '../../theme/ThemeContext'
import {
  buildCandlestickOption,
  buildComboBarLineOption,
  buildPieChartOption,
  buildStackedBarOption,
} from './chartOptions'
import { getResearchChartTheme } from './chartTheme'
import type { ChartContentMode } from './chartResponsive'
import type { Dataset } from './types'
import EchartsFill from './EchartsFill'
import {
  buildCandlestickView,
  buildComboChartView,
  buildPieChartView,
  buildStackedBarView,
} from './views'

function useChartMode() {
  return useState<ChartContentMode>('compact')
}

export const StackedBarChartWidget = memo(function StackedBarChartWidget({
  dataset,
  percent,
}: {
  dataset: Dataset
  percent: boolean
}) {
  const { resolvedScheme } = useTheme()
  const theme = useMemo(() => getResearchChartTheme(resolvedScheme), [resolvedScheme])
  const [mode, setMode] = useChartMode()
  const view = useMemo(() => buildStackedBarView(dataset, percent), [dataset, percent])
  const option = useMemo(() => buildStackedBarOption(view, theme, mode), [theme, view, mode])
  return <EchartsFill option={option} onContentModeChange={setMode} />
})

export const ComboBarLineChartWidget = memo(function ComboBarLineChartWidget({
  dataset,
}: {
  dataset: Dataset
}) {
  const { resolvedScheme } = useTheme()
  const theme = useMemo(() => getResearchChartTheme(resolvedScheme), [resolvedScheme])
  const [mode, setMode] = useChartMode()
  const view = useMemo(() => buildComboChartView(dataset), [dataset])
  const option = useMemo(() => buildComboBarLineOption(view, theme, mode), [theme, view, mode])
  return <EchartsFill option={option} onContentModeChange={setMode} />
})

export const PieDonutChartWidget = memo(function PieDonutChartWidget({
  dataset,
  donut,
  period,
}: {
  dataset: Dataset
  donut: boolean
  period?: string
}) {
  const { resolvedScheme } = useTheme()
  const theme = useMemo(() => getResearchChartTheme(resolvedScheme), [resolvedScheme])
  const [mode, setMode] = useChartMode()
  const view = useMemo(() => buildPieChartView(dataset, period), [dataset, period])
  const option = useMemo(
    () => buildPieChartOption(view, theme, donut, mode),
    [theme, view, donut, mode],
  )
  if (!view.slices.length) {
    return <div>这一期没有可展示的正值。换一个年份，或改看柱状对比。</div>
  }
  return <EchartsFill option={option} onContentModeChange={setMode} />
})

export const CandlestickChartWidget = memo(function CandlestickChartWidget({
  dataset,
}: {
  dataset: Dataset
}) {
  const { resolvedScheme } = useTheme()
  const theme = useMemo(() => getResearchChartTheme(resolvedScheme), [resolvedScheme])
  const [mode, setMode] = useChartMode()
  const view = useMemo(() => buildCandlestickView(dataset), [dataset])
  const option = useMemo(
    () => (view ? buildCandlestickOption(view, theme, mode) : null),
    [theme, view, mode],
  )
  if (!view || !option) {
    return <div>还没有可展示的日K。换一只股票或缩短年份后再查一次。</div>
  }
  return <EchartsFill option={option} onContentModeChange={setMode} />
})
