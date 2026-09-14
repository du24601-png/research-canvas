/**
 * 规划评测留档：指标入简报，不含密钥。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPlanningRecord } from '../eval/agent/planning/archive-record.mjs'
import { renderPlanningBriefingMd } from '../eval/agent/planning/archive-briefing.mjs'
import { tallyPlanningSummary } from '../eval/agent/planning/run-suite.mjs'

test('planning briefing includes failure rate and avg decisions', () => {
  const results = [
    {
      caseId: 'pl-001', family: 'named_compare', question: '比较营收', pass: true, skipped: false,
      reasons: [], tool_names: ['query_data', 'propose_widget'], stats: { decisions: 2, step_precision: 1 },
    },
    {
      caseId: 'pl-010', family: 'industry', question: '沪深300', pass: false, skipped: false,
      reasons: ['no_index_fetch：禁止工具 resolve_industry_universe'],
      tool_names: ['resolve_industry_universe'], stats: { decisions: 1, step_precision: 0 },
    },
  ]
  const summary = tallyPlanningSummary(results)
  assert.equal(summary.passed, 1)
  assert.equal(summary.failure_rate, 0.5)
  assert.equal(summary.effective_ratio, 0.5)
  assert.equal(summary.avg_decisions, 1.5)
  assert.equal(summary.avg_decisions_passed, 2)
  assert.equal(summary.constraint_hits.no_index_fetch, 1)
  const record = buildPlanningRecord({
    kind: 'official',
    at: '2026-09-14T12:00:00.000Z',
    llm: { model: 'deepseek-flash', apiKey: 'sk-secret' },
    prompt: 'sys',
    report: { ...summary, results },
  })
  assert.equal('apiKey' in record.llm, false)
  const md = renderPlanningBriefingMd(record)
  assert.ok(md.includes('有效占比'))
  assert.ok(md.includes('失败频率'))
  assert.ok(md.includes('平均决策次数'))
  assert.ok(!md.includes('sk-secret'))
})
