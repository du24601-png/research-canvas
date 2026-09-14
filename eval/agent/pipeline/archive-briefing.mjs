import { formatConstraintHits, formatDurationMs } from '../monitor-metrics.mjs'

const PLANNING_SCENARIOS = [
  ['named_compare', '具名对比'],
  ['many_preview', '多家确认'],
  ['industry', '行业/指数闸门'],
  ['refine_view', '改预览'],
  ['adopt_boundary', 'Adopt 边界'],
  ['quotes_and_stop', '现价即停'],
]

const COMPONENT_SCENARIOS = [
  ['tushare_query_canvas', '画布问数'],
  ['tushare_query_quotes', '现价'],
  ['tushare_query_profile', '概况'],
  ['tushare_query_gate', '成分股/闸门'],
  ['no_tool', '不该调工具'],
]

function pct(passed, judged) {
  if (!judged) return '—'
  return `${((passed / judged) * 100).toFixed(1)}%`
}

function n(value, digits = 2) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return value.toFixed(digits)
}

function deltaPp(d) {
  if (typeof d !== 'number' || Number.isNaN(d)) return '—'
  const sign = d > 0 ? '+' : ''
  return `${sign}${(d * 100).toFixed(1)}pp`
}

function deltaN(d, digits = 2) {
  if (typeof d !== 'number' || Number.isNaN(d)) return '—'
  const sign = d > 0 ? '+' : ''
  return `${sign}${d.toFixed(digits)}`
}

function stepPct(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(1)}%`
}

function scoreCell(s) {
  if (!s) return '—'
  return `${s.passed} / ${s.judged}（${pct(s.passed, s.judged)}）`
}

function familyCell(byFamily, id) {
  const t = byFamily?.[id]
  if (!t) return '—'
  return `${t.passed}/${t.judged}`
}

function layerMonitorBlock(name, layer, cmp) {
  const s = layer?.summary ?? {}
  const prev = cmp?.previous
  const d = cmp?.deltas
  return [
    `### ${name}`,
    '',
    '| 指标 | 本轮 | 上次 | Δ |',
    '|---|---|---|---|',
    `| 有效占比 | ${scoreCell(s)} | ${scoreCell(prev)} | ${deltaPp(d?.pass_rate)} |`,
    `| 失败频率 | ${pct(s.failed, s.judged)}（${s.failed ?? 0} 题） | ${prev ? `${pct(prev.failed, prev.judged)}（${prev.failed} 题）` : '—'} | ${deltaPp(d?.failure_rate)} |`,
    `| 平均决策次数（全量） | ${n(s.avg_decisions)} | ${prev ? n(prev.avg_decisions) : '—'} | ${deltaN(d?.avg_decisions)} |`,
    `| 平均决策次数（通过题） | ${n(s.avg_decisions_passed)} | ${prev ? n(prev.avg_decisions_passed) : '—'} | ${deltaN(d?.avg_decisions_passed)} |`,
    `| 步骤有效率 | ${stepPct(s.avg_step_precision)} | ${prev ? stepPct(prev.avg_step_precision) : '—'} | ${deltaPp(d?.avg_step_precision)} |`,
    `| 约束击穿 | ${formatConstraintHits(s.constraint_hits)} | ${prev ? formatConstraintHits(prev.constraint_hits) : '—'} | ${cmp?.hasBaseline ? '见左' : '—'} |`,
    `| 耗时 | ${formatDurationMs(layer?.duration_ms)} | ${prev ? formatDurationMs(prev.duration_ms) : '—'} | ${d ? formatDurationMs(Math.abs(d.duration_ms)) : '—'} |`,
    '',
  ]
}

function scenarioRows(planning, prompt) {
  const pf = planning?.summary?.by_family ?? {}
  const qf = prompt?.summary?.by_family ?? {}
  return PLANNING_SCENARIOS.map(([id, label]) => (
    `| ${label} | ${familyCell(pf, id)} | ${familyCell(qf, id)} |`
  ))
}

function componentScenarioRows(component) {
  const cf = component?.summary?.by_family ?? {}
  return COMPONENT_SCENARIOS.map(([id, label]) => (
    `| ${label} | ${familyCell(cf, id)} |`
  ))
}

function changeRows(compare, kind) {
  const key = kind === 'failed' ? 'newlyFailed' : 'newlyPassed'
  const rows = []
  for (const layer of ['component', 'planning', 'prompt']) {
    for (const item of compare?.[layer]?.[key] ?? []) {
      const why = (item.reasons ?? []).join('；')
      rows.push(`| ${layer} | ${item.caseId} | ${item.question || ''} | ${why} |`)
    }
  }
  return rows
}

function changeSection(compare) {
  const newFail = changeRows(compare, 'failed')
  const newPass = changeRows(compare, 'passed')
  return [
    '## 新失败 / 新通过',
    '',
    newFail.length ? '新失败：' : '新失败：无。',
    newFail.length ? '| 层 | 编号 | 任务 | 原因 |' : null,
    newFail.length ? '|---|---|---|---|' : null,
    ...newFail,
    '',
    newPass.length ? '新通过：' : '新通过：无。',
    newPass.length ? '| 层 | 编号 | 任务 | 原因 |' : null,
    newPass.length ? '|---|---|---|---|' : null,
    ...newPass,
    '',
  ]
}

function overviewLines(record, layers) {
  const git = record.git?.commit || '（未知）'
  const dirty = record.git?.dirty ? '（工作区有未提交改动）' : ''
  const c = layers.component?.summary ?? {}
  const p = layers.planning?.summary ?? {}
  const q = layers.prompt?.summary ?? {}
  return [
    '# Agent 整体测评记录',
    '',
    `- **性质：** ${record.kind === 'official' ? '正式' : '冒烟'}`,
    `- **时间：** ${record.at}`,
    `- **模型：** ${record.llm?.model || '（未知）'}`,
    `- **Git：** \`${git}\`${dirty}`,
    `- **总耗时：** ${formatDurationMs(record.duration_ms)}`,
    `- **component：** ${scoreCell(c)}`,
    `- **planning：** ${scoreCell(p)}`,
    `- **prompt（北星）：** ${scoreCell(q)}`,
    record.notes ? `- **备注：** ${record.notes}` : null,
    '',
  ]
}

export function renderPipelineBriefingMd(record) {
  const layers = record.layers ?? {}
  const compare = record.compare ?? {}
  return [
    ...overviewLines(record, layers),
    '## 监控指标',
    '',
    ...layerMonitorBlock('component', layers.component, compare.component),
    ...layerMonitorBlock('planning', layers.planning, compare.planning),
    ...layerMonitorBlock('prompt', layers.prompt, compare.prompt),
    '## 业务场景',
    '',
    '规划层与生产提示词共用同一套画布题；并排看主路径。',
    '',
    '| 场景 | 规划 | 生产提示词 |',
    '|---|---|---|',
    ...scenarioRows(layers.planning, layers.prompt),
    '',
    '第一轮工具（component，与上表不是同一题集）：',
    '',
    '| 场景 | 组件 |',
    '|---|---|',
    ...componentScenarioRows(layers.component),
    '',
    '## 诊断',
    '',
    ...(record.diagnosis ?? []).map((line) => `- ${line}`),
    '',
    ...changeSection(compare),
    '## 复现',
    '',
    '```bash',
    'npm run eval:agent',
    '```',
    '',
    '明细仍在各层 official JSON。本综合档不合成加权总分，不进入 test:gate。',
    '',
  ].filter((line) => line != null).join('\n')
}

