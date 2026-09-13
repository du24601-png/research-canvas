import { describe, expect, it } from 'vitest'
import {
  getActiveWidgetContext,
  findAddedWidgetId,
  isWidgetSelectionIgnoreTarget,
  shouldClearSelectionOnCanvasClick,
} from './activeWidgetContext'
import type { Dataset, Widget } from './types'

const DATASET_ID = 'research-ds-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function widget(id: string, title = 'Revenue & Operating Margin'): Widget {
  return { id, type: 'line_chart', title, datasetId: DATASET_ID }
}

function dataset(overrides: Partial<Dataset> = {}): Dataset {
  return {
    id: DATASET_ID,
    title: 'Microsoft financials',
    metric: 'operating_margin',
    unit: '%',
    entities: [{
      id: 'US:MSFT',
      name: 'Microsoft',
      ticker: 'MSFT',
      market: 'CN',
      type: 'equity',
    }],
    periods: ['2022', '2023', '2024', '2025', '2026'],
    data: [],
    sources: [],
    ...overrides,
  }
}

describe('active widget context', () => {
  it('returns metadata for the active widget', () => {
    const context = getActiveWidgetContext(
      [widget('widget-123')],
      [dataset()],
      'widget-123',
    )
    expect(context).toEqual({
      widgetId: 'widget-123',
      type: 'line_chart',
      title: 'Revenue & Operating Margin',
      datasetId: DATASET_ID,
      subject: { ticker: 'MSFT', companyName: 'Microsoft' },
      period: { from: '2022', to: '2026' },
      metrics: ['operating_margin'],
    })
  })

  it('works when optional dataset fields are missing', () => {
    const context = getActiveWidgetContext(
      [{ id: 'w1', type: 'table', title: '明细', datasetId: 'missing' }],
      [],
      'w1',
    )
    expect(context).toEqual({
      widgetId: 'w1',
      type: 'table',
      title: '明细',
      datasetId: 'missing',
    })
  })

  it('returns null when nothing is selected', () => {
    expect(getActiveWidgetContext([widget('w1')], [dataset()], null)).toBeNull()
  })

  it('returns null when the selected widget is gone', () => {
    expect(getActiveWidgetContext([], [dataset()], 'w1')).toBeNull()
  })

  it('finds a single added widget id', () => {
    expect(findAddedWidgetId([widget('a')], [widget('a'), widget('b')])).toBe('b')
    expect(findAddedWidgetId([widget('a')], [widget('a')])).toBeNull()
  })

  it('does not treat widget, toolbar, or resize handle clicks as blank canvas', () => {
    const widgetEl = document.createElement('div')
    widgetEl.className = 'research-canvas-widget'
    const inner = document.createElement('span')
    widgetEl.appendChild(inner)
    document.body.append(widgetEl)
    expect(shouldClearSelectionOnCanvasClick(inner)).toBe(false)
    widgetEl.remove()

    const root = document.createElement('div')
    root.className = 'research-canvas-root'
    expect(shouldClearSelectionOnCanvasClick(root)).toBe(true)

    const handle = document.createElement('span')
    handle.className = 'research-canvas-drag-handle'
    expect(isWidgetSelectionIgnoreTarget(handle)).toBe(true)
    expect(isWidgetSelectionIgnoreTarget(root)).toBe(false)
  })
})
