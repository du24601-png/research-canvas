function judgedRows(results, pass) {
  return (results ?? []).filter((r) => !r.skipped && r.pass === pass)
}

function slimCase(row) {
  return {
    caseId: row.caseId,
    question: row.question ?? row.task ?? '',
    reasons: row.reasons ?? [],
  }
}

function num(value) {
  return typeof value === 'number' && !Number.isNaN(value) ? value : 0
}

export function compareLayer(current, baseline) {
  if (!baseline) {
    return { hasBaseline: false, deltas: null, newlyFailed: [], newlyPassed: [], baseline_at: null }
  }
  const s = current?.summary ?? {}
  const b = baseline.summary ?? {}
  const prevFail = new Set(judgedRows(baseline.results, false).map((r) => r.caseId))
  const prevPass = new Set(judgedRows(baseline.results, true).map((r) => r.caseId))
  const nowFail = judgedRows(current?.results, false)
  const nowPass = judgedRows(current?.results, true)
  return {
    hasBaseline: true,
    baseline_at: baseline.at ?? null,
    previous: {
      judged: b.judged ?? 0,
      passed: b.passed ?? 0,
      failed: b.failed ?? 0,
      pass_rate: num(b.pass_rate),
      failure_rate: num(b.failure_rate),
      avg_decisions: num(b.avg_decisions),
      avg_decisions_passed: num(b.avg_decisions_passed),
      avg_step_precision: num(b.avg_step_precision),
      constraint_hits: b.constraint_hits ?? {},
      duration_ms: num(baseline.duration_ms),
    },
    deltas: {
      pass_rate: num(s.pass_rate) - num(b.pass_rate),
      failure_rate: num(s.failure_rate) - num(b.failure_rate),
      avg_decisions: num(s.avg_decisions) - num(b.avg_decisions),
      avg_decisions_passed: num(s.avg_decisions_passed) - num(b.avg_decisions_passed),
      avg_step_precision: num(s.avg_step_precision) - num(b.avg_step_precision),
      duration_ms: num(current?.duration_ms) - num(baseline.duration_ms),
    },
    newlyFailed: nowFail.filter((r) => prevPass.has(r.caseId)).map(slimCase),
    newlyPassed: nowPass.filter((r) => prevFail.has(r.caseId)).map(slimCase),
  }
}

function dropped(cmp) {
  if (!cmp?.hasBaseline) return false
  return (cmp.deltas?.pass_rate ?? 0) < 0
}

function steady(cmp) {
  if (!cmp?.hasBaseline) return false
  return (cmp.deltas?.pass_rate ?? 0) >= 0
}

export function diagnosePipeline(compare = {}) {
  const planningDrop = dropped(compare.planning)
  const promptDrop = dropped(compare.prompt)
  const componentDrop = dropped(compare.component)
  const planningSteady = steady(compare.planning)
  const promptSteady = steady(compare.prompt)
  const lines = []
  if (!compare.planning?.hasBaseline && !compare.prompt?.hasBaseline) {
    lines.push('无对照：尚无上一份正式规划/提示词记录，本轮只建档。')
  }
  if (planningSteady && promptDrop) {
    lines.push('planning 稳、prompt 掉 → 生产提示词回归（优先改 packages/shared/src/agent-prompt-guide.ts）')
  } else if (planningDrop && promptSteady) {
    lines.push('planning 掉、prompt 稳 → 评测量具 / 短提示词坏了，产品未必坏')
  } else if (planningDrop && promptDrop) {
    lines.push('两层一起掉 → 夹具、gold 或模型行为变了')
  }
  if (componentDrop && planningSteady && promptSteady) {
    lines.push('只有 component 掉 → 第一轮工具幻觉；多轮夹具可能把错掩盖掉')
  } else if (componentDrop) {
    lines.push('component 有效占比下降 → 第一轮工具选错，作为领先指标单独看。')
  }
  lines.push('产品北星是 prompt 层（真实 system prompt）。component 是领先指标。planning 是量具健康度。')
  lines.push('三层测的不是同一件事，禁止合成加权总分，也不进入 test:gate。')
  return lines
}

export function compareAllLayers(current, baselines) {
  return {
    component: compareLayer(current.component, baselines.component),
    planning: compareLayer(current.planning, baselines.planning),
    prompt: compareLayer(current.prompt, baselines.prompt),
  }
}
