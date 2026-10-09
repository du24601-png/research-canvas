/**
 * FinFrame M3 / O4-A：refine_dataset 的 yoy_delta 变换——代码求差、派生新 Dataset、父集不变、缺值不补。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { largestAbsDelta, yoyDeltaDataset } from '../packages/shared/dist/research-dataset-delta.js'
import { sanitizeResearchDataset } from '../packages/shared/dist/research-dataset.js'
import { buildResearchCanvasTools, extractResearchCanvasEvent, stripResearchCanvasEventField } from '../packages/agent/dist/research-canvas-tools.js'
import { runInToolSession } from '../packages/agent/dist/mcp/tool-session-context.js'
import { beginResearchCanvasTurn, endResearchCanvasTurn, getTurnCanvasRecords } from '../packages/agent/dist/research-canvas-turn-state.js'

const SESSION = 'rc-yoy-test'
const A = { id: 'CN:SH.600519', name: '贵州茅台', ticker: '600519.SH', market: 'CN', type: 'equity' }
const B = { id: 'CN:SZ.000858', name: '五粮液', ticker: '000858.SZ', market: 'CN', type: 'equity' }
const VALUES = {
  [A.id]: { 2021: 52.5, 2022: 53.1, 2023: 52.4, 2024: 51.9 },
  [B.id]: { 2021: 37.0, 2022: null, 2023: 38.2, 2024: 41.3 },
}

function parent() {
  const periods = ['2021', '2022', '2023', '2024']
  const data = []
  const sources = []
  for (const entity of [A, B]) {
    for (const period of periods) {
      const value = VALUES[entity.id][period]
      data.push({ entityId: entity.id, period, value })
      if (value != null) sources.push({ provider: 'tushare', entityId: entity.id, metric: 'net_margin', period, fetchedAt: '2026-10-09T00:00:00.000Z' })
    }
  }
  return { id: 'research-ds-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: '贵州茅台、五粮液净利率', metric: 'net_margin', unit: '%', entities: [A, B], periods, data, sources }
}

function at(ds, entityId, period) {
  return ds.data.find(p => p.entityId === entityId && p.period === period)?.value
}

test('yoyDeltaDataset subtracts adjacent periods, keeps nulls, uses 个百分点', () => {
  const body = yoyDeltaDataset(parent())
  assert.deepEqual(body.periods, ['2022', '2023', '2024'])
  assert.equal(body.unit, '个百分点')
  assert.equal(at(body, A.id, '2022'), 0.6)
  assert.equal(at(body, A.id, '2023'), -0.7)
  assert.equal(at(body, B.id, '2022'), null)
  assert.equal(at(body, B.id, '2023'), null)
  assert.equal(at(body, B.id, '2024'), 3.1)
  assert.deepEqual(largestAbsDelta(body), { entityId: B.id, period: '2024', value: 3.1 })
})

test('yoyDeltaDataset rejects single period and kline', () => {
  const one = { ...parent(), periods: ['2021'] }
  assert.ok('error' in yoyDeltaDataset(one))
  assert.ok('error' in yoyDeltaDataset({ ...parent(), metric: 'kline' }))
})

test('refine_dataset yoy_delta derives a new dataset and leaves the parent unchanged', async () => {
  const tools = Object.fromEntries(buildResearchCanvasTools(null).map(tool => [tool.name, tool]))
  const p = parent()
  beginResearchCanvasTurn(SESSION, { widgets: [], datasetRecords: [p] })
  try {
    await runInToolSession(SESSION, async () => {
      const bad = await tools.refine_dataset.handler({ datasetId: p.id, operation: { type: 'yoy_delta', start: '2022' } })
      assert.ok(bad.error)
      const result = await tools.refine_dataset.handler({ datasetId: p.id, operation: { type: 'yoy_delta' } })
      assert.equal(result.ok, true)
      assert.equal(result.transform, 'yoy_delta')
      const derived = extractResearchCanvasEvent(result)?.dataset
      assert.equal(derived.parentDatasetId, p.id)
      assert.deepEqual(derived.transform, { type: 'yoy_delta' })
      assert.ok(sanitizeResearchDataset(derived), 'derived dataset passes the shared sanitizer')
      const modelVisible = JSON.stringify(stripResearchCanvasEventField(result))
      assert.equal(modelVisible.includes('"value"'), false, 'the model sees no delta values')
      assert.equal(modelVisible.includes('3.1'), false)
      const liveParent = getTurnCanvasRecords(SESSION)?.find(item => item.id === p.id)
      assert.deepEqual(liveParent.periods, ['2021', '2022', '2023', '2024'])
      assert.equal(at(liveParent, A.id, '2022'), 53.1)
    })
  } finally {
    endResearchCanvasTurn(SESSION)
  }
})
