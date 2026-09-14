/**
 * 单轮组件评测 runner：不执行工具、不打 Tushare。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { catalogToOpenAiTools } from '../eval/agent/component/tools-openai.mjs'
import { loadEvalCases, SKIP_CASE_IDS } from '../eval/agent/component/load-cases.mjs'
import { buildEvalMessages, runComponentSuite } from '../eval/agent/component/run-suite.mjs'

test('catalogToOpenAiTools exposes query_data as an OpenAI function', async () => {
  const tools = await catalogToOpenAiTools()
  assert.equal(tools.length, 16)
  const q = tools.find((t) => t.function?.name === 'query_data')
  assert.ok(q)
  assert.equal(q.type, 'function')
  assert.ok(q.function.parameters.properties.metric)
})

test('loadEvalCases skips qg-005 and keeps the rest', async () => {
  assert.ok(SKIP_CASE_IDS.includes('qg-005'))
  const cases = await loadEvalCases()
  assert.equal(cases.some((c) => c.id === 'qg-005'), false)
  assert.equal(cases.length, 99)
  assert.ok(cases.some((c) => c.id === 'qc-001'))
  assert.ok(cases.some((c) => c.id === 'qc-032'))
  assert.ok(cases.some((c) => c.id === 'ng-001'))
  assert.ok(cases.some((c) => c.id === 'ng-031'))
})

test('runComponentSuite judges mocked first-round tool_calls', async () => {
  const complete = async ({ evalCase }) => {
    if (evalCase.id === 'qc-001') {
      return {
        calls: [{
          name: 'query_data',
          args: {
            entities: ['赛轮轮胎', '玲珑轮胎', '森麒麟'],
            metric: 'gross_margin',
            start: '2021',
            end: '2025',
          },
        }],
      }
    }
    return { calls: [] }
  }
  const report = await runComponentSuite({
    complete,
    caseIds: ['qc-001', 'ng-001', 'qg-005'],
  })
  assert.equal(report.skipped, 1)
  assert.equal(report.judged, 2)
  assert.equal(report.passed, 2)
  assert.equal(report.failed, 0)
  const qc = report.results.find((r) => r.caseId === 'qc-001')
  assert.equal(qc.pass, true)
  assert.deepEqual(qc.tool_names, ['query_data'])
})

test('buildEvalMessages puts the case question in the user turn', () => {
  const msgs = buildEvalMessages({
    id: 'ng-003',
    question: 'ROE 是什么意思？',
    gold: { call_policy: 'must_not_call' },
  })
  assert.equal(msgs[0].role, 'system')
  assert.equal(msgs[1].role, 'user')
  assert.equal(msgs[1].content, 'ROE 是什么意思？')
})

test('llmFromAppConfigDoc reads default_model without exposing unused providers', async () => {
  const { llmFromAppConfigDoc } = await import('../eval/agent/component/load-llm-config.mjs')
  const llm = llmFromAppConfigDoc({
    default_model: 'deepseek:deepseek-flash',
    providers: [{
      id: 'deepseek',
      base_url: 'https://api.deepseek.com/v1',
      api_key: 'sk-test',
      models: ['deepseek-flash'],
    }],
  })
  assert.equal(llm.model, 'deepseek-flash')
  assert.equal(llm.baseUrl, 'https://api.deepseek.com/v1')
  assert.equal(llm.apiKey, 'sk-test')
})
