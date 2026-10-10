import { memo, useCallback, useMemo, useState, type ReactNode } from 'react'
import type { ChartStyle } from '@opptrix/shared/research-chart-style'
import { useTheme } from '../../../theme/ThemeContext'
import type { ChartContentMode } from '../chartResponsive'
import { getResearchChartTheme } from '../chartTheme'
import SourceCitationBar from '../SourceCitationBar'
import type { ResearchCellRef } from '../sourceLookup'
import type { Dataset, WidgetType } from '../types'
import { buildVegaSpec } from './buildVegaSpec'
import { cellFromDatum } from './cellFromDatum'
import VegaFill from './VegaFill'

interface Props {
  type: WidgetType
  dataset: Dataset
  period?: string
  topN?: number
  style?: ChartStyle
  /** Vega 加载或渲染失败时退回的原渲染器 */
  fallback: ReactNode
}

function chartAriaLabel(dataset: Dataset): string {
  const names = dataset.entities.map(entity => entity.name).join('、')
  const periods = dataset.periods.length
    ? `${dataset.periods[0]}至${dataset.periods[dataset.periods.length - 1]}`
    : ''
  return [dataset.title, names && `公司：${names}`, periods && `期间：${periods}`].filter(Boolean).join('；')
}

type Anchor = ResearchCellRef & { x: number; y: number }

/** Vega-Lite 版图表 + 点击图元弹出来源条（与 ECharts 版同一个来源面板） */
function VegaChart({ type, dataset, period, topN, style, fallback }: Props) {
  const { resolvedScheme } = useTheme()
  const theme = useMemo(() => getResearchChartTheme(resolvedScheme), [resolvedScheme])
  const [mode, setMode] = useState<ChartContentMode>('compact')
  const [failed, setFailed] = useState(false)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const built = useMemo(
    () => buildVegaSpec({ type, dataset, theme, mode, style, period, topN }),
    [type, dataset, theme, mode, style, period, topN],
  )
  const handleClick = useCallback((datum: unknown, x: number, y: number) => {
    const cell = cellFromDatum(datum)
    if (cell) setAnchor({ ...cell, x, y })
  }, [])
  const ariaLabel = useMemo(() => chartAriaLabel(dataset), [dataset])
  const handleError = useCallback(() => setFailed(true), [])

  if (failed || !built) return <>{fallback}</>
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, minWidth: 0 }}>
      <VegaFill
        spec={built.spec}
        onContentModeChange={setMode}
        onDatumClick={handleClick}
        onError={handleError}
        ariaLabel={ariaLabel}
      />
      {anchor ? (
        <SourceCitationBar
          dataset={dataset}
          entityId={anchor.entityId}
          period={anchor.period}
          onDismiss={() => setAnchor(null)}
          style={{
            position: 'absolute',
            left: anchor.x,
            top: anchor.y,
            transform: 'translate(-50%, calc(-100% - 10px))',
            zIndex: 6,
            pointerEvents: 'auto',
          }}
        />
      ) : null}
    </div>
  )
}

export default memo(VegaChart)
