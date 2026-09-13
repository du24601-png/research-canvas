import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_CANVAS_STATE } from './defaultCanvasState'
import {
  createDefaultCanvasState,
  normalizePersistedCanvasState,
  readPersistedCanvasState,
  removeWidgetFromState,
  RESEARCH_CANVAS_STORAGE_KEY,
  resolveLiveResearchDataset,
  syncLayoutItems,
  writePersistedCanvasState,
} from './layoutStorage'
import { buildBarChartView, buildCandlestickView, buildComboChartView, buildGroupedBarView, buildHeatmapView, buildLineChartView, buildPieChartView, buildStackedBarView, buildTableView } from './views'
import { MOCK_GROSS_MARGIN_DATASET } from './mockGrossMarginDataset'

describe('research-canvas layoutStorage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('starts with an empty canvas instead of financial examples', () => {
    const state = createDefaultCanvasState()
    expect(state.version).toBe(2)
    expect(state.widgets).toHaveLength(0)
    expect(state.layout).toHaveLength(0)
    expect(state.widgets.every(widget => !('layout' in widget))).toBe(true)
  })

  it('persists widgets and layout independently', () => {
    const initial = DEFAULT_CANVAS_STATE
    const next = removeWidgetFromState(initial, 'rc-sources-gross-margin')
    writePersistedCanvasState(next)

    const restored = readPersistedCanvasState()
    expect(restored.widgets).toHaveLength(3)
    expect(restored.layout).toHaveLength(3)
    expect(restored.layout.some(item => item.i === 'rc-sources-gross-margin')).toBe(false)
  })

  it('persists and reloads an empty canvas without restoring defaults', () => {
    const empty = {
      version: 2 as const,
      widgets: [],
      layout: [],
      datasets: [],
      acceptedProposalIds: [],
    }
    expect(normalizePersistedCanvasState(empty)).toEqual(empty)
    writePersistedCanvasState(empty)

    const restored = readPersistedCanvasState()
    expect(restored).toEqual(empty)
    expect(restored.widgets).toHaveLength(0)
    expect(restored.layout).toHaveLength(0)
    expect(restored.datasets).toEqual([])
  })

  it('migrates v1 widgets/layout and fills datasets as empty', () => {
    const v1 = {
      version: 1,
      widgets: DEFAULT_CANVAS_STATE.widgets,
      layout: DEFAULT_CANVAS_STATE.layout,
    }
    const migrated = normalizePersistedCanvasState(v1)
    expect(migrated?.version).toBe(2)
    expect(migrated?.widgets).toHaveLength(4)
    expect(migrated?.layout).toHaveLength(4)
    expect(migrated?.datasets).toEqual([])
    expect(migrated?.acceptedProposalIds).toEqual([])
  })

  it('drops illegal datasets and never coerces null to 0', () => {
    const datasetId = 'research-ds-11111111-1111-4111-8111-111111111111'
    const parsed = normalizePersistedCanvasState({
      version: 2,
      widgets: [],
      layout: [],
      datasets: [
        {
          id: datasetId,
          title: '毛利率',
          metric: 'gross_margin',
          unit: '%',
          entities: [{
            id: 'CN:SH.601058',
            name: '赛轮轮胎',
            ticker: '601058.SH',
            market: 'CN',
            type: 'equity',
          }],
          periods: ['2021', '2022'],
          data: [
            { entityId: 'CN:SH.601058', period: '2021', value: 18.2 },
            { entityId: 'CN:SH.601058', period: '2022', value: null },
          ],
          sources: [{
            provider: 'tushare',
            entityId: 'CN:SH.601058',
            metric: 'gross_margin',
            fetchedAt: '2026-09-10T00:00:00.000Z',
          }],
        },
        {
          id: 'ds-tire-gross-margin-2021-2025',
          title: 'mock',
          metric: 'gross_margin',
          unit: '%',
          entities: [],
          periods: [],
          data: [],
          sources: [],
        },
        { id: 'research-ds-not-a-uuid', title: 'bad' },
      ],
    })
    expect(parsed?.datasets).toHaveLength(1)
    expect(parsed?.datasets[0]?.id).toBe(datasetId)
    expect(parsed?.datasets[0]?.data[1]?.value).toBeNull()
  })

  it('persists optional lineage fields on v2 reload', () => {
    const datasetId = 'research-ds-22222222-2222-4222-8222-222222222222'
    const parentId = 'research-ds-11111111-1111-4111-8111-111111111111'
    const state = {
      version: 2 as const,
      widgets: [],
      layout: [],
      datasets: [{
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
        periods: ['2023', '2024', '2025'],
        data: [
          { entityId: 'CN:SH.601058', period: '2023', value: 18.2 },
          { entityId: 'CN:SH.601058', period: '2024', value: null },
          { entityId: 'CN:SH.601058', period: '2025', value: 19 },
        ],
        sources: [{
          provider: 'tushare',
          entityId: 'CN:SH.601058',
          metric: 'gross_margin',
          fetchedAt: '2026-09-10T00:00:00.000Z',
        }],
        query: {
          entities: ['601058.SH'],
          metric: 'gross_margin',
          start: '2023',
          end: '2025',
        },
        parentDatasetId: parentId,
        transform: { type: 'filter_period' as const, start: '2023', end: '2025' },
        createdAt: '2026-09-10T01:00:00.000Z',
      }],
      acceptedProposalIds: [],
    }
    writePersistedCanvasState(state)
    const restored = readPersistedCanvasState()
    expect(restored.version).toBe(2)
    expect(restored.datasets[0]?.parentDatasetId).toBe(parentId)
    expect(restored.datasets[0]?.query?.start).toBe('2023')
    expect(restored.datasets[0]?.transform).toEqual({ type: 'filter_period', start: '2023', end: '2025' })
    expect(restored.datasets[0]?.createdAt).toBe('2026-09-10T01:00:00.000Z')
    expect(restored.datasets[0]?.data[1]?.value).toBeNull()
  })

  it('rejects invalid persisted payloads', () => {
    window.localStorage.setItem(RESEARCH_CANVAS_STORAGE_KEY, '{broken')
    expect(readPersistedCanvasState().widgets).toHaveLength(0)

    window.localStorage.setItem(RESEARCH_CANVAS_STORAGE_KEY, JSON.stringify({ version: 2 }))
    expect(readPersistedCanvasState().widgets).toHaveLength(0)

    window.localStorage.setItem(RESEARCH_CANVAS_STORAGE_KEY, JSON.stringify({
      version: 1,
      widgets: DEFAULT_CANVAS_STATE.widgets,
      layout: [],
    }))
    expect(readPersistedCanvasState().widgets).toHaveLength(0)
  })

  it('syncs layout items to existing widgets only', () => {
    const widgets = DEFAULT_CANVAS_STATE.widgets.slice(0, 2)
    const layout = syncLayoutItems(DEFAULT_CANVAS_STATE.layout, widgets)
    expect(layout).toHaveLength(2)
    expect(layout.every(item => widgets.some(widget => widget.id === item.i))).toBe(true)
  })

  it('never resolves mock datasets for research preview', () => {
    expect(resolveLiveResearchDataset({ datasets: [] }, MOCK_GROSS_MARGIN_DATASET.id)).toBeUndefined()
  })

  it('persists acceptedProposalIds', () => {
    const state = {
      version: 2 as const,
      widgets: [],
      layout: [],
      datasets: [],
      acceptedProposalIds: ['call_abc12345'],
    }
    writePersistedCanvasState(state)
    expect(readPersistedCanvasState().acceptedProposalIds).toEqual(['call_abc12345'])
  })

  it('rejects persisted state when widget and layout ids do not match', () => {
    const normalized = normalizePersistedCanvasState({
      version: 1,
      widgets: DEFAULT_CANVAS_STATE.widgets.slice(0, 1),
      layout: DEFAULT_CANVAS_STATE.layout,
    })
    expect(normalized).toBeNull()
  })

  it('persists kline ohlc on a real dataset', () => {
    const datasetId = 'research-ds-22222222-2222-4222-8222-222222222222'
    const dataset = {
      id: datasetId,
      title: '赛轮日K',
      metric: 'kline',
      unit: '元',
      entities: [{
        id: 'cn-601058',
        name: '赛轮轮胎',
        ticker: '601058.SH',
        market: 'CN' as const,
        type: 'equity' as const,
      }],
      periods: ['2024-01-02', '2024-01-03'],
      data: [
        { entityId: 'cn-601058', period: '2024-01-02', value: 10 },
        { entityId: 'cn-601058', period: '2024-01-03', value: 11 },
      ],
      ohlc: [
        { entityId: 'cn-601058', time: '2024-01-02', open: 9, high: 11, low: 8, close: 10, volume: 100 },
        { entityId: 'cn-601058', time: '2024-01-03', open: 10, high: 12, low: 9, close: 11 },
      ],
      sources: [{
        provider: 'tonghuashun',
        entityId: 'cn-601058',
        metric: 'kline',
        fetchedAt: '2026-09-11T00:00:00.000Z',
      }],
      query: { entities: ['601058.SH'], metric: 'kline', start: '2024', end: '2024' },
    }
    const state = {
      version: 2 as const,
      widgets: [{ id: 'rc-k', type: 'candlestick' as const, title: '日K', datasetId }],
      layout: [{ i: 'rc-k', x: 0, y: 0, w: 8, h: 6 }],
      datasets: [dataset],
    }
    writePersistedCanvasState(state)
    const restored = readPersistedCanvasState()
    expect(restored.datasets[0]?.ohlc).toEqual(dataset.ohlc)
    expect(restored.widgets[0]?.type).toBe('candlestick')
  })

  it('keeps optional view params on widgets', () => {
    writePersistedCanvasState({
      version: 2,
      widgets: [{
        id: 'rc-1',
        type: 'bar_chart',
        title: '排名',
        datasetId: MOCK_GROSS_MARGIN_DATASET.id,
        view: { intent: 'rank', period: '2024', topN: 6 },
      }],
      layout: [{ i: 'rc-1', x: 0, y: 0, w: 4, h: 6 }],
      datasets: [MOCK_GROSS_MARGIN_DATASET],
    })
    expect(readPersistedCanvasState().widgets[0]?.view).toEqual({
      intent: 'rank',
      period: '2024',
      topN: 6,
    })
  })
})

