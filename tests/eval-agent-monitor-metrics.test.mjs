/**
 * 每次正式/冒烟评测简报必须含本表：有效占比、失败频率、决策次数、步骤有效率、约束击穿、耗时。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { formatMonitorLogLines, renderMonitorMetricsMd } from '../eval/agent/monitor-metrics.mjs'
import { buildPlanningRecord } from '../eval/agent/planning/archive-record.mjs'
import { renderPlanningBriefingMd } from '../eval/agent/planning/archive-briefing.mjs'
import { tallyPlanningSummary } from '../eval/agent/planning/run-suite.mjs'
import { buildEvalRecord } from '../eval/agent/component/archive-record.mjs'
import { renderEvalBriefingMd } from '../eval/agent/component/archive-briefing.mjs'

function hasMetricTable(md) {
  assert.ok(md.includes('## 监控指标'))
  assert.ok(md.includes('| 有效占比 |'))
  assert.ok(md.includes('| 失败频率 |'))
  assert.ok(md.includes('| 平均决策次数（全量） |'))
  assert.ok(md.includes('| 平均决策次数（通过题） |'))
  assert.ok(md.includes('| 步骤有效率 |'))
  assert.ok(md.includes('| 约束击穿 |'))
  assert.ok(md.includes('| 耗时 |'))
}

test('monitor log lines cover the same metrics as the table', () => {
  const lines = formatMonitorLogLines('eval:prompt', {
    judged: 24,
    passed: 22,
    failed: 2,
    failure_rate: 2 / 24,
    avg_decisions: 1.92,
    avg_decisions_passed: 1.77,
    avg_step_precision: 0.885,
    constraint_hits: {},
  }, 149025)
  assert.ok(lines.some((l) => l.includes('failure_rate=8.3%')))
  assert.ok(lines.some((l) => l.includes('avg_decisions=1.92')))
  assert.ok(lines.some((l) => l.includes('step_precision=88.5%')))
  assert.ok(lines.some((l) => l.includes('constraint_hits=无') && l.includes('duration=149s')))
})

test('monitor table formats duration and constraint hits', () => {
  const md = renderMonitorMetricsMd({
    duration_ms: 149025,
    summary: {
      judged: 24,
      passed: 22,
      failed: 2,
      avg_decisions: 1.92,
      avg_decisions_passed: 1.77,
      avg_step_precision: 0.885,
      constraint_hits: { no_index_fetch: 1 },
    },
  }).join('\n')
  assert.ok(md.includes('22 / 24（91.7%）'))
  assert.ok(md.includes('8.3%（2 题）'))
  assert.ok(md.includes('1.92'))
  assert.ok(md.includes('88.5%'))
  assert.ok(md.includes('no_index_fetch×1'))
  assert.ok(md.includes('149s'))
})

test('planning and prompt briefings include the monitor table', () => {
  const results = [
    {
      caseId: 'pl-001', family: 'named_compare', question: '比较营收', pass: true, skipped: false,
      reasons: [], tool_names: ['query_data'], stats: { decisions: 2, step_precision: 1 },
    },
    {
      caseId: 'pl-010', family: 'industry', question: '沪深300', pass: false, skipped: false,
      reasons: ['no_index_fetch：禁止工具 resolve_industry_universe'],
      tool_names: ['resolve_industry_universe'], stats: { decisions: 1, step_precision: 0 },
    },
  ]
  const summary = tallyPlanningSummary(results)
  const planning = renderPlanningBriefingMd(buildPlanningRecord({
    kind: 'official',
    at: '2026-09-14T12:00:00.000Z',
    durationMs: 103000,
    llm: { model: 'deepseek-flash' },
    report: { ...summary, results },
  }))
  hasMetricTable(planning)
  assert.ok(planning.includes('103s'))
  const prompt = renderPlanningBriefingMd(buildPlanningRecord({
    kind: 'official',
    layer: 'prompt',
    at: '2026-09-14T12:00:00.000Z',
    durationMs: 149000,
    llm: { model: 'deepseek-flash' },
    report: { ...summary, results },
  }))
  hasMetricTable(prompt)
  assert.ok(prompt.includes('生产提示词'))
})

test('component briefing includes the monitor table', () => {
  const record = buildEvalRecord({
    kind: 'official',
    at: '2026-09-14T04:20:44.545Z',
    durationMs: 158000,
    llm: { model: 'deepseek-flash' },
    report: {
      judged: 2,
      passed: 1,
      failed: 1,
      skipped: 0,
      pass_rate: 0.5,
      results: [
        {
          caseId: 'qc-001', family: 'tushare_query_canvas', pass: true, skipped: false,
          reasons: [], tool_names: ['query_data'], stats: { calls: 1 },
        },
        {
          caseId: 'qg-006', family: 'tushare_query_gate', pass: false, skipped: false,
          reasons: ['no_index_fetch：禁止工具 resolve_industry_universe'],
          tool_names: ['resolve_industry_universe'], stats: { calls: 1 },
        },
      ],
    },
  })
  const md = renderEvalBriefingMd(record)
  hasMetricTable(md)
  assert.ok(md.includes('158s'))
  assert.equal(record.summary.failure_rate, 0.5)
  assert.equal(record.summary.avg_decisions, 1)
})
