import { renderMonitorMetricsMd } from '../monitor-metrics.mjs'

function pct(passed, judged) {
  if (!judged) return '—'
  return `${((passed / judged) * 100).toFixed(1)}%`
}

function n(value, digits = 2) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return value.toFixed(digits)
}

function familyRows(byFamily) {
  return Object.entries(byFamily ?? {}).map(([name, t]) => (
    `| ${name} | ${t.judged} | ${t.passed} | ${t.failed} | ${t.skipped} |`
  ))
}

function failRows(results) {
  return (results ?? [])
    .filter((r) => !r.skipped && r.pass === false)
    .map((r) => {
      const tools = (r.tool_names ?? []).join(', ') || '（无）'
      const why = (r.reasons ?? []).join('；')
      return `| ${r.caseId} | ${r.question ?? ''} | ${tools} | ${why} |`
    })
}

function hitRows(hits) {
  const entries = Object.entries(hits ?? {})
  if (!entries.length) return ['无。']
  return [
    '| 约束 | 击中次数 |',
    '|---|---|',
    ...entries.map(([id, c]) => `| ${id} | ${c} |`),
  ]
}

export function renderPlanningBriefingMd(record) {
  const s = record.summary
  const git = record.git?.commit || '（未知）'
  const dirty = record.git?.dirty ? '（工作区有未提交改动）' : ''
  const fail = failRows(record.results)
  const promptLayer = record.layer === 'prompt'
  const title = promptLayer ? 'Agent 生产提示词评测记录' : 'Agent 规划评测记录'
  const reproduce = promptLayer ? 'npm run eval:agent:prompt' : 'npm run eval:agent:planning'
  const scope = promptLayer
    ? '使用生产 assembleSystemPrompt + 本轮尾注；夹具多轮，不打 Tushare'
    : '夹具多轮决策链；执行工具但不打 Tushare'
  return [
    `# ${title}`,
    '',
    `- **性质：** ${record.kind === 'official' ? '正式' : '冒烟'}`,
    `- **时间：** ${record.at}`,
    `- **模型：** ${record.llm?.model || '（未知）'}`,
    `- **Git：** \`${git}\`${dirty}`,
    `- **数据集：** ${record.dataset_id}`,
    `- **有效占比：** **${s.passed} / ${s.judged}（${pct(s.passed, s.judged)}）**`,
    `- **失败频率：** ${pct(s.failed, s.judged)}（${s.failed} 题）`,
    `- **平均决策次数：** 全量 ${n(s.avg_decisions)}；通过题 ${n(s.avg_decisions_passed)}`,
    `- **步骤有效率：** ${((s.avg_step_precision ?? 0) * 100).toFixed(1)}%`,
    `- **范围：** ${scope}`,
    record.notes ? `- **备注：** ${record.notes}` : null,
    '',
    ...renderMonitorMetricsMd(record),
    '## 分题组',
    '',
    '| 题组 | 判分 | 通过 | 失败 | 跳过 |',
    '|---|---|---|---|---|',
    ...familyRows(s.by_family),
    '',
    '## 约束击穿',
    '',
    ...hitRows(s.constraint_hits),
    '',
    '## 失败',
    '',
    fail.length ? '| 编号 | 任务 | 实际工具 | 原因 |' : '无。',
    fail.length ? '|---|---|---|---|' : null,
    ...fail,
    '',
    '## 复现',
    '',
    '```bash',
    reproduce,
    '```',
    '',
    '判分器：`eval/agent/planning/judge.mjs`。完整 JSON 与本简报同目录。',
    '',
  ].filter((line) => line != null).join('\n')
}
