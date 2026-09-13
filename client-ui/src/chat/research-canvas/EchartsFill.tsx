import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { chartContentMode, nextChartContentMode, type ChartContentMode } from './chartResponsive'

interface Props {
  option: EChartsOption
  onContentModeChange?: (mode: ChartContentMode) => void
}

/** 填满父容器的 ECharts；尺寸变化经 RAF 合并，每帧最多 resize 一次。 */
export default function EchartsFill({ option, onContentModeChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const rafRef = useRef<number | null>(null)
  const modeRef = useRef<ChartContentMode>('wide')
  const onModeRef = useRef(onContentModeChange)
  onModeRef.current = onContentModeChange

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const chart = echarts.init(host, undefined, { renderer: 'canvas' })
    chartRef.current = chart
    modeRef.current = chartContentMode(host.clientWidth, host.clientHeight)
    onModeRef.current?.(modeRef.current)

    const flush = () => {
      rafRef.current = null
      chart.resize()
      const next = nextChartContentMode(modeRef.current, host.clientWidth, host.clientHeight)
      if (!next) return
      modeRef.current = next
      onModeRef.current?.(next)
    }

    const schedule = () => {
      if (rafRef.current != null) return
      rafRef.current = window.requestAnimationFrame(flush)
    }

    const ro = new ResizeObserver(schedule)
    ro.observe(host)

    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      ro.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.setOption(option, true)
    if (rafRef.current != null) return
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      chart.resize()
    })
  }, [option])

  return (
    <div
      ref={hostRef}
      style={{ width: '100%', height: '100%', minHeight: 0, minWidth: 0 }}
      role="img"
      aria-hidden
    />
  )
}
