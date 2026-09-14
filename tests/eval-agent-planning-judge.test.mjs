/**
 * 规划评测判分：硬约束一票否决 + gold 有序子序列 + 决策次数。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { judgePlanningCase } from '../eval/agent/planning/judge.mjs'

function goldCase(over = {}) {
  return {
    id: 'pl-001',
    gold: {
      chain: [
        { name: 'query_data', args: { metric: { eq: 'revenue' }, confirmed: { absent_or_false: true } } },
        { name: 'propose_widget' },
      ],
      optional: ['search_instruments'],
      max_decisions: 4,
    },
    constraints: [
      { id: 'no_steal_canvas', type: 'forbid_tool', tools: ['create_widget', 'create_canvas'] },
      { id: 'no_web', type: 'forbid_tool', tools: ['web_search'] },
    ],
    ...over,
  }
}

test('ordered chain passes with optional search before query_data', () => {
  const row = judgePlanningCase(goldCase(), {
    calls: [
      { name: 'search_instruments', args: { keyword: '美的' } },
      { name: 'query_data', args: { metric: 'revenue', entities: ['美的集团'] } },
      { name: 'propose_widget', args: { datasetId: 'research-ds-eval-1' } },
    ],
  })
  assert.equal(row.pass, true)
  assert.equal(row.stats.decisions, 3)
  assert.equal(row.stats.matched_steps, 2)
})

test('missing propose_widget fails the chain', () => {
  const row = judgePlanningCase(goldCase(), {
    calls: [{ name: 'query_data', args: { metric: 'revenue' } }],
  })
  assert.equal(row.pass, false)
  assert.ok(row.reasons.some((r) => r.includes('propose_widget')))
})

test('reversed order fails even if both tools appear', () => {
  const row = judgePlanningCase(goldCase(), {
    calls: [
      { name: 'propose_widget', args: {} },
      { name: 'query_data', args: { metric: 'revenue' } },
    ],
  })
  assert.equal(row.pass, false)
})

test('create_widget is a hard fail even when chain is otherwise valid', () => {
  const row = judgePlanningCase(goldCase(), {
    calls: [
      { name: 'query_data', args: { metric: 'revenue' } },
      { name: 'propose_widget', args: {} },
      { name: 'create_widget', args: {} },
    ],
  })
  assert.equal(row.pass, false)
  assert.ok(row.reasons.some((r) => r.includes('no_steal_canvas')))
})

test('confirmed:true after user_confirm does not trip no_early_confirm', () => {
  const evalCase = goldCase({
    gold: {
      chain: [
        { name: 'query_data', args: { confirmed: { absent_or_false: true } } },
        { name: 'ask_user' },
        { name: 'query_data', args: { confirmed: { eq: true } } },
        { name: 'propose_widget' },
      ],
      optional: [],
      max_decisions: 5,
    },
    constraints: [
      { id: 'no_early_confirm', type: 'forbid_args', name: 'query_data', args: { confirmed: { eq: true } }, unless_after: 'user_confirm' },
    ],
  })
  const row = judgePlanningCase(evalCase, {
    events: { user_confirm: true },
    calls: [
      { name: 'query_data', args: { metric: 'revenue' } },
      { name: 'ask_user', args: { prompt: '确认？' } },
      { name: 'query_data', args: { metric: 'revenue', confirmed: true } },
      { name: 'propose_widget', args: {} },
    ],
  })
  assert.equal(row.pass, true)
})

test('first query_data with confirmed:true fails many-entity gold', () => {
  const evalCase = goldCase({
    gold: {
      chain: [
        { name: 'query_data', args: { confirmed: { absent_or_false: true } } },
        { name: 'query_data', args: { confirmed: { eq: true } } },
        { name: 'propose_widget' },
      ],
      optional: [],
      max_decisions: 5,
    },
    constraints: [
      { id: 'no_early_confirm', type: 'forbid_args', name: 'query_data', args: { confirmed: { eq: true } }, unless_after: 'user_confirm' },
    ],
  })
  const row = judgePlanningCase(evalCase, {
    calls: [
      { name: 'query_data', args: { metric: 'revenue', confirmed: true } },
    ],
  })
  assert.equal(row.pass, false)
  assert.ok(row.reasons.some((r) => r.includes('no_early_confirm') || r.includes('query_data')))
})

test('query_data before resolve_industry_universe hits forbid_tool_until', () => {
  const evalCase = goldCase({
    gold: {
      chain: [
        { name: 'resolve_industry_universe' },
        { name: 'ask_user' },
        { name: 'query_data' },
        { name: 'propose_widget' },
      ],
      optional: [],
      max_decisions: 6,
    },
    constraints: [
      { id: 'universe_first', type: 'forbid_tool_until', tools: ['query_data'], until: 'resolve_industry_universe' },
    ],
  })
  const row = judgePlanningCase(evalCase, {
    calls: [{ name: 'query_data', args: { metric: 'gross_margin' } }],
  })
  assert.equal(row.pass, false)
  assert.ok(row.reasons.some((r) => r.includes('universe_first')))
})

test('empty chain and zero tools passes no-fetch cases', () => {
  const row = judgePlanningCase({
    id: 'pl-010',
    gold: { chain: [], optional: [], max_decisions: 0 },
    constraints: [
      { id: 'no_index_fetch', type: 'forbid_tool', tools: ['query_data', 'resolve_industry_universe'] },
    ],
  }, { calls: [] })
  assert.equal(row.pass, true)
  assert.equal(row.stats.decisions, 0)
})

test('max_decisions fails when the model wanders', () => {
  const row = judgePlanningCase(goldCase({
    gold: { chain: [{ name: 'query_data' }], optional: ['search_instruments'], max_decisions: 1 },
    constraints: [],
  }), {
    calls: [
      { name: 'query_data', args: {} },
      { name: 'search_instruments', args: {} },
    ],
  })
  assert.equal(row.pass, false)
  assert.ok(row.reasons.some((r) => r.includes('max_decisions')))
})

test('refine_dataset matches flattened operation_type', () => {
  const row = judgePlanningCase({
    id: 'pl-011',
    gold: {
      chain: [
        { name: 'refine_dataset', args: { operation_type: { eq: 'remove_entities' } } },
        { name: 'propose_widget' },
      ],
      optional: [],
      max_decisions: 3,
    },
    constraints: [{ id: 'no_requery', type: 'forbid_tool', tools: ['query_data'] }],
  }, {
    calls: [
      { name: 'refine_dataset', args: { datasetId: 'research-ds-1', operation: { type: 'remove_entities', entities: ['森麒麟'] } } },
      { name: 'propose_widget', args: {} },
    ],
  })
  assert.equal(row.pass, true)
})
