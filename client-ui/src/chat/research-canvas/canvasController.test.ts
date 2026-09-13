import { beforeEach, describe, expect, it } from 'vitest'
import { applyResearchCanvasEvent } from './canvasController'
import { adoptProposalIntoState } from './adoptProposal'
import { DEFAULT_CANVAS_STATE } from './defaultCanvasState'
import {
  readPersistedCanvasState,
  RESEARCH_CANVAS_STORAGE_KEY,
  writePersistedCanvasState,
} from './layoutStorage'
import { MOCK_GROSS_MARGIN_DATASET } from './mockGrossMarginDataset'
import type { PersistedCanvasState } from './types'

function cloneDefault(): PersistedCanvasState {
  return {
    version: 2,
    widgets: DEFAULT_CANVAS_STATE.widgets.map(widget => ({ ...widget })),
    layout: DEFAULT_CANVAS_STATE.layout.map(item => ({ ...item })),
    datasets: [],
  }
}

describe('research-canvas controller', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('creates a widget without moving existing layout', () => {
    const before = cloneDefault()
    const next = applyResearchCanvasEvent(before, {
      type: 'widget_created',
      widget: {
        id: 'rc-new-line',
        type: 'line_chart',
        title: '毛利率趋势',
        datasetId: MOCK_GROSS_MARGIN_DATASET.id,
      },
    })
    expect(next).not.toBeNull()
    expect(next?.widgets).toHaveLength(5)
    expect(next?.layout.slice(0, 4)).toEqual(before.layout)
    expect(next?.layout[4]?.i).toBe('rc-new-line')
    expect(next?.layout[4]?.y).toBeGreaterThanOrEqual(8)
  })

  it('updates type and title without changing layout', () => {
    const before = cloneDefault()
    const next = applyResearchCanvasEvent(before, {
      type: 'widget_updated',
      id: 'rc-bar-gross-margin-2025',
      patch: { type: 'line_chart', title: '五年毛利率趋势' },
    })
    expect(next?.widgets.find(widget => widget.id === 'rc-bar-gross-margin-2025')).toMatchObject({
      type: 'line_chart',
      title: '五年毛利率趋势',
    })
    expect(next?.layout).toEqual(before.layout)
  })

  it('deletes widget and matching layout', () => {
    const before = cloneDefault()
    const next = applyResearchCanvasEvent(before, {
      type: 'widget_deleted',
      id: 'rc-bar-gross-margin-2025',
    })
    expect(next?.widgets.some(widget => widget.id === 'rc-bar-gross-margin-2025')).toBe(false)
    expect(next?.layout.some(item => item.i === 'rc-bar-gross-margin-2025')).toBe(false)
    expect(next?.widgets).toHaveLength(3)
    expect(next?.layout).toHaveLength(3)
  })

  it('fail-closed on duplicate, unknown id, bad type, and bad dataset', () => {
    const before = cloneDefault()
    expect(applyResearchCanvasEvent(before, {
      type: 'widget_created',
      widget: before.widgets[0],
    })).toBeNull()
    expect(applyResearchCanvasEvent(before, {
      type: 'widget_updated',
      id: 'missing',
      patch: { title: 'x' },
    })).toBeNull()
    expect(applyResearchCanvasEvent(before, {
      type: 'widget_deleted',
      id: 'missing',
    })).toBeNull()
    expect(applyResearchCanvasEvent(before, {
      type: 'widget_created',
      widget: {
        id: 'rc-bad-type',
        type: 'heatmap',
        title: '饼图',
        datasetId: MOCK_GROSS_MARGIN_DATASET.id,
      },
    } as unknown)).toBeNull()
    expect(applyResearchCanvasEvent(before, {
      type: 'widget_updated',
      id: 'rc-line-gross-margin',
      patch: { datasetId: 'ds-other' },
    })).toBeNull()
  })

  it('golden path persists across refresh', () => {
    let state: PersistedCanvasState = { version: 2, widgets: [], layout: [], datasets: [] }
    const createdLine = applyResearchCanvasEvent(state, {
      type: 'widget_created',
      widget: {
        id: 'rc-line-1',
        type: 'line_chart',
        title: '毛利率趋势',
        datasetId: MOCK_GROSS_MARGIN_DATASET.id,
      },
    })
    expect(createdLine).not.toBeNull()
    state = createdLine!

    const createdBar = applyResearchCanvasEvent(state, {
      type: 'widget_created',
      widget: {
        id: 'rc-bar-1',
        type: 'bar_chart',
        title: '2025年毛利率排名',
        datasetId: MOCK_GROSS_MARGIN_DATASET.id,
      },
    })
    expect(createdBar).not.toBeNull()
    state = createdBar!

    const asLine = applyResearchCanvasEvent(state, {
      type: 'widget_updated',
      id: 'rc-bar-1',
      patch: { type: 'line_chart' },
    })
    expect(asLine?.widgets.find(widget => widget.id === 'rc-bar-1')?.type).toBe('line_chart')
    expect(asLine?.layout.find(item => item.i === 'rc-bar-1')).toEqual(
      state.layout.find(item => item.i === 'rc-bar-1'),
    )
    state = asLine!

    const renamed = applyResearchCanvasEvent(state, {
      type: 'widget_updated',
      id: 'rc-line-1',
      patch: { title: '五年毛利率趋势' },
    })
    expect(renamed?.widgets.find(widget => widget.id === 'rc-line-1')?.title).toBe('五年毛利率趋势')
    state = renamed!

    const deleted = applyResearchCanvasEvent(state, {
      type: 'widget_deleted',
      id: 'rc-bar-1',
    })
    expect(deleted?.widgets).toHaveLength(1)
    expect(deleted?.layout).toHaveLength(1)
    expect(deleted?.widgets[0]?.title).toBe('五年毛利率趋势')
    state = deleted!

    writePersistedCanvasState(state)
    expect(window.localStorage.getItem(RESEARCH_CANVAS_STORAGE_KEY)).toBeTruthy()
    const restored = readPersistedCanvasState()
    expect(restored).toEqual(state)
  })

  it('stores dataset_created and rejects unknown dataset widgets', () => {
    const datasetId = 'research-ds-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const dataset = {
      id: datasetId,
      title: '毛利率',
      metric: 'gross_margin',
      unit: '%',
      entities: [{
        id: 'CN:SH.601058',
        name: '赛轮轮胎',
        ticker: '601058.SH',
        market: 'CN' as const,
        type: 'equity' as const,
      }],
      periods: ['2025'],
      data: [{ entityId: 'CN:SH.601058', period: '2025', value: 21 }],
      sources: [{
        provider: 'tushare',
        entityId: 'CN:SH.601058',
        metric: 'gross_margin',
        fetchedAt: '2026-09-10T00:00:00.000Z',
      }],
    }
    let state: PersistedCanvasState = { version: 2, widgets: [], layout: [], datasets: [] }
    const withDataset = applyResearchCanvasEvent(state, { type: 'dataset_created', dataset })
    expect(withDataset?.datasets).toHaveLength(1)
    state = withDataset!

    expect(applyResearchCanvasEvent(state, {
      type: 'widget_created',
      widget: {
        id: 'rc-unknown',
        type: 'bar_chart',
        title: '排名',
        datasetId: 'research-ds-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      },
    })).toBeNull()

    const withWidget = applyResearchCanvasEvent(state, {
      type: 'widget_created',
      widget: {
        id: 'rc-bar-real',
        type: 'bar_chart',
        title: '2025年毛利率排名',
        datasetId,
      },
    })
    expect(withWidget?.widgets).toHaveLength(1)
    expect(withWidget?.datasets).toHaveLength(1)
  })

  it('derived dataset_created does not mutate parent or existing widget layout', () => {
    const parentId = 'research-ds-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const derivedId = 'research-ds-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const parent = {
      id: parentId,
      title: '毛利率',
      metric: 'gross_margin',
      unit: '%',
      entities: [{
        id: 'CN:SH.601058',
        name: '赛轮轮胎',
        ticker: '601058.SH',
        market: 'CN' as const,
        type: 'equity' as const,
      }],
      periods: ['2025'],
      data: [{ entityId: 'CN:SH.601058', period: '2025', value: 21 }],
      sources: [{
        provider: 'tushare',
        entityId: 'CN:SH.601058',
        metric: 'gross_margin',
        fetchedAt: '2026-09-10T00:00:00.000Z',
      }],
    }
    let state: PersistedCanvasState = { version: 2, widgets: [], layout: [], datasets: [] }
    state = applyResearchCanvasEvent(state, { type: 'dataset_created', dataset: parent })!
    const withWidget = applyResearchCanvasEvent(state, {
      type: 'widget_created',
      widget: {
        id: 'rc-line-parent',
        type: 'line_chart',
        title: '毛利率趋势',
        datasetId: parentId,
      },
    })
    expect(withWidget).not.toBeNull()
    state = withWidget!
    const layoutBefore = state.layout.map(item => ({ ...item }))
    const derived = {
      ...parent,
      id: derivedId,
      parentDatasetId: parentId,
      transform: { type: 'filter_entities' as const, removedEntityIds: ['CN:SH.601966'] },
    }
    const next = applyResearchCanvasEvent(state, { type: 'dataset_created', dataset: derived })
    expect(next?.datasets).toHaveLength(2)
    expect(next?.datasets.find(item => item.id === parentId)).toEqual(parent)
    expect(next?.widgets[0]?.datasetId).toBe(parentId)
    expect(next?.layout).toEqual(layoutBefore)

    const retarget = applyResearchCanvasEvent(next!, {
      type: 'widget_updated',
      id: 'rc-line-parent',
      patch: { datasetId: derivedId },
    })
    expect(retarget?.widgets[0]?.datasetId).toBe(derivedId)
    expect(retarget?.layout).toEqual(layoutBefore)
    expect(applyResearchCanvasEvent(next!, {
      type: 'widget_updated',
      id: 'rc-line-parent',
      patch: { datasetId: 'research-ds-cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
    })).toBeNull()
  })

  it('ignores widget_proposed and adopts locally without reusing proposal id', () => {
    const datasetId = 'research-ds-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const dataset = {
      id: datasetId,
      title: '毛利率',
      metric: 'gross_margin',
      unit: '%',
      entities: [{
        id: 'CN:SH.601058',
        name: '赛轮轮胎',
        ticker: '601058.SH',
        market: 'CN' as const,
        type: 'equity' as const,
      }],
      periods: ['2025'],
      data: [{ entityId: 'CN:SH.601058', period: '2025', value: 21 }],
      sources: [{
        provider: 'tushare',
        entityId: 'CN:SH.601058',
        metric: 'gross_margin',
        fetchedAt: '2026-09-10T00:00:00.000Z',
      }],
    }
    let state: PersistedCanvasState = { version: 2, widgets: [], layout: [], datasets: [] }
    state = applyResearchCanvasEvent(state, { type: 'dataset_created', dataset })!

    expect(applyResearchCanvasEvent(state, {
      type: 'widget_proposed',
      proposal: {
        id: 'call_abc12345',
        type: 'line_chart',
        title: '毛利率趋势',
        datasetId,
        status: 'ready',
      },
    })).toBeNull()
    expect(state.widgets).toHaveLength(0)

    const adopted = applyResearchCanvasEvent(state, {
      type: 'widget_adopted',
      proposal: {
        id: 'call_abc12345',
        type: 'line_chart',
        title: '毛利率趋势',
        datasetId,
      },
    })
    expect(adopted).not.toBeNull()
    expect(adopted?.widgets).toHaveLength(1)
    expect(adopted?.widgets[0]?.id).not.toBe('call_abc12345')
    expect(adopted?.widgets[0]?.id).toMatch(/^rc-/)
    expect(adopted?.acceptedProposalIds).toEqual(['call_abc12345'])

    expect(applyResearchCanvasEvent(adopted!, {
      type: 'widget_adopted',
      proposal: {
        id: 'call_abc12345',
        type: 'line_chart',
        title: '毛利率趋势',
        datasetId,
      },
    })).toBeNull()

    const widgetId = adopted!.widgets[0]?.id ?? ''
    const deleted = applyResearchCanvasEvent(adopted!, { type: 'widget_deleted', id: widgetId })
    expect(deleted?.widgets).toHaveLength(0)

    const readopted = applyResearchCanvasEvent(deleted!, {
      type: 'widget_adopted',
      proposal: {
        id: 'call_abc12345',
        type: 'line_chart',
        title: '毛利率趋势',
        datasetId,
      },
    })
    expect(readopted?.widgets).toHaveLength(1)
    expect(readopted?.widgets[0]?.sourceProposalId).toBe('call_abc12345')
    expect(readopted?.acceptedProposalIds).toEqual(['call_abc12345'])

    expect(adoptProposalIntoState(state, {
      id: 'call_missingds',
      type: 'bar_chart',
      title: '排名',
      datasetId: MOCK_GROSS_MARGIN_DATASET.id,
    })).toBeNull()
  })
})
