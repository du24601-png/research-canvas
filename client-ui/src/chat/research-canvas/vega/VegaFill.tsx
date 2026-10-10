import { useEffect, useRef, useState } from 'react'
import { chartContentMode, type ChartContentMode } from '../chartResponsive'
import type { JsonObject } from './specCommon'

interface Props {
  spec: JsonObject
  onContentModeChange?: (mode: ChartContentMode) => void
  /** 点击到图元时给出该行数据与相对容器的坐标 */
  onDatumClick?: (datum: unknown, offsetX: number, offsetY: number) => void
  onError?: () => void
  /** 给读屏用的图表描述 */
  ariaLabel?: string
}

interface Size { width: number; height: number }

/** 被点到的是整条折线（datum 只是首行）时不能当作单元格 */
function isCellItem(item: unknown): item is { datum: unknown } {
  if (typeof item !== 'object' || item === null || !('datum' in item)) return false
  const mark = 'mark' in item ? item.mark : undefined
  const markType = typeof mark === 'object' && mark !== null && 'marktype' in mark ? mark.marktype : undefined
  return markType !== 'line' && markType !== 'group'
}

async function loadVega() {
  const [vega, vegaLite, interpreter] = await Promise.all([
    import('vega'),
    import('vega-lite'),
    import('vega-interpreter'),
  ])
  return { vega, vegaLite, interpreter }
}

/** 填满父容器的 Vega-Lite 图：库按需加载；表达式走解释器（不依赖 eval）；尺寸变化时按新尺寸重绘。 */
export default function VegaFill({ spec, onContentModeChange, onDatumClick, onError, ariaLabel }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  const modeRef = useRef<ChartContentMode | null>(null)
  const callbacks = useRef({ onContentModeChange, onDatumClick, onError })
  callbacks.current = { onContentModeChange, onDatumClick, onError }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let raf: number | null = null
    const measure = () => {
      raf = null
      const next = { width: Math.floor(host.clientWidth), height: Math.floor(host.clientHeight) }
      setSize(prev => (prev.width === next.width && prev.height === next.height ? prev : next))
      const mode = chartContentMode(next.width, next.height)
      if (mode === modeRef.current) return
      modeRef.current = mode
      callbacks.current.onContentModeChange?.(mode)
    }
    measure()
    const observer = new ResizeObserver(() => {
      if (raf == null) raf = window.requestAnimationFrame(measure)
    })
    observer.observe(host)
    return () => {
      if (raf != null) window.cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host || size.width < 40 || size.height < 40) return
    let cancelled = false
    let finalize: (() => void) | null = null
    loadVega().then(({ vega, vegaLite, interpreter }) => {
      if (cancelled) return
      const sized = { ...spec, width: size.width, height: size.height }
      const compiled = vegaLite.compile(sized as unknown as Parameters<typeof vegaLite.compile>[0]).spec
      const runtime = vega.parse(compiled, undefined, { ast: true })
      host.replaceChildren()
      const view = new vega.View(runtime, {
        container: host,
        renderer: 'svg',
        hover: true,
        expr: interpreter.expressionInterpreter,
      })
      finalize = () => view.finalize()
      view.addEventListener('click', (event, item) => {
        if (!(event instanceof MouseEvent) || !isCellItem(item)) return
        const rect = host.getBoundingClientRect()
        callbacks.current.onDatumClick?.(item.datum, event.clientX - rect.left, event.clientY - rect.top)
      })
      return view.runAsync()
    }).catch(() => {
      if (!cancelled) callbacks.current.onError?.()
    })
    return () => {
      cancelled = true
      finalize?.()
    }
  }, [spec, size])

  return (
    <div
      ref={hostRef}
      style={{ width: '100%', height: '100%', minHeight: 0, minWidth: 0, overflow: 'hidden' }}
      role="img"
      aria-label={ariaLabel}
    />
  )
}
