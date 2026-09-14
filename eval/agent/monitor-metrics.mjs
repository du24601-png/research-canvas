function pct(passed, judged) {
  if (!judged) return '—'
  return `${((passed / judged) * 100).toFixed(1)}%`
}

function n(value, digits = 2) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return value.toFixed(digits)
}

function mean(xs) {
  if (!xs.length) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function formatDurationMs(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${Math.round(ms / 1000)}s`
}

export function tallyConstraintHits(results) {
  const map = {}
  for (const row of results ?? []) {
    if (row.skipped || row.pass) continue
    for (const reason of row.reasons ?? []) {
      const id = String(reason).split('：')[0]
      if (!/^[a-z][a-z0-9_]*$/.test(id)) continue
      map[id] = (map[id] ?? 0) + 1
    }
  }
  return map
}

export function formatConstraintHits(hits) {
  const entries = Object.entries(hits ?? {})
  if (!entries.length) return '无'
  return entries.map(([id, c]) => `${id}×${c}`).join('、')
}

function decisionCount(row) {
  if (typeof row?.stats?.decisions === 'number') return row.stats.decisions
  if (typeof row?.stats?.calls === 'number') return row.stats.calls
  return (row?.tool_names ?? []).length
}

function stepPrecision(row) {
  if (typeof row?.stats?.step_precision === 'number') return row.stats.step_precision
  if (row?.skipped) return 0
  return row?.pass ? 1 : 0
}

export function tallyMonitorFromResults(results) {
  const rows = Array.isArray(results) ? results : []
  const judgedRows = rows.filter((r) => !r.skipped)
  const passedRows = judgedRows.filter((r) => r.pass)
  const judged = judgedRows.length
  const passed = passedRows.length
  const failed = judged - passed
  return {
    judged,
    skipped: rows.length - judged,
    passed,
    failed,
    pass_rate: judged ? passed / judged : 0,
    failure_rate: judged ? failed / judged : 0,
    effective_ratio: judged ? passed / judged : 0,
    avg_decisions: mean(judgedRows.map(decisionCount)),
    avg_decisions_passed: mean(passedRows.map(decisionCount)),
    avg_step_precision: mean(judgedRows.map(stepPrecision)),
    constraint_hits: tallyConstraintHits(rows),
  }
}

export function formatMonitorLogLines(prefix, report, durationMs) {
  const failPct = ((report.failure_rate ?? 0) * 100).toFixed(1)
  const stepPct = ((report.avg_step_precision ?? 0) * 100).toFixed(1)
  const avg = (report.avg_decisions ?? 0).toFixed(2)
  const avgP = (report.avg_decisions_passed ?? 0).toFixed(2)
  return [
    `[${prefix}] ${report.passed}/${report.judged} effective, failure_rate=${failPct}% (${report.failed} fail)`,
    `[${prefix}] avg_decisions=${avg} passed=${avgP} step_precision=${stepPct}%`,
    `[${prefix}] constraint_hits=${formatConstraintHits(report.constraint_hits)} duration=${formatDurationMs(durationMs)}`,
  ]
}

export function renderMonitorMetricsMd(record) {
  const s = record?.summary ?? {}
  const judged = s.judged ?? 0
  const passed = s.passed ?? 0
  const failed = s.failed ?? 0
  const step = s.avg_step_precision
  const stepPct = typeof step === 'number' && !Number.isNaN(step) ? `${(step * 100).toFixed(1)}%` : '—'
  return [
    '## 监控指标',
    '',
    '| 指标 | 本轮 |',
    '|---|---|',
    `| 有效占比 | ${passed} / ${judged}（${pct(passed, judged)}） |`,
    `| 失败频率 | ${pct(failed, judged)}（${failed} 题） |`,
    `| 平均决策次数（全量） | ${n(s.avg_decisions)} |`,
    `| 平均决策次数（通过题） | ${n(s.avg_decisions_passed)} |`,
    `| 步骤有效率 | ${stepPct} |`,
    `| 约束击穿 | ${formatConstraintHits(s.constraint_hits)} |`,
    `| 耗时 | ${formatDurationMs(record?.duration_ms)} |`,
    '',
  ]
}
