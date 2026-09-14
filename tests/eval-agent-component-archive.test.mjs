/**
 * 正式评测留档：完整 JSON + 可读简报，不含密钥。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildEvalRecord, publicLlmMeta, tallyByFamily } from '../eval/agent/component/archive-record.mjs'
import { renderEvalBriefingMd } from '../eval/agent/component/archive-briefing.mjs'
import { runComponentSuite } from '../eval/agent/component/run-suite.mjs'

test('publicLlmMeta drops apiKey', () => {
  const pub = publicLlmMeta({
    model: 'deepseek-flash',
    apiKey: 'sk-secret',
    baseUrl: 'https://api.deepseek.com/v1',
  })
  assert.equal(pub.model, 'deepseek-flash')
  assert.equal('apiKey' in pub, false)
  assert.equal(JSON.stringify(pub).includes('sk-secret'), false)
})

test('runComponentSuite rows keep question and call args for archive', async () => {
  const report = await runComponentSuite({
    caseIds: ['qc-001'],
    skipIds: [],
    complete: async () => ({
      calls: [{
        name: 'query_data',
        args: {
          entities: ['赛轮轮胎', '玲珑轮胎', '森麒麟'],
          metric: 'gross_margin',
          start: '2021',
          end: '2025',
        },
      }],
    }),
  })
  const row = report.results[0]
  assert.equal(row.question.includes('毛利率'), true)
  assert.equal(row.family, 'tushare_query_canvas')
  assert.equal(row.calls[0].args.metric, 'gross_margin')
  assert.ok(row.gold.call_policy)
})

test('buildEvalRecord and briefing include score, git, and failures', () => {
  const record = buildEvalRecord({
    kind: 'official',
    datasetId: 'agent-component-tushare-v1',
    at: '2026-09-14T02-56-13-403Z',
    durationMs: 64671,
    git: { commit: 'abc123', dirty: false },
    hashes: { 'tool-catalog.json': 'deadbeef' },
    llm: { model: 'deepseek-flash', apiKey: 'sk-secret' },
    prompt: 'sys',
    skip: ['qg-005'],
    report: {
      judged: 2,
      skipped: 1,
      passed: 1,
      failed: 1,
      pass_rate: 0.5,
      results: [
        {
          caseId: 'qc-001',
          family: 'tushare_query_canvas',
          question: '比较三家毛利率',
          pass: true,
          skipped: false,
          reasons: [],
          tool_names: ['query_data'],
          calls: [{ name: 'query_data', args: { metric: 'gross_margin' } }],
        },
        {
          caseId: 'qg-006',
          family: 'tushare_query_gate',
          question: '沪深300成分股有哪些',
          pass: false,
          skipped: false,
          reasons: ['禁止工具 resolve_industry_universe'],
          tool_names: ['resolve_industry_universe'],
          calls: [{ name: 'resolve_industry_universe', args: { industry: '沪深300' } }],
        },
        {
          caseId: 'qg-005',
          family: 'tushare_query_gate',
          question: '确认，按这个名单查',
          skipped: true,
          pass: null,
          reasons: ['skipped'],
          tool_names: [],
          calls: [],
        },
      ],
    },
  })
  assert.equal(record.schema, 'opptrix.eval.component.v1')
  assert.equal(record.kind, 'official')
  assert.equal(record.git.commit, 'abc123')
  assert.equal(JSON.stringify(record).includes('sk-secret'), false)
  assert.equal(record.summary.by_family.tushare_query_canvas.passed, 1)
  const md = renderEvalBriefingMd(record)
  assert.ok(md.includes('1 / 2'))
  assert.ok(md.includes('qg-006'))
  assert.ok(md.includes('沪深300'))
  assert.ok(md.includes('abc123'))
})

test('tallyByFamily counts skip separate from fail', () => {
  const t = tallyByFamily([
    { family: 'no_tool', skipped: false, pass: true },
    { family: 'no_tool', skipped: true, pass: null },
  ])
  assert.equal(t.no_tool.judged, 1)
  assert.equal(t.no_tool.skipped, 1)
  assert.equal(t.no_tool.passed, 1)
})
