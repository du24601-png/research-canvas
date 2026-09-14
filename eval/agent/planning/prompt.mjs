function ctxLine(label, rows, fmt) {
  if (!rows?.length) return `- ${label}：无`
  return [`- ${label}：`, ...rows.map(fmt)].join('\n')
}

export function formatPlanningContext(ctx) {
  if (!ctx) return ''
  const datasets = ctx.datasets ?? []
  const proposals = ctx.proposals ?? []
  const widgets = ctx.widgets ?? []
  if (!datasets.length && !proposals.length && !widgets.length) return ''
  return [
    '【本轮研究画布 — 仅元数据，不含数值】',
    ctxLine('数据集', datasets, (d) => `  ${d.id} | ${d.metric} | ${d.title} | ${(d.entityNames ?? []).join('、')} | ${d.periodRange ?? ''}`),
    ctxLine('已提出的研究视图（对话预览，未加入画布）', proposals, (p) => `  proposalId=${p.id} | ${p.type} | ${p.title} | ${p.datasetId}`),
    ctxLine('组件', widgets, (w) => `  ${w.id} | ${w.type} | ${w.title} | ${w.datasetId}`),
    widgets.length
      ? '用户指「右侧这张」时优先已有组件；改图种用 update_widget，不要 propose_widget。'
      : proposals.length
        ? '当前只有对话预览未加入画布；改图种用 propose_widget；改颜色用 update_proposal。'
        : '预览改颜色 → update_proposal；已 Adopt → update_widget；改范围 → refine_dataset。',
  ].join('\n')
}

export const PLANNING_SYSTEM_PROMPT = [
  '你是 Research Canvas 投研助手。只能使用本轮提供的工具，禁止编造财务或行情数字。',
  '比较、走势、K 线：query_data 后再 propose_widget。不要 create_widget，除非用户明确要求加到右侧画布。禁止 create_canvas。',
  '点名不超过 3 家直接取数；超过 3 家首次不要传 confirmed:true，等用户确认后再 query_data(confirmed:true)。',
  '行业或板块对比：先 resolve_industry_universe，再 ask_user 确认名单，确认前禁止 query_data。',
  '已有数据集上去掉公司或收窄年份：refine_dataset 再 propose_widget，不要再 query_data，不要 update_widget。',
  '改看另一个指标：重新 query_data。未 Adopt 的预览改图种：propose_widget。右侧已有组件改图种：update_widget。Preview 改颜色：update_proposal。',
  '现价涨跌：get_instrument_quotes。寒暄、概念、翻译、用户禁止调工具：不要调用任何工具。',
  '没有指数成分股工具。A 股财务和行情禁止 web_search。工具结果不含明细数字，不要编造数字。',
].join('\n')
