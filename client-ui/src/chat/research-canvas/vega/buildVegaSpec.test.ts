import { describe, expect, it } from 'vitest'
import { getResearchChartTheme } from '../chartTheme'
import { MOCK_GROSS_MARGIN_DATASET } from '../mockGrossMarginDataset'
import type { Dataset, WidgetType } from '../types'
import { buildVegaSpec, isVegaSupported } from './buildVegaSpec'
import { cellFromDatum } from './cellFromDatum'
import type { JsonObject } from './specCommon'

const theme = getResearchChartTheme('light')
const dataset: Dataset = {
  ...MOCK_GROSS_MARGIN_DATASET,
  unit: '%',
  periods: ['2021', '2022', '2023'],
  entities: [
    { id: 'a', name: '甲公司', ticker: '000001.SZ', market: 'CN', type: 'equity' },
    { id: 'b', name: '乙公司', ticker: '000002.SZ', market: 'CN', type: 'equity' },
  ],
  data: [
    { entityId: 'a', period: '2021', value: 10 },
    { entityId: 'a', period: '2022', value: null },
    { entityId: 'a', period: '2023', value: 14.25 },
    { entityId: 'b', period: '2021', value: 20 },
    { entityId: 'b', period: '2022', value: 22 },
    { entityId: 'b', period: '2023', value: null },
  ],
}

type Style = Parameters<typeof buildVegaSpec>[0]['style']

function build(type: WidgetType, style?: Style) {
  const built = buildVegaSpec({ type, dataset, theme, mode: 'wide', style })
  if (!built) throw new Error('unsupported')
  return built
}

function rowsOf(spec: JsonObject): Array<Record<string, unknown>> {
  return (spec.data as { values: Array<Record<string, unknown>> }).values
}

function layersOf(spec: JsonObject): JsonObject[] {
  return spec.layer as JsonObject[]
}

function endLayer(spec: JsonObject): JsonObject | undefined {
  return layersOf(spec).find(layer => (layer.encoding as JsonObject).text !== undefined)
}

describe('buildVegaSpec', () => {
  it('supports charts but leaves candlestick, table and sources to the old renderers', () => {
    expect(isVegaSupported('line_chart')).toBe(true)
    expect(isVegaSupported('heatmap_table')).toBe(true)
    expect(isVegaSupported('candlestick')).toBe(false)
    expect(isVegaSupported('table')).toBe(false)
    expect(isVegaSupported('sources')).toBe(false)
    expect(buildVegaSpec({ type: 'table', dataset, theme, mode: 'wide' })).toBeNull()
  })

  it('keeps nulls as null in line rows and breaks the path instead of drawing zero', () => {
    const { spec } = build('line_chart')
    const rows = rowsOf(spec)
    expect(rows).toHaveLength(6)
    const gap = rows.find(row => row.entityId === 'a' && row.period === '2022')
    expect(gap?.value).toBeNull()
    expect(gap?.valueLabel).toBeNull()
    expect(rows.every(row => row.value !== 0)).toBe(true)
    expect(layersOf(spec)[0]?.mark).toMatchObject({ invalid: 'break-paths-filter-domains' })
  })

  it('puts the end label on the last non-null point of each series, without a legend', () => {
    const { spec } = build('line_chart')
    const ends = (endLayer(spec)?.data as { values: Array<Record<string, unknown>> }).values
    expect(ends.map(row => [row.entityId, row.period, row.endLabel])).toEqual([
      ['a', '2023', '甲公司 14.3%'],
      ['b', '2022', '乙公司 22.0%'],
    ])
    const color = (layersOf(spec)[0]?.encoding as JsonObject).color as { legend: unknown }
    expect(color.legend).toBeNull()
  })

  it('respects hidden series, custom labels and colors from ChartStyle', () => {
    const { spec } = build('line_chart', {
      series: { a: { visible: false }, b: { label: '乙', color: '#112233' } },
    })
    expect(new Set(rowsOf(spec).map(row => row.entityId))).toEqual(new Set(['b']))
    const ends = (endLayer(spec)?.data as { values: Array<Record<string, unknown>> }).values
    expect(ends[0]?.endLabel).toBe('乙 22.0%')
    const color = (layersOf(spec)[0]?.encoding as JsonObject).color as { scale: { range: string[] } }
    expect(color.scale.range).toEqual(['#112233'])
  })

  it('shows a legend instead of end labels when the style asks for one', () => {
    const { spec } = build('line_chart', { legend: { show: true, position: 'bottom' } })
    expect(endLayer(spec)).toBeUndefined()
    const color = (layersOf(spec)[0]?.encoding as JsonObject).color as { legend: { orient: string } }
    expect(color.legend.orient).toBe('bottom')
  })

  it('bar rows drop companies without data and carry entityId and the bar period', () => {
    const rows = rowsOf(build('bar_chart').spec)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every(row => typeof row.entityId === 'string' && row.period !== '')).toBe(true)
    expect(rows.every(row => row.value !== null)).toBe(true)
  })

  it('every cell-bearing chart type emits rows that resolve to a cell', () => {
    const types: WidgetType[] = [
      'line_chart', 'bar_chart', 'grouped_bar', 'stacked_bar',
      'stacked_bar_percent', 'combo_bar_line', 'pie_chart', 'donut_chart', 'heatmap_table',
    ]
    for (const type of types) {
      const cells = rowsOf(build(type).spec).map(cellFromDatum).filter(cell => cell !== null)
      expect(cells.length, type).toBeGreaterThan(0)
    }
  })

  it('heatmap keeps missing cells as null with a dash label', () => {
    const rows = rowsOf(build('heatmap_table').spec)
    const missing = rows.find(row => row.entityId === 'a' && row.period === '2022')
    expect(missing?.value).toBeNull()
    expect(missing?.valueLabel).toBe('—')
  })

  it('combo mean line rows are not clickable', () => {
    const mean = layersOf(build('combo_bar_line').spec)[1]?.data as { values: unknown[] }
    expect(mean.values.map(cellFromDatum).every(cell => cell === null)).toBe(true)
  })
})

describe('cellFromDatum', () => {
  it('maps a data row straight to a cell ref', () => {
    expect(cellFromDatum({ entityId: 'a', period: '2023', value: 1 })).toEqual({ entityId: 'a', period: '2023' })
  })

  it('rejects rows without entityId or period', () => {
    expect(cellFromDatum({ period: '2023' })).toBeNull()
    expect(cellFromDatum({ entityId: 'a' })).toBeNull()
    expect(cellFromDatum({ entityId: '', period: '2023' })).toBeNull()
    expect(cellFromDatum(null)).toBeNull()
    expect(cellFromDatum([1, 2])).toBeNull()
  })
})

describe('dimmed line series', () => {
  it('still get a muted end label', () => {
    const many: Dataset = {
      ...dataset,
      entities: Array.from({ length: 12 }, (_, i) => ({
        id: `e${i}`, name: `公司${i}`, ticker: `00000${i}.SZ`, market: 'CN' as const, type: 'equity' as const,
      })),
      data: Array.from({ length: 12 }, (_, i) => (
        dataset.periods.map(period => ({ entityId: `e${i}`, period, value: i + 1 }))
      )).flat(),
    }
    const built = buildVegaSpec({ type: 'line_chart', dataset: many, theme, mode: 'wide' })
    const layer = (built?.spec.layer as JsonObject[]).find(l => (l.encoding as JsonObject).text !== undefined)
    const ends = (layer?.data as { values: Array<Record<string, unknown>> }).values
    expect(ends).toHaveLength(12)
    expect(ends.some(row => row.emph === 0)).toBe(true)
  })
})
