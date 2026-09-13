import { CANVAS_GRID_COLS, layoutSizeFromPreset } from './widgetSizePresets'
import type { CanvasLayoutItem, Widget, WidgetType } from './types'
import type { WidgetLayoutSize } from './widgetSizePresets'

export { WIDGET_SIZE_PRESETS, layoutSizeFromPreset } from './widgetSizePresets'
export type { WidgetSizePreset } from './widgetSizePresets'

interface GridRect {
  i: string
  x: number
  y: number
  w: number
  h: number
}

export function layoutRectsCollide(left: GridRect, right: GridRect): boolean {
  if (left.i === right.i) return false
  return left.x < right.x + right.w
    && left.x + left.w > right.x
    && left.y < right.y + right.h
    && left.y + left.h > right.y
}

function layoutBottom(layout: readonly GridRect[]): number {
  return layout.reduce((max, item) => Math.max(max, item.y + item.h), 0)
}

export function canPlaceRect(
  layout: readonly GridRect[],
  candidate: GridRect,
): boolean {
  if (candidate.x < 0 || candidate.y < 0) return false
  if (candidate.w < 1 || candidate.h < 1) return false
  if (candidate.x + candidate.w > CANVAS_GRID_COLS) return false
  return layout.every(item => !layoutRectsCollide(item, candidate))
}

export function firstFitPosition(
  layout: readonly GridRect[],
  size: Pick<GridRect, 'w' | 'h'>,
  id = '__candidate',
): Pick<GridRect, 'x' | 'y'> {
  const maxY = layoutBottom(layout)
  for (let y = 0; y <= maxY; y += 1) {
    for (let x = 0; x <= CANVAS_GRID_COLS - size.w; x += 1) {
      const candidate = { i: id, x, y, w: size.w, h: size.h }
      if (canPlaceRect(layout, candidate)) return { x, y }
    }
  }
  return { x: 0, y: maxY }
}

function layoutSizeForNewWidget(
  type: WidgetType,
  layout: readonly CanvasLayoutItem[],
): WidgetLayoutSize {
  const base = layoutSizeFromPreset(type)
  if (layout.length === 0) {
    return {
      ...base,
      w: Math.max(base.w, 8),
      h: Math.max(base.h, 10),
    }
  }
  if (layout.length === 1) {
    return {
      ...base,
      h: Math.max(base.h, 8),
    }
  }
  return base
}

export function placeNewWidgetLayout(
  layout: readonly CanvasLayoutItem[],
  widget: Pick<Widget, 'id' | 'type'>,
): CanvasLayoutItem {
  const size = layoutSizeForNewWidget(widget.type, layout)
  const origin = firstFitPosition(layout, size, widget.id)
  return {
    i: widget.id,
    x: origin.x,
    y: origin.y,
    w: size.w,
    h: size.h,
    minW: size.minW,
    minH: size.minH,
  }
}

export function autoArrangeLayout(
  widgets: readonly Pick<Widget, 'id' | 'type'>[],
): CanvasLayoutItem[] {
  const layout: CanvasLayoutItem[] = []
  for (const widget of widgets) {
    layout.push(placeNewWidgetLayout(layout, widget))
  }
  return layout
}

export function applyPresetConstraints(
  layout: readonly CanvasLayoutItem[],
  widgets: readonly Pick<Widget, 'id' | 'type'>[],
): CanvasLayoutItem[] {
  const types = new Map(widgets.map(widget => [widget.id, widget.type as WidgetType]))
  return layout.map((item) => {
    const type = types.get(item.i)
    if (!type) return { ...item }
    const size = layoutSizeFromPreset(type)
    return {
      ...item,
      minW: size.minW,
      minH: size.minH,
      w: Math.max(item.w, size.minW),
      h: Math.max(item.h, size.minH),
    }
  })
}
