/**
 * FinFrame M4 Composer：只看元数据、产出经校验的 Spec、失败静默；钩子按开关运行并发 research_ui_spec。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  composeResearchUi,
  datasetMetaForComposer,
  extractJsonObject,
  turnDatasetIds,
} from '../packages/agent/dist/research-ui-composer.js'
import { runResearchUiComposer } from '../packages/agent/dist/research-ui-composer-hook.js'
import { beginResearchCanvasTurn, endResearchCanvasTurn } from '../packages/agent/dist/research-canvas-turn-state.js'

const A = { id: 'CN:SH.600519', name: '贵州茅台', ticker: '600519.SH', market: 'CN', type: 'equity' }
const DS = {
  id: 'research-ds-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  title: '贵州茅台净利率',
  metric: 'net_margin',
  unit: '%',
  entities: [A],
  periods: ['2024', '2025'],
  data: [{ entityId: A.id, period: '2024', value: 52.27 }, { entityId: A.id, period: '2025', value: null }],
  sources: [{ provider: 'tushare', entityId: A.id, metric: 'net_margin', period: '2024', fetchedAt: '2026-10-09T00:00:00.000Z' }],
}
const GOOD = { version: 1, blocks: [{ component: 'TrendView', datasetId: DS.id, actions: ['pin'] }, { component: 'MissingData', datasetId: DS.id }, { component: 'EvidencePanel', datasetIds: [DS.id] }] }
const step = (tool, result) => ({ id: tool, tool, label: tool, status: 'done', startedAt: '', resultDetail: JSON.stringify(result) })

test('composer input is metadata only: no values reach the model', async () => {
  const meta = datasetMetaForComposer(DS)
  assert.deepEqual(meta, { id: DS.id, metric: '净利率', entities: ['贵州茅台'], entityIds: [A.id], periods: ['2024', '2025'], coverage: '1/2', complete: false })
  let seen = ''
  await composeResearchUi({ task: '看茅台净利率', datasets: [DS], chat: async (messages) => { seen = JSON.stringify(messages); return JSON.stringify(GOOD) } })
  assert.equal(seen.includes('52.27'), false)
})

test('valid model output becomes a spec; bad output fails closed', async () => {
  const ok = await composeResearchUi({ task: 't', datasets: [DS], chat: async () => `好的：\n\`\`\`json\n${JSON.stringify(GOOD)}\n\`\`\`` })
  assert.deepEqual(ok.spec, GOOD)
  const bad = [
    { version: 1, blocks: [{ component: 'TrendView', datasetId: DS.id, title: '净利率 52%' }] },
    { version: 1, blocks: [{ component: 'TrendView', datasetId: 'research-ds-other' }] },
    { version: 1, blocks: [{ component: 'Chart3D', datasetId: DS.id }] },
  ]
  for (const raw of bad) {
    const result = await composeResearchUi({ task: 't', datasets: [DS], chat: async () => JSON.stringify(raw) })
    assert.ok(result.error, JSON.stringify(raw))
  }
  assert.ok((await composeResearchUi({ task: 't', datasets: [DS], chat: async () => 'not json' })).error)
  assert.ok((await composeResearchUi({ task: 't', datasets: [DS], chat: async () => { throw new Error('timeout') } })).error)
  assert.ok((await composeResearchUi({ task: 't', datasets: [], chat: async () => JSON.stringify(GOOD) })).error)
  assert.equal(extractJsonObject('no braces'), null)
})

test('composer accepts NumberSentence + KpiRow first and rejects digit leaks', async () => {
  const lead = { version: 1, blocks: [{ component: 'NumberSentence', datasetId: DS.id, template: `{entity:${A.id}} 2024 年净利率 {value:${A.id}@2024}` }, { component: 'KpiRow', datasetId: DS.id }, ...GOOD.blocks] }
  let system = ''
  const ok = await composeResearchUi({ task: 't', datasets: [DS], chat: async (messages) => { system = messages[0].content; return JSON.stringify(lead) } })
  assert.deepEqual(ok.spec, lead)
  assert.ok(system.includes('NumberSentence') && system.includes('KpiRow'))
  const leak = { version: 1, blocks: [{ component: 'NumberSentence', datasetId: DS.id, template: `{entity:${A.id}} 净利率 52.27%` }] }
  assert.ok((await composeResearchUi({ task: 't', datasets: [DS], chat: async () => JSON.stringify(leak) })).error)
})

test('turnDatasetIds reads this turn\'s query_data / refine_dataset results only', () => {
  const steps = [step('query_data', { ok: true, datasetId: DS.id }), step('propose_widget', { datasetId: 'x' }), step('refine_dataset', { error: 'bad' })]
  assert.deepEqual(turnDatasetIds(steps), [DS.id])
})

test('hook: off → nothing; on → emits research_ui_spec with a compose step', async () => {
  const events = []
  const base = { sessionId: 'composer-hook', task: 't', steps: [step('query_data', { ok: true, datasetId: DS.id })], chat: async () => JSON.stringify(GOOD), emit: e => events.push(e) }
  beginResearchCanvasTurn('composer-hook', { widgets: [], datasetRecords: [DS] })
  try {
    assert.equal(await runResearchUiComposer({ ...base, enabled: false }), null)
    assert.equal(events.length, 0)
    const out = await runResearchUiComposer({ ...base, enabled: true })
    assert.equal(out.tool, 'compose_research_ui')
    assert.deepEqual(JSON.parse(out.resultDetail).spec, GOOD)
    assert.equal(events[0].type, 'research_ui_spec')
    assert.equal(await runResearchUiComposer({ ...base, enabled: true, chat: async () => '{}' }), null)
  } finally {
    endResearchCanvasTurn('composer-hook')
  }
})

test('composer describes MetricTable / KeyPoints / 个股速览 and accepts the layout', async () => {
  const metric = (id, m) => ({ ...DS, id, metric: m, title: m, periods: ['2023', '2024', '2025'], data: ['2023', '2024', '2025'].map((period, i) => ({ entityId: A.id, period, value: 10 + i })) })
  const sets = [
    metric('research-ds-aaaaaaaa-aaaa-4aaa-8aaa-000000000001', 'revenue'),
    metric('research-ds-aaaaaaaa-aaaa-4aaa-8aaa-000000000002', 'revenue_growth'),
    metric('research-ds-aaaaaaaa-aaaa-4aaa-8aaa-000000000003', 'gross_margin'),
    metric('research-ds-aaaaaaaa-aaaa-4aaa-8aaa-000000000004', 'net_margin'),
    metric('research-ds-aaaaaaaa-aaaa-4aaa-8aaa-000000000005', 'roe'),
  ]
  const ids = sets.map(s => s.id)
  const overview = {
    version: 1,
    blocks: [
      { component: 'NumberSentence', datasetId: ids[0], template: `{entity:${A.id}} 2025 年营收 {value:${A.id}@2025}，较上年 {delta:${A.id}@2025}` },
      { component: 'KpiRow', datasetId: ids[0] },
      { component: 'KpiRow', datasetId: ids[3] },
      { component: 'TrendView', datasetId: ids[0], actions: ['pin'] },
      { component: 'KeyPoints', datasetIds: ids.slice(0, 4) },
      { component: 'MetricTable', datasetIds: ids.slice(0, 4) },
      { component: 'MetricTable', datasetIds: ids.slice(4) },
      { component: 'EvidencePanel', datasetIds: ids.slice(0, 4) },
      { component: 'EvidencePanel', datasetIds: ids.slice(4) },
    ],
  }
  let system = ''
  const out = await composeResearchUi({ task: '茅台个股速览', datasets: sets, chat: async (messages) => { system = messages[0].content; return JSON.stringify(overview) } })
  assert.deepEqual(out.spec, overview)
  for (const word of ['MetricTable', 'KeyPoints', '个股速览', '1–10']) assert.ok(system.includes(word), word)
  const withPoints = { version: 1, blocks: [{ component: 'KeyPoints', datasetIds: [ids[0]], points: ['营收创新高'] }] }
  assert.ok((await composeResearchUi({ task: 't', datasets: sets, chat: async () => JSON.stringify(withPoints) })).error)
})

test('composer retries once with validator errors, then fails closed', async () => {
  const calls = []
  const fixed = await composeResearchUi({
    task: 't',
    datasets: [DS],
    chat: async (messages) => { calls.push(messages); return calls.length === 1 ? 'not json' : JSON.stringify(GOOD) },
  })
  assert.ok(fixed.spec, 'second attempt is accepted')
  assert.equal(calls.length, 2)
  assert.equal(calls[1].at(-2).role, 'assistant')
  assert.match(calls[1].at(-1).content, /没通过校验/)

  let n = 0
  const failed = await composeResearchUi({ task: 't', datasets: [DS], chat: async () => { n += 1; return 'still not json' } })
  assert.ok(failed.error)
  assert.equal(n, 2, 'at most one retry')

  let m = 0
  const thrown = await composeResearchUi({ task: 't', datasets: [DS], chat: async () => { m += 1; throw new Error('timeout') } })
  assert.ok(thrown.error)
  assert.equal(m, 1, 'no retry when the model call itself fails')
})
