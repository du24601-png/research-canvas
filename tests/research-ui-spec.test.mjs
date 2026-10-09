/**
 * FinFrame M3：UI Spec 校验——只认已注册组件/动作与已知 datasetId，任何不合规整份拒绝，不带数值。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseResearchUiSpec } from '../packages/shared/dist/research-ui-spec.js'

const DS = 'research-ds-11111111-1111-4111-8111-111111111111'
const DELTA = 'research-ds-33333333-3333-4333-8333-333333333333'
const known = new Map([[DS, {}], [DELTA, { parentDatasetId: DS, transformType: 'yoy_delta' }]])

test('valid spec parses to the same blocks', () => {
  const raw = { version: 1, blocks: [{ component: 'TrendView', datasetId: DS, deltaDatasetId: DELTA, title: '2021–2025 净利率', actions: ['highlight_largest_change'] }] }
  const result = parseResearchUiSpec(raw, known)
  assert.equal(result.ok, true)
  assert.deepEqual(result.spec, raw)
})

test('any violation rejects the whole spec with readable errors', () => {
  const cases = [
    { version: 2, blocks: [{ component: 'EvidencePanel', datasetIds: [DS] }] },
    { version: 1, blocks: [] },
    { version: 1, blocks: [{ component: 'EvidencePanel', datasetIds: [DS] }], extra: true },
    { version: 1, blocks: [{ component: 'TrendView', datasetId: DS, title: '同比 +3.1' }] },
    { version: 1, blocks: [{ component: 'TrendView', datasetId: DS, actions: ['highlight_largest_change'] }] },
    { version: 1, blocks: [{ component: 'TrendView', datasetId: DELTA, deltaDatasetId: DS }] },
    { version: 1, blocks: [{ component: 'ComparisonView', datasetIds: [DS, DS] }] },
    { version: 1, blocks: [{ component: 'MissingData', datasetId: 'research-ds-unknown' }] },
  ]
  for (const raw of cases) {
    const result = parseResearchUiSpec(raw, known)
    assert.equal(result.ok, false, JSON.stringify(raw))
    assert.ok(result.errors.length > 0)
  }
})
