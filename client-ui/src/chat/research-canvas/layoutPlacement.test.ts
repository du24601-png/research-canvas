import { describe, expect, it } from 'vitest'
import {
  applyPresetConstraints,
  autoArrangeLayout,
  canPlaceRect,
  firstFitPosition,
  layoutRectsCollide,
  placeNewWidgetLayout,
} from './layoutPlacement'
import { WIDGET_SIZE_PRESETS } from './widgetSizePresets'
import type { CanvasLayoutItem, Widget } from './types'

function widget(id: string, type: Widget['type']): Widget {
  return { id, type, title: id, datasetId: 'ds' }
}

describe('research-canvas placement', () => {
  it('uses preferred size and does not collide', () => {
    const first = placeNewWidgetLayout([], widget('a', 'line_chart'))
    expect(first).toMatchObject({
      i: 'a',
      x: 0,
      y: 0,
      w: Math.max(WIDGET_SIZE_PRESETS.line_chart.preferredW, 8),
      h: Math.max(WIDGET_SIZE_PRESETS.line_chart.preferredH, 10),
      minW: WIDGET_SIZE_PRESETS.line_chart.minW,
      minH: WIDGET_SIZE_PRESETS.line_chart.minH,
    })
    const second = placeNewWidgetLayout([first], widget('b', 'bar_chart'))
    expect(layoutRectsCollide(first, second)).toBe(false)
    expect(second.w).toBe(WIDGET_SIZE_PRESETS.bar_chart.preferredW)
    expect(second.h).toBe(Math.max(WIDGET_SIZE_PRESETS.bar_chart.preferredH, 8))
  })

  it('fills the first free hole instead of appending to maxY', () => {
    const layout: CanvasLayoutItem[] = [
      { i: 'left', x: 0, y: 0, w: 8, h: 6, minW: 5, minH: 4 },
      { i: 'bottom', x: 0, y: 6, w: 8, h: 6, minW: 5, minH: 4 },
    ]
    const placed = firstFitPosition(layout, { w: 4, h: 5 })
    expect(placed).toEqual({ x: 8, y: 0 })
    expect(canPlaceRect(layout, { i: 'hole', x: 8, y: 0, w: 4, h: 5 })).toBe(true)
  })

  it('auto-arranges deterministically without overlap', () => {
    const widgets = [
      widget('w1', 'line_chart'),
      widget('w2', 'bar_chart'),
      widget('w3', 'line_chart'),
      widget('w4', 'bar_chart'),
    ]
    const once = autoArrangeLayout(widgets)
    const twice = autoArrangeLayout(widgets)
    expect(once).toEqual(twice)
    expect(once).toHaveLength(4)
    for (let i = 0; i < once.length; i += 1) {
      for (let j = i + 1; j < once.length; j += 1) {
        expect(layoutRectsCollide(once[i]!, once[j]!)).toBe(false)
      }
    }
    expect(once[0]).toMatchObject({ i: 'w1', x: 0, y: 0, w: 8, h: 10 })
    expect(once[1]).toMatchObject({ i: 'w2', w: WIDGET_SIZE_PRESETS.bar_chart.preferredW })
    expect(once[2]).toMatchObject({ i: 'w3', w: 8, h: WIDGET_SIZE_PRESETS.line_chart.preferredH })
    expect(once[3]).toMatchObject({ i: 'w4', w: WIDGET_SIZE_PRESETS.bar_chart.preferredW })
  })

  it('enforces minW/minH from size presets', () => {
    const widgets = [widget('tiny', 'table')]
    const layout: CanvasLayoutItem[] = [{ i: 'tiny', x: 0, y: 0, w: 2, h: 2 }]
    const next = applyPresetConstraints(layout, widgets)
    expect(next[0]?.minW).toBe(WIDGET_SIZE_PRESETS.table.minW)
    expect(next[0]?.minH).toBe(WIDGET_SIZE_PRESETS.table.minH)
    expect(next[0]?.w).toBe(WIDGET_SIZE_PRESETS.table.minW)
    expect(next[0]?.h).toBe(WIDGET_SIZE_PRESETS.table.minH)
  })
})
