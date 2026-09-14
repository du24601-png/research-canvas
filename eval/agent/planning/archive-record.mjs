import { publicLlmMeta } from '../component/archive-record.mjs'
import { tallyPlanningSummary } from './run-suite.mjs'

export function buildPlanningRecord(input) {
  const report = input.report ?? {}
  const results = Array.isArray(report.results) ? report.results : []
  const summary = tallyPlanningSummary(results)
  return {
    schema: 'opptrix.eval.planning.v1',
    kind: input.kind === 'smoke' ? 'smoke' : 'official',
    track: 'agent',
    layer: input.layer ?? 'planning',
    focus: input.focus ?? 'decision_chain.research_canvas',
    dataset_id: input.datasetId ?? 'agent-planning-canvas-v1',
    at: input.at ?? new Date().toISOString(),
    duration_ms: input.durationMs ?? null,
    git: input.git ?? { commit: '', dirty: null },
    sources: { hashes: input.hashes ?? {} },
    llm: publicLlmMeta(input.llm),
    prompt: input.prompt ?? '',
    skip: input.skip ?? [],
    notes: input.notes ?? '',
    summary: {
      ...summary,
      judged: report.judged ?? summary.judged,
      skipped: report.skipped ?? summary.skipped,
      passed: report.passed ?? summary.passed,
      failed: report.failed ?? summary.failed,
      pass_rate: report.pass_rate ?? summary.pass_rate,
    },
    results,
  }
}
