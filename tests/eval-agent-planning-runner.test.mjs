/**
 * 夹具多轮：不打 Tushare，按 user_script 注入确认句。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { runPlanningCase, matchingIdleScript } from '../eval/agent/planning/loop.mjs'
import { stubTool, initFixtureState } from '../eval/agent/planning/fixtures.mjs'
import { judgePlanningCase } from '../eval/agent/planning/judge.mjs'

const named = {
  id: 'pl-001',
  task: '比较美的集团和格力电器 2020 到 2024 年营收',
  gold: {
    chain: [
      { name: 'query_data', args: { metric: { eq: 'revenue' } } },
      { name: 'propose_widget' },
    ],
    optional: ['search_instruments'],
    max_decisions: 4,
  },
  constraints: [
    { id: 'no_steal_canvas', type: 'forbid_tool', tools: ['create_widget', 'create_canvas'] },
  ],
}

test('>3 entities without confirmed returns plan_preview fixture', () => {
  const state = initFixtureState({})
  const body = stubTool({
    name: 'query_data',
    args: { entities: ['a', 'b', 'c', 'd', 'e'], metric: 'revenue' },
  }, {}, state)
  assert.equal(body.status, 'plan_preview')
  assert.equal(state.lastStatus, 'plan_preview')
})

test('runPlanningCase records stubbed two-step canvas chain', async () => {
  let n = 0
  const complete = async () => {
    n += 1
    if (n === 1) {
      return { calls: [{ name: 'query_data', args: { entities: ['美的集团', '格力电器'], metric: 'revenue', start: '2020', end: '2024' } }] }
    }
    if (n === 2) return { calls: [{ name: 'propose_widget', args: {} }] }
    return { calls: [] }
  }
  const trace = await runPlanningCase({ evalCase: named, complete })
  assert.deepEqual(trace.calls.map((c) => c.name), ['query_data', 'propose_widget'])
  const judged = judgePlanningCase(named, trace)
  assert.equal(judged.pass, true)
})

test('idle after plan_preview injects the user_script confirm turn', async () => {
  const evalCase = {
    ...named,
    id: 'pl-005',
    user_script: [{ when: 'plan_preview', content: '确认，按这个名单查' }],
  }
  let n = 0
  const complete = async ({ messages }) => {
    n += 1
    if (n === 1) {
      return {
        calls: [{
          name: 'query_data',
          args: { entities: ['茅台', '五粮液', '洋河', '泸州老窖', '汾酒'], metric: 'revenue' },
        }],
      }
    }
    if (n === 2) return { calls: [], message: { content: '请确认名单' } }
    const last = messages[messages.length - 1]
    assert.equal(last.role, 'user')
    assert.equal(last.content, '确认，按这个名单查')
    return { calls: [] }
  }
  const trace = await runPlanningCase({ evalCase, complete })
  assert.equal(trace.calls[0].name, 'query_data')
  assert.equal(trace.events.user_confirm, true)
  assert.ok(n >= 3)
})

test('matchingIdleScript only fires on plan_preview status', () => {
  const evalCase = { user_script: [{ when: 'plan_preview', content: '确认' }] }
  const miss = matchingIdleScript(evalCase, { scriptIndex: 0, lastStatus: 'dataset', lastTool: 'query_data' })
  const hit = matchingIdleScript(evalCase, { scriptIndex: 0, lastStatus: 'plan_preview', lastTool: 'query_data' })
  assert.equal(miss, null)
  assert.equal(hit.content, '确认')
})

test('tool_idle after quotes still matches if last tool was snapshot', () => {
  const evalCase = {
    user_script: [{ when: 'tool_idle', tool: 'get_instrument_quotes', content: '那再看近五年毛利率' }],
  }
  const miss = matchingIdleScript(evalCase, {
    scriptIndex: 0,
    lastTool: 'get_instrument_snapshot',
    calledTools: new Set(),
  })
  const hit = matchingIdleScript(evalCase, {
    scriptIndex: 0,
    lastTool: 'get_instrument_snapshot',
    calledTools: new Set(['get_instrument_quotes']),
  })
  assert.equal(miss, null)
  assert.equal(hit.content, '那再看近五年毛利率')
})

test('idle after quotes+snapshot still injects the quotes follow-up', async () => {
  const evalCase = {
    task: '五粮液现在什么价',
    user_script: [{ when: 'tool_idle', tool: 'get_instrument_quotes', content: '那再看近五年毛利率' }],
  }
  let n = 0
  const complete = async ({ messages }) => {
    n += 1
    if (n === 1) return { calls: [{ name: 'get_instrument_quotes', args: { symbol: '000858' } }] }
    if (n === 2) return { calls: [{ name: 'get_instrument_snapshot', args: { symbol: '000858' } }] }
    if (n === 3) return { calls: [] }
    if (n === 4) {
      const last = messages[messages.length - 1]
      assert.equal(last.role, 'user')
      assert.equal(last.content, '那再看近五年毛利率')
      return { calls: [] }
    }
    return { calls: [] }
  }
  await runPlanningCase({ evalCase, complete })
  assert.ok(n >= 4)
})

test('ask_user after plan_preview consumes confirm script and sets user_confirm', async () => {
  const evalCase = {
    ...named,
    id: 'pl-005',
    user_script: [{ when: 'plan_preview', content: '确认，按这个名单查' }],
    gold: {
      chain: [
        { name: 'query_data', args: { confirmed: { absent_or_false: true } } },
        { name: 'query_data', args: { confirmed: { eq: true } } },
        { name: 'propose_widget' },
      ],
      optional: ['ask_user'],
      max_decisions: 5,
    },
    constraints: [
      { id: 'no_early_confirm', type: 'forbid_args', name: 'query_data', args: { confirmed: { eq: true } }, unless_after: 'user_confirm' },
    ],
  }
  let n = 0
  const complete = async () => {
    n += 1
    if (n === 1) {
      return { calls: [{ name: 'query_data', args: { entities: ['茅台', '五粮液', '洋河', '泸州老窖', '汾酒'], metric: 'revenue' } }] }
    }
    if (n === 2) return { calls: [{ name: 'ask_user', args: { prompt: '确认取数？', mode: 'confirm' } }] }
    if (n === 3) {
      return { calls: [{ name: 'query_data', args: { entities: ['茅台', '五粮液', '洋河', '泸州老窖', '汾酒'], metric: 'revenue', confirmed: true } }] }
    }
    if (n === 4) return { calls: [{ name: 'propose_widget', args: {} }] }
    return { calls: [] }
  }
  const trace = await runPlanningCase({ evalCase, complete })
  assert.equal(trace.events.user_confirm, true)
  assert.deepEqual(trace.calls.map((c) => c.name), ['query_data', 'ask_user', 'query_data', 'propose_widget'])
  assert.equal(judgePlanningCase(evalCase, trace).pass, true)
})

test('ask_user without script does not auto-confirm', () => {
  const state = initFixtureState({})
  const body = stubTool({ name: 'ask_user', args: { prompt: '换指标？' } }, { user_script: [] }, state)
  assert.equal(body.cancelled, true)
  assert.equal(body.selected_ids[0], 'reject')
})

test('refusal plan_preview script makes ask_user reject', () => {
  const state = initFixtureState({})
  const evalCase = { user_script: [{ when: 'plan_preview', content: '先别查，名单不对' }] }
  const body = stubTool({ name: 'ask_user', args: { prompt: '确认？' } }, evalCase, state)
  assert.equal(body.selected_ids[0], 'reject')
  assert.equal(state.scriptIndex, 1)
})

test('search_instruments returns a match for 中芯国际', () => {
  const body = stubTool({ name: 'search_instruments', args: { keyword: '中芯国际' } }, {}, initFixtureState({}))
  assert.ok(Array.isArray(body.matches) && body.matches.length > 0)
  assert.equal(body.matches[0].symbol, '688981')
})

test('industry universe returns named default_entities', () => {
  const body = stubTool({ name: 'resolve_industry_universe', args: { industry: '白酒' } }, {}, initFixtureState({}))
  assert.ok(Array.isArray(body.default_entities) && body.default_entities.length >= 8)
  assert.ok(body.default_entities.includes('贵州茅台'))
})

test('loadPlanningCases returns 24 planning cases', async () => {
  const { loadPlanningCases } = await import('../eval/agent/planning/load-cases.mjs')
  const cases = await loadPlanningCases()
  assert.equal(cases.length, 24)
  assert.ok(cases.some((c) => c.id === 'pl-001'))
  assert.ok(cases.some((c) => c.id === 'pl-024'))
})
