/**
 * 取数前确认（方案 B）：开关关时零影响；1–3 家先发计划、倒计时后继续；倒计时内有 steer 则跳过本次取数。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { planForQueryData, runPlanGate } from '../packages/agent/dist/research-plan-gate.js'

const ARGS = { entities: ['贵州茅台', '五粮液'], metric: 'net_margin', start: '2021', end: '2025' }

function input(extra = {}) {
  const events = []
  return { events, opts: { enabled: true, tool: 'query_data', args: ARGS, stepId: 'call_1', emit: e => events.push(e), hasSteer: () => false, waitMs: 30, ...extra } }
}

test('off, other tools, confirmed or 4+ companies: no event, no wait', async () => {
  for (const extra of [{ enabled: false }, { tool: 'propose_widget' }, { args: { ...ARGS, confirmed: true } }, { args: { ...ARGS, entities: ['a', 'b', 'c', 'd'] } }]) {
    const { events, opts } = input(extra)
    assert.equal(await runPlanGate(opts), null)
    assert.equal(events.length, 0, JSON.stringify(extra))
  }
})

test('emits the plan with a real metric label, then auto-continues', async () => {
  const { events, opts } = input()
  assert.equal(await runPlanGate(opts), null)
  assert.equal(events[0].type, 'research_plan')
  assert.equal(events[0].stepId, 'call_1')
  assert.equal(events[0].plan.statement, '查 贵州茅台、五粮液，净利率，2021–2025 年年报')
  assert.equal(events[0].autoContinueMs, 30)
})

test('a steer during the countdown cancels this fetch and tells the model to read it', async () => {
  let steered = false
  setTimeout(() => { steered = true }, 5)
  const { opts } = input({ hasSteer: () => steered, waitMs: 2000 })
  const started = Date.now()
  const result = await runPlanGate(opts)
  assert.equal(result.status, 'plan_cancelled')
  assert.ok(Date.now() - started < 1000, 'stops waiting as soon as the steer arrives')
  assert.equal(planForQueryData({ ...ARGS, metric: 'not_a_metric' }), null)
})
