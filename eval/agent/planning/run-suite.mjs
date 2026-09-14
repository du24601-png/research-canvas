import { judgePlanningCase } from './judge.mjs'
import { loadPlanningCases, SKIP_CASE_IDS } from './load-cases.mjs'
import { runPlanningCase } from './loop.mjs'
import { catalogToOpenAiTools } from '../component/tools-openai.mjs'
import { tallyConstraintHits } from '../monitor-metrics.mjs'
import { tallyByFamily } from '../component/archive-record.mjs'

function mean(xs) {
  if (!xs.length) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function tallyPlanningSummary(results) {
  const judgedRows = results.filter((r) => !r.skipped)
  const passedRows = judgedRows.filter((r) => r.pass)
  const judged = judgedRows.length
  const passed = passedRows.length
  const decisions = judgedRows.map((r) => r.stats?.decisions ?? 0)
  const precision = judgedRows.map((r) => r.stats?.step_precision ?? 0)
  return {
    judged,
    skipped: results.length - judged,
    passed,
    failed: judged - passed,
    pass_rate: judged ? passed / judged : 0,
    failure_rate: judged ? (judged - passed) / judged : 0,
    effective_ratio: judged ? passed / judged : 0,
    avg_decisions: mean(decisions),
    avg_decisions_passed: mean(passedRows.map((r) => r.stats?.decisions ?? 0)),
    avg_step_precision: mean(precision),
    by_family: tallyByFamily(results),
    constraint_hits: tallyConstraintHits(results),
  }
}

export async function runPlanningSuite(opts) {
  const skip = new Set(opts.skipIds ?? SKIP_CASE_IDS)
  const all = await loadPlanningCases({ skipIds: [] })
  const scoped = opts.caseIds ? all.filter((c) => opts.caseIds.includes(c.id)) : all
  const tools = opts.tools ?? await catalogToOpenAiTools()
  const results = []
  for (const evalCase of scoped) {
    if (skip.has(evalCase.id)) {
      results.push({
        caseId: evalCase.id,
        skipped: true,
        pass: null,
        reasons: ['skipped'],
        tool_names: [],
        calls: [],
        stats: { decisions: 0, gold_steps: 0, matched_steps: 0, step_precision: 0 },
        question: evalCase.task,
        family: evalCase.family,
        split: evalCase.split,
      })
      continue
    }
    let trace = { calls: [], events: {} }
    let error = null
    try {
      trace = await runPlanningCase({
        evalCase,
        complete: opts.complete,
        tools,
        buildMessages: opts.buildMessages,
      })
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }
    const judged = judgePlanningCase(evalCase, trace)
    if (error) {
      judged.pass = false
      judged.reasons = [`runner: ${error}`, ...judged.reasons]
    }
    results.push({
      ...judged,
      skipped: false,
      tool_names: (trace.calls ?? []).map((c) => c.name).filter(Boolean),
      calls: trace.calls ?? [],
      events: trace.events ?? {},
      error,
      question: evalCase.task,
      family: evalCase.family,
      split: evalCase.split,
    })
  }
  return { ...tallyPlanningSummary(results), results }
}
