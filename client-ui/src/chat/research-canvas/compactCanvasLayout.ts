import type { CanvasLayoutItem, Widget } from './types'

/** Narrow panels use a reading layout without changing the saved desktop layout. */
export function compactCanvasLayout(layout: readonly CanvasLayoutItem[], widgets: readonly Widget[]): CanvasLayoutItem[] {
  let y = 0
  return widgets.map(widget => {
    const saved = layout.find(item => item.i === widget.id)
    const h = Math.max(saved?.h ?? 0, widget.type === 'sources' ? 7 : 10)
    const item = { ...saved, i: widget.id, x: 0, y, w: 12, h, minW: 12, minH: h }
    y += h
    return item
  })
}
