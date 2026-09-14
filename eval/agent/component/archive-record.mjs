import { tallyMonitorFromResults } from '../monitor-metrics.mjs'

export function hydrateLegacyResults(legacyResults, cases) {
  const byId = new Map(cases.map((c) => [c.id, c]))
  return (legacyResults ?? []).map((row) => {
    const item = byId.get(row.caseId)
    const gold = item?.gold
    return {
      ...row,
      question: row.question || item?.question || '',
      family: row.family || item?.family,
      split: row.split || item?.split,
      gold: row.gold || (gold
        ? {
            call_policy: gold.call_policy,
            tushare_via: gold.tushare_via,
            expected: gold.expected ?? [],
            forbidden: gold.forbidden ?? [],
            max_calls: gold.max_calls,
          }
        : null),
      calls: Array.isArray(row.calls) ? row.calls : [],
    }
  })
}

export function publicLlmMeta(llm = {}) {
  return {
    model: llm.model ?? '',
    temperature: llm.temperature ?? 0,
    max_tokens: llm.max_tokens ?? 1024,
    tool_choice: llm.tool_choice ?? 'auto',
  }
}

export function tallyByFamily(results) {
  const map = {}
  for (const row of results) {
    const family = row.family || 'unknown'
    if (!map[family]) map[family] = { judged: 0, passed: 0, failed: 0, skipped: 0 }
    if (row.skipped) {
      map[family].skipped += 1
      continue
    }
    map[family].judged += 1
    if (row.pass) map[family].passed += 1
    else map[family].failed += 1
  }
  return map
}

export function buildEvalRecord(input) {
  const report = input.report ?? {}
  const results = Array.isArray(report.results) ? report.results : []
  const monitor = tallyMonitorFromResults(results)
  return {
    schema: 'opptrix.eval.component.v1',
    kind: input.kind === 'smoke' ? 'smoke' : 'official',
    track: 'agent',
    layer: 'component',
    focus: 'tool_calling.tushare_query',
    dataset_id: input.datasetId ?? 'agent-component-tushare-v1',
    at: input.at ?? new Date().toISOString(),
    duration_ms: input.durationMs ?? null,
    git: input.git ?? { commit: '', dirty: null },
    sources: { hashes: input.hashes ?? {} },
    llm: publicLlmMeta(input.llm),
    prompt: input.prompt ?? '',
    skip: input.skip ?? [],
    notes: input.notes ?? '',
    summary: {
      ...monitor,
      judged: report.judged ?? monitor.judged,
      skipped: report.skipped ?? monitor.skipped,
      passed: report.passed ?? monitor.passed,
      failed: report.failed ?? monitor.failed,
      pass_rate: report.pass_rate ?? monitor.pass_rate,
      by_family: tallyByFamily(results),
    },
    results,
  }
}
