/**
 * 生产系统提示词评测：组装稿来自 assembleSystemPrompt，不是评测短稿。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { PLANNING_SYSTEM_PROMPT } from '../eval/agent/planning/prompt.mjs'
import { buildPlanningMessages, runPlanningCase } from '../eval/agent/planning/loop.mjs'
import { buildPlanningRecord } from '../eval/agent/planning/archive-record.mjs'
import { renderPlanningBriefingMd } from '../eval/agent/planning/archive-briefing.mjs'
import {
  assembleProductSystemPrompt,
  buildProductPlanningMessages,
} from '../eval/agent/prompt/assemble.mjs'

test('product system prompt is assembleSystemPrompt, not the eval short draft', () => {
  const text = assembleProductSystemPrompt()
  assert.ok(text.includes('【系统底线'))
  assert.ok(text.includes('不提供具体买卖建议'))
  assert.ok(text.includes('query_data'))
  assert.ok(text.includes('propose_widget'))
  assert.ok(text.includes('【右侧研究画布'))
  assert.notEqual(text, PLANNING_SYSTEM_PROMPT)
  assert.ok(text.length > PLANNING_SYSTEM_PROMPT.length * 3)
})

test('default product prompt does not load artifacts playbook', () => {
  const text = assembleProductSystemPrompt()
  assert.ok(!text.includes('【画布与脑图 — create_canvas / create_mindmap】'))
})

test('product messages put canvas metadata in turn-tail, not the eval short footer', () => {
  const evalCase = {
    task: '把右侧这张改成柱状图',
    context: {
      datasets: [{ id: 'research-ds-1', metric: 'gross_margin', title: '三家轮胎毛利率', entityNames: ['赛轮轮胎'], periodRange: '2021–2025' }],
      proposals: [],
      widgets: [{ id: 'w-1', type: 'line', title: '三家轮胎毛利率', datasetId: 'research-ds-1' }],
    },
  }
  const messages = buildProductPlanningMessages(evalCase)
  assert.equal(messages[0].role, 'system')
  assert.ok(messages[0].content.includes('【系统底线'))
  assert.equal(messages[1].role, 'user')
  assert.equal(messages[1].content, '把右侧这张改成柱状图')
  const tail = messages.find((m, i) => i > 1 && m.role === 'user')
  assert.ok(tail)
  assert.match(String(tail.content), /本轮动态说明/)
  assert.match(String(tail.content), /w-1/)
  assert.match(String(tail.content), /会话时钟/)
  assert.ok(!String(tail.content).includes('用户指「右侧这张」时优先已有组件；改图种用 update_widget，不要 propose_widget。'))
})

test('runPlanningCase can start from product messages', async () => {
  const evalCase = { id: 'pl-001', task: '比较美的和格力营收' }
  const complete = async ({ messages }) => {
    assert.ok(messages[0].content.includes('【系统底线'))
    return { calls: [] }
  }
  await runPlanningCase({
    evalCase,
    complete,
    buildMessages: buildProductPlanningMessages,
  })
})

test('prompt-layer briefing names the production prompt and reproduce command', () => {
  const record = buildPlanningRecord({
    kind: 'official',
    layer: 'prompt',
    at: '2026-09-14T12:00:00.000Z',
    llm: { model: 'deepseek-flash', apiKey: 'sk-secret' },
    prompt: 'sys',
    notes: '生产 assembleSystemPrompt',
    report: { judged: 1, passed: 1, failed: 0, skipped: 0, results: [] },
  })
  assert.equal(record.layer, 'prompt')
  const md = renderPlanningBriefingMd(record)
  assert.ok(md.includes('生产提示词'))
  assert.ok(md.includes('eval:agent:prompt'))
  assert.ok(!md.includes('sk-secret'))
})
