import { renderMonitorMetricsMd } from '../monitor-metrics.mjs'

function pct(passed, judged) {
  if (!judged) return '—'
  return `${((passed / judged) * 100).toFixed(1)}%`
}

function familyRows(byFamily) {
  return Object.entries(byFamily).map(([name, t]) => (
    `| ${name} | ${t.judged} | ${t.passed} | ${t.failed} | ${t.skipped} |`
  ))
}

function failRows(results) {
  return results
    .filter((r) => !r.skipped && r.pass === false)
    .map((r) => {
      const tools = (r.tool_names ?? []).join(', ') || '（无）'
      const why = (r.reasons ?? []).join('；')
      return `| ${r.caseId} | ${r.question ?? ''} | ${tools} | ${why} |`
    })
}

function skipRows(results) {
  return results
    .filter((r) => r.skipped)
    .map((r) => `| ${r.caseId} | ${r.question ?? ''} | ${(r.reasons ?? []).join('；')} |`)
}

export function renderEvalBriefingMd(record) {
  const s = record.summary
  const git = record.git?.commit || '（未知）'
  const dirty = record.git?.dirty ? '（工作区有未提交改动）' : ''
  const fail = failRows(record.results ?? [])
  const skips = skipRows(record.results ?? [])
  return [
    `# Agent 组件评测记录`,
    '',
    `- **性质：** ${record.kind === 'official' ? '正式' : '冒烟'}`,
    `- **时间：** ${record.at}`,
    `- **模型：** ${record.llm?.model || '（未知）'}`,
    `- **Git：** \`${git}\`${dirty}`,
    `- **数据集：** ${record.dataset_id}`,
    `- **成绩：** **${s.passed} / ${s.judged} 通过（${pct(s.passed, s.judged)}）**，跳过 ${s.skipped}，失败 ${s.failed}`,
    `- **范围：** 只评第一轮工具调用；不执行工具、不打 Tushare`,
    record.notes ? `- **备注：** ${record.notes}` : null,
    '',
    ...renderMonitorMetricsMd(record),
    '## 分题组',
    '',
    '| 题组 | 判分 | 通过 | 失败 | 跳过 |',
    '|---|---|---|---|---|',
    ...familyRows(s.by_family ?? {}),
    '',
    '## 失败',
    '',
    fail.length ? '| 编号 | 问句 | 实际工具 | 原因 |' : '无。',
    fail.length ? '|---|---|---|---|' : null,
    ...fail,
    '',
    '## 跳过',
    '',
    skips.length ? '| 编号 | 问句 | 原因 |' : '无。',
    skips.length ? '|---|---|---|' : null,
    ...skips,
    '',
    '## 复现',
    '',
    '```bash',
    'npm run eval:agent:component',
    '```',
    '',
    `判分器：\`eval/agent/component/judge.mjs\`。完整 JSON 与本简报同目录。`,
    '',
  ].filter((line) => line != null).join('\n')
}
