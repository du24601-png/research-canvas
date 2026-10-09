import test from 'node:test'
import assert from 'node:assert/strict'
import { scoreComposer, specNumbers } from '../eval/finframe/composer-eval.mjs'
import { snapshotLookup, withSnapshotValues } from '../eval/finframe/snapshot-data.mjs'

const DS = 'research-ds-ff-1'
const ui = { any_of: ['TrendView', 'ComparisonView'], highlight: true, evidence: true }

test('composer scorer: valid + right components + no numbers passes', () => {
  const spec = { version: 1, blocks: [{ component: 'TrendView', datasetId: DS, actions: ['highlight_largest_change'] }, { component: 'EvidencePanel', datasetIds: [DS] }] }
  assert.equal(scoreComposer({ ui_expect: ui }, { spec }).pass, true)
})

test('composer scorer: invalid, missing highlight, missing evidence, numbers all fail', () => {
  assert.equal(scoreComposer({ ui_expect: ui }, { error: 'bad' }).valid, false)
  const noHighlight = { version: 1, blocks: [{ component: 'TrendView', datasetId: DS }, { component: 'EvidencePanel', datasetIds: [DS] }] }
  assert.equal(scoreComposer({ ui_expect: ui }, { spec: noHighlight }).pass, false)
  const noEvidence = { version: 1, blocks: [{ component: 'TrendView', datasetId: DS, actions: ['highlight_largest_change'] }] }
  assert.equal(scoreComposer({ ui_expect: ui }, { spec: noEvidence }).pass, false)
  assert.deepEqual(specNumbers({ version: 1, blocks: [{ component: 'TrendView', datasetId: 'research-ds-aaaa-1', title: '2024 年增长 12%' }] }), ['12'])
  assert.equal(scoreComposer({}, { spec: noEvidence }).applicable, false)
})

test('snapshot lookup: real values by code, banks have no gross margin, unknown cells miss', () => {
  const hit = snapshotLookup('600519', 'net_margin', '2024')
  assert.equal(hit.hit, true)
  assert.equal(typeof hit.value, 'number')
  assert.deepEqual(snapshotLookup('600036.SH', 'gross_margin', '2024'), { hit: true, value: null })
  assert.equal(snapshotLookup('600519', 'revenue', '2024').hit, false)
  const ds = { metric: 'roe', entities: [{ id: 'e', ticker: '000858' }], data: [{ entityId: 'e', period: '2023', value: 1 }, { entityId: 'e', period: '2030', value: 2 }] }
  const swapped = withSnapshotValues(ds)
  assert.equal(swapped.hits, 1)
  assert.equal(swapped.dataset.data[1].value, 2)
})
