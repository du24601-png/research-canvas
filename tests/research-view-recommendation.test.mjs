/**
 * Chart-type recommendation from dataset shape (entities × periods × coverage).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  datasetShape,
  inferViewIntent,
  pickRecommendedView,
  recommendWidgetView,
  widgetTypeShapeWarning,
} from '../packages/shared/dist/research-view-recommendation.js'
import { buildResearchViewTitle } from '../packages/shared/dist/research-view-title.js'

function dataset({ entities, periods, metric = 'gross_margin', unit = '%', missing = () => false }) {
  const ents = Array.from({ length: entities }, (_, index) => ({ id: `e${index}` }))
  const data = []
  for (const entity of ents) {
    for (const period of periods) {
      data.push({ entityId: entity.id, period, value: missing(entity.id, period) ? null : 10 })
    }
  }
  return { metric, unit, entities: ents, periods, data }
}

const YEARS = ['2021', '2022', '2023', '2024', '2025']

test('shape: latestCompletePeriod skips a mostly-empty latest year', () => {
  const ds = dataset({
    entities: 19,
    periods: YEARS,
    missing: (_id, period) => period === '2025' && _id !== 'e0' && _id !== 'e1' && _id !== 'e2',
  })
  const shape = datasetShape(ds)
  assert.equal(shape.entities, 19)
  assert.equal(shape.periods, 5)
  assert.equal(shape.total, 95)
  assert.equal(shape.filled, 19 * 4 + 3)
  assert.equal(shape.byPeriod.at(-1).filled, 3)
  assert.equal(shape.latestCompletePeriod, '2024')
})

test('shape: fully-covered dataset uses the latest period', () => {
  const shape = datasetShape(dataset({ entities: 3, periods: YEARS }))
  assert.equal(shape.latestCompletePeriod, '2025')
})

test('shape: when no period is complete, falls back to the best-covered latest period', () => {
  const ds = dataset({
    entities: 10,
    periods: ['2023', '2024'],
    missing: (id, period) => (period === '2023' ? Number(id.slice(1)) >= 4 : Number(id.slice(1)) >= 3),
  })
  const shape = datasetShape(ds)
  assert.equal(shape.byPeriod[0].filled, 4)
  assert.equal(shape.byPeriod[1].filled, 3)
  assert.equal(shape.latestCompletePeriod, '2023')
})

test('recommend: few entities × many periods → line_chart', () => {
  const view = recommendWidgetView(dataset({ entities: 3, periods: YEARS }))
  assert.equal(view.recommended, 'line_chart')
  assert.ok(view.alternatives.includes('bar_chart'))
  assert.ok(view.alternatives.includes('grouped_bar'))
  assert.ok(view.alternatives.includes('heatmap_table'))
  assert.equal(view.period, undefined)
})

test('recommend: compare with few entities prefers grouped_bar', () => {
  const picked = pickRecommendedView(dataset({ entities: 2, periods: YEARS }), 'compare')
  assert.equal(picked.type, 'grouped_bar')
})

test('recommend: compare with many entities stays heatmap_table', () => {
  const picked = pickRecommendedView(dataset({ entities: 19, periods: YEARS }), 'compare')
  assert.equal(picked.type, 'heatmap_table')
})

test('recommend: many entities × many periods → heatmap_table', () => {
  const ds = dataset({
    entities: 19,
    periods: YEARS,
    missing: (id, period) => period === '2025' && id !== 'e0',
  })
  assert.equal(inferViewIntent(ds), 'compare')
  const view = recommendWidgetView(ds)
  assert.equal(view.recommended, 'heatmap_table')
  assert.ok(view.alternatives.includes('bar_chart'))
  assert.ok(view.alternatives.includes('line_chart'))
  assert.ok(view.alternatives.includes('table'))
})

test('recommend: explicit rank intent uses bar at latest complete period', () => {
  const ds = dataset({
    entities: 19,
    periods: YEARS,
    missing: (id, period) => period === '2025' && Number(id.slice(1)) >= 3,
  })
  const picked = pickRecommendedView(ds, 'rank')
  assert.equal(picked.type, 'bar_chart')
  assert.equal(picked.params.period, '2024')
})

test('recommend: explicit trend intent keeps line_chart even with many entities', () => {
  const picked = pickRecommendedView(dataset({ entities: 19, periods: YEARS }), 'trend')
  assert.equal(picked.type, 'line_chart')
  assert.equal(picked.params.topN, 6)
})

test('recommend: single period → bar_chart', () => {
  const view = recommendWidgetView(dataset({ entities: 4, periods: ['2024'] }))
  assert.equal(view.recommended, 'bar_chart')
  assert.equal(view.period, '2024')
})

test('recommend: kline → candlestick', () => {
  const ds = { ...dataset({ entities: 1, periods: ['2024-01-02'], metric: 'kline', unit: '元' }), ohlc: [{}] }
  assert.equal(recommendWidgetView(ds).recommended, 'candlestick')
})

test('warning: bar on multi-year dataset explains the single period and missing latest year', () => {
  const ds = dataset({
    entities: 19,
    periods: YEARS,
    missing: (id, period) => period === '2025' && Number(id.slice(1)) >= 3,
  })
  const warning = widgetTypeShapeWarning('bar_chart', ds)
  assert.ok(warning)
  assert.match(warning, /2024/)
  assert.match(warning, /2025 仅 3\/19/)
})

test('warning: line with too many entities, pie on percent metric, candlestick on financials', () => {
  const many = dataset({ entities: 12, periods: YEARS })
  assert.match(widgetTypeShapeWarning('line_chart', many), /12 条折线/)
  assert.match(widgetTypeShapeWarning('grouped_bar', many), /12 家并排柱过密/)
  assert.match(widgetTypeShapeWarning('pie_chart', many), /饼图/)
  assert.match(widgetTypeShapeWarning('candlestick', many), /蜡烛图/)
  assert.match(widgetTypeShapeWarning('line_chart', dataset({ entities: 3, periods: ['2024'] })), /一期/)
  assert.match(widgetTypeShapeWarning('grouped_bar', dataset({ entities: 3, periods: ['2024'] })), /一期/)
})

test('warning: matching type returns null', () => {
  const few = dataset({ entities: 3, periods: YEARS })
  assert.equal(widgetTypeShapeWarning('line_chart', few), null)
  assert.equal(widgetTypeShapeWarning('grouped_bar', few), null)
  assert.equal(widgetTypeShapeWarning('table', few), null)
  assert.equal(widgetTypeShapeWarning('bar_chart', dataset({ entities: 3, periods: ['2024'] })), null)
})

test('title template: bar uses a single year, grouped bar and heatmap use the range', () => {
  const bar = buildResearchViewTitle({
    entityCount: 19,
    entityNames: ['紫金矿业'],
    metric: 'gross_margin',
    type: 'bar_chart',
    intent: 'rank',
    period: '2024',
    periods: YEARS,
  })
  assert.match(bar, /已确认的19家/)
  assert.match(bar, /2024/)
  assert.equal(bar.includes('2021'), false)

  const grouped = buildResearchViewTitle({
    entityCount: 2,
    entityNames: ['宁德时代', '比亚迪'],
    metric: 'revenue',
    type: 'grouped_bar',
    intent: 'compare',
    periods: YEARS,
  })
  assert.match(grouped, /2021–2025/)
  assert.match(grouped, /对比/)

  const heat = buildResearchViewTitle({
    entityCount: 19,
    entityNames: [],
    metric: 'gross_margin',
    type: 'heatmap_table',
    intent: 'compare',
    periods: YEARS,
  })
  assert.match(heat, /2021–2025/)
})
