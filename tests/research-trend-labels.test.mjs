import test from 'node:test'
import assert from 'node:assert/strict'
import { entityTrendLabels } from '../packages/shared/dist/research-trend-labels.js'

function ds(values) {
  const periods = ['2021', '2022', '2023', '2024', '2025']
  const entities = Object.keys(values).map(name => ({ id: name, name, ticker: name, market: 'CN', type: 'equity' }))
  const data = entities.flatMap(e => periods.map((period, i) => ({ entityId: e.id, period, value: values[e.name][i] })))
  return { id: 'research-ds-t', title: 't', metric: 'roe', unit: '%', entities, periods, data, sources: [] }
}

test('direction, high/low period and gaps come from code; no numbers in labels', () => {
  const labels = entityTrendLabels(ds({
    up: [10, 11, 12, 13, 14],
    down: [20, 18, 16, 15, 12],
    swing: [10, 20, 9, 21, 11],
    flat: [10, 10, 10, 10, 10],
    sparse: [null, 5, null, null, null],
    gap: [10, null, 12, 13, 15],
  }))
  const by = Object.fromEntries(labels.map(l => [l.name, l]))
  assert.equal(by.up.direction, '上升')
  assert.equal(by.up.highestPeriod, '2025')
  assert.equal(by.down.direction, '下降')
  assert.equal(by.down.lowestPeriod, '2025')
  assert.equal(by.swing.direction, '波动')
  assert.equal(by.flat.direction, '基本持平')
  assert.equal(by.sparse.direction, '数据不足')
  assert.deepEqual(by.gap.missingPeriods, ['2022'])
  assert.equal(/\d+\.\d|\b(?!20\d\d)\d+\b/.test(JSON.stringify(labels.map(l => l.direction))), false)
})
