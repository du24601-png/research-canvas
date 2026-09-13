/**
 * Dataset aggregate_groups derive
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateDatasetByGroups } from '../packages/shared/dist/research-dataset-aggregate.js'

const parent = {
  id: 'research-ds-00000000-0000-4000-8000-000000000001',
  title: '八家毛利率',
  metric: 'gross_margin',
  unit: '%',
  entities: [
    { id: 'e1', name: '宁德', ticker: '300750.SZ', market: 'CN', type: 'equity' },
    { id: 'e2', name: '亿纬', ticker: '300014.SZ', market: 'CN', type: 'equity' },
    { id: 'e3', name: '比亚迪', ticker: '002594.SZ', market: 'CN', type: 'equity' },
    { id: 'e4', name: '赛力斯', ticker: '601127.SH', market: 'CN', type: 'equity' },
  ],
  periods: ['2024', '2025'],
  data: [
    { entityId: 'e1', period: '2024', value: 20 },
    { entityId: 'e2', period: '2024', value: 18 },
    { entityId: 'e3', period: '2024', value: 16 },
    { entityId: 'e4', period: '2024', value: 28 },
    { entityId: 'e1', period: '2025', value: 22 },
    { entityId: 'e2', period: '2025', value: null },
    { entityId: 'e3', period: '2025', value: 14 },
    { entityId: 'e4', period: '2025', value: 26 },
  ],
  sources: [
    { provider: 'tushare', entityId: 'e1', metric: 'gross_margin', period: '2024', fetchedAt: '2026-01-01T00:00:00.000Z' },
  ],
}

test('aggregate_groups arithmetic mean ignores null and keeps member sources', () => {
  const result = aggregateDatasetByGroups(parent, [
    { id: 'group-00000000-0000-4000-8000-000000000010', name: '电池链条', memberIds: ['e1', 'e2'] },
    { id: 'group-00000000-0000-4000-8000-000000000011', name: '整车链条', memberIds: ['e3', 'e4'] },
  ], 'arithmetic_mean')
  assert.ok(!('error' in result))
  assert.equal(result.entities.length, 2)
  assert.equal(result.entities[0].type, 'group')
  const battery2024 = result.data.find(point => point.entityId === result.entities[0].id && point.period === '2024')
  assert.equal(battery2024?.value, 19)
  const battery2025 = result.data.find(point => point.entityId === result.entities[0].id && point.period === '2025')
  assert.equal(battery2025?.value, 22)
  assert.ok(result.sources.some(source => source.entityId === 'e1'))
})

test('aggregate_groups rejects overlapping members', () => {
  const result = aggregateDatasetByGroups(parent, [
    { id: 'group-00000000-0000-4000-8000-000000000010', name: 'A', memberIds: ['e1', 'e2'] },
    { id: 'group-00000000-0000-4000-8000-000000000011', name: 'B', memberIds: ['e2', 'e3'] },
  ], 'arithmetic_mean')
  assert.equal(result.error, '同一公司不能出现在多个分组')
})