describe('research-canvas views', () => {
  it('builds line, bar, and table views from mock dataset', () => {
    const line = buildLineChartView(MOCK_GROSS_MARGIN_DATASET)
    expect(line.periods).toEqual(['2021', '2022', '2023', '2024', '2025'])
    expect(line.series).toHaveLength(3)

    const bar = buildBarChartView(MOCK_GROSS_MARGIN_DATASET)
    expect(bar.period).toBe('2025')
    expect(bar.categories[0]).toBe('森麒麟')

    const grouped = buildGroupedBarView(MOCK_GROSS_MARGIN_DATASET)
    expect(grouped.periods).toEqual(['2021', '2022', '2023', '2024', '2025'])
    expect(grouped.series).toHaveLength(3)
    expect(grouped.percent).toBe(false)

    const table = buildTableView(MOCK_GROSS_MARGIN_DATASET)
    expect(table.headers[0]).toBe('公司')
    expect(table.rows).toHaveLength(3)
  })

  it('keeps missing values as null instead of zero', () => {
    const dataset = {
      ...MOCK_GROSS_MARGIN_DATASET,
      data: MOCK_GROSS_MARGIN_DATASET.data.map(point => (
        point.period === '2025' ? { ...point, value: null } : point
      )),
    }
    const line = buildLineChartView(dataset)
    expect(line.series.every(item => item.values[4] === null)).toBe(true)
    expect(line.series.some(item => item.values.includes(0))).toBe(false)

    const bar = buildBarChartView(dataset, '2025')
    expect(bar.categories).toHaveLength(0)
    expect(bar.omitted).toHaveLength(3)

    const table = buildTableView(dataset)
    expect(table.rows.every(row => row[5] === '—')).toBe(true)
  })

  it('bar chart falls back to the latest complete period when the last year is mostly empty', () => {
    const keep = MOCK_GROSS_MARGIN_DATASET.entities[0]?.id
    const dataset = {
      ...MOCK_GROSS_MARGIN_DATASET,
      data: MOCK_GROSS_MARGIN_DATASET.data.map(point => (
        point.period === '2025' && point.entityId !== keep ? { ...point, value: null } : point
      )),
    }
    const bar = buildBarChartView(dataset)
    expect(bar.period).toBe('2024')
    expect(bar.categories).toHaveLength(3)
    expect(bar.omitted).toEqual([])

    const explicit = buildBarChartView(dataset, '2025')
    expect(explicit.period).toBe('2025')
    expect(explicit.categories).toHaveLength(1)
    expect(explicit.omitted).toHaveLength(2)
  })

  it('builds a heatmap and dims extra line series', () => {
    const heat = buildHeatmapView(MOCK_GROSS_MARGIN_DATASET)
    expect(heat.periods).toEqual(['2021', '2022', '2023', '2024', '2025'])
    expect(heat.categories).toHaveLength(3)
    expect(heat.cells).toHaveLength(15)

    const crowded = {
      ...MOCK_GROSS_MARGIN_DATASET,
      entities: Array.from({ length: 8 }, (_, index) => ({
        id: `e${index}`,
        name: `公司${index}`,
        ticker: `00${index}`,
        market: 'CN' as const,
        type: 'equity' as const,
      })),
      data: Array.from({ length: 8 }, (_, index) => (
        MOCK_GROSS_MARGIN_DATASET.periods.map(period => ({
          entityId: `e${index}`,
          period,
          value: 10 + index,
        }))
      )).flat(),
    }
    const line = buildLineChartView(crowded)
    expect(line.series.filter(item => item.dim)).toHaveLength(2)
    expect(line.series.filter(item => !item.dim)).toHaveLength(6)
  })

  it('builds stacked, pie, combo, and candlestick views', () => {
    const stacked = buildStackedBarView(MOCK_GROSS_MARGIN_DATASET, true)
    expect(stacked.percent).toBe(true)
    expect(stacked.unit).toBe('%')
    const last = stacked.series.map(item => item.values[4] ?? 0)
    expect(last.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 5)

    const pie = buildPieChartView(MOCK_GROSS_MARGIN_DATASET)
    expect(pie.period).toBe('2025')
    expect(pie.slices[0]?.name).toBe('森麒麟')
    expect(pie.slices.every(slice => slice.value > 0)).toBe(true)

    const combo = buildComboChartView(MOCK_GROSS_MARGIN_DATASET)
    expect(combo.line.name).toBe('均值')
    expect(combo.line.values[4]).toBeCloseTo((21 + 17.8 + 25.1) / 3, 5)

    const klineDataset = {
      ...MOCK_GROSS_MARGIN_DATASET,
      metric: 'kline',
      unit: '元',
      entities: [MOCK_GROSS_MARGIN_DATASET.entities[0]!],
      periods: ['2024-01-02', '2024-01-03'],
      data: [
        { entityId: 'legacy-sailun', period: '2024-01-02', value: 10 },
        { entityId: 'legacy-sailun', period: '2024-01-03', value: 11 },
      ],
      ohlc: [
        { entityId: 'legacy-sailun', time: '2024-01-02', open: 9, high: 11, low: 8, close: 10, volume: 100 },
        { entityId: 'legacy-sailun', time: '2024-01-03', open: 10, high: 12, low: 9, close: 11, volume: 120 },
      ],
    }
    const candle = buildCandlestickView(klineDataset)
    expect(candle?.times).toEqual(['2024-01-02', '2024-01-03'])
    expect(candle?.candles[1]).toEqual([10, 11, 9, 12])
  })
})
