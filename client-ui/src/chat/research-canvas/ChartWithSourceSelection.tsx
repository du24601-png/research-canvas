import { useCallback, useRef, useState } from 'react'
import type { EChartsOption } from 'echarts'
import type { CallbackDataParams } from 'echarts/types/dist/shared'
import EchartsFill from './EchartsFill'
import SourceCitationBar from './SourceCitationBar'
import type { ResearchCellRef } from './sourceLookup'
import type { ChartContentMode } from './chartResponsive'
import type { Dataset } from './types'

interface Props {
  dataset: Dataset
  option: EChartsOption
  onContentModeChange?: (mode: ChartContentMode) => void
  resolveCell: (params: CallbackDataParams) => ResearchCellRef | null
}

export default function ChartWithSourceSelection({
  dataset,
  option,
  onContentModeChange,
  resolveCell,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<(ResearchCellRef & { x: number; y: number }) | null>(null)

  const handleChartClick = useCallback((params: CallbackDataParams, offsetX: number, offsetY: number) => {
    const cell = resolveCell(params)
    if (!cell) return
    setAnchor({ ...cell, x: offsetX, y: offsetY })
  }, [resolveCell])

  return (
    <div
      ref={hostRef}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, minWidth: 0 }}
    >
      <EchartsFill
        option={option}
        onContentModeChange={onContentModeChange}
        onChartClick={handleChartClick}
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
