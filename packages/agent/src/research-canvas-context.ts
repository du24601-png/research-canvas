import {
  getTurnCanvasActiveProposal,
  getTurnCanvasActiveWidget,
  getTurnCanvasDatasets,
  getTurnCanvasProposals,
  getTurnCanvasRecords,
  getTurnCanvasWidgets,
} from './research-canvas-turn-state.js'

function formatSeriesKeys(sessionId: string, datasetId: string): string {
  const record = getTurnCanvasRecords(sessionId)?.find(item => item.id === datasetId)
  if (!record?.entities.length) return ''
  return record.entities
    .map(entity => `${entity.name}=${entity.id}`)
    .join(' | ')
}

export function formatResearchCanvasTurnContext(sessionId: string): string {
  const widgets = getTurnCanvasWidgets(sessionId)
  const datasets = getTurnCanvasDatasets(sessionId)
  if (!widgets) return ''
  const lines = ['【本轮研究画布 — 仅元数据，不含数值】']
  if (!datasets?.length) {
    lines.push('- 当前无数据集')
  } else {
    lines.push('- 数据集：')
    for (const dataset of datasets) {
      const names = dataset.entityNames.join('、') || '—'
      const parent = dataset.parentDatasetId ? ` | parent=${dataset.parentDatasetId}` : ''
      const keys = formatSeriesKeys(sessionId, dataset.id)
      lines.push(`  ${dataset.id} | ${dataset.metric} | ${dataset.title} | ${names} | ${dataset.periodRange}${parent}`)
      if (keys) lines.push(`  系列键：${keys}`)
    }
    lines.push('  改色：style.series 键可用公司名、代码或系列键；颜色可用蓝/橙/绿或 #hex')
  }
  const activeWidget = getTurnCanvasActiveWidget(sessionId)
  if (activeWidget) {
    const ticker = activeWidget.subject?.ticker ?? ''
    const company = activeWidget.subject?.companyName ?? ''
    const from = activeWidget.period?.from ?? ''
    const to = activeWidget.period?.to ?? ''
    const period = from && to && from !== to ? `${from}–${to}` : (from || to)
    const metrics = activeWidget.metrics?.join('、') ?? ''
    lines.push('- 用户当前选中的组件（「这个」「这里」「这张图」「最近两年」等指代优先据此理解）：')
    lines.push(`  ${activeWidget.widgetId} | ${activeWidget.type} | ${activeWidget.title}`)
    if (activeWidget.datasetId) lines.push(`  datasetId=${activeWidget.datasetId}`)
    if (company || ticker) lines.push(`  标的：${[company, ticker].filter(Boolean).join(' / ')}`)
    if (period) lines.push(`  时间范围：${period}`)
    if (metrics) lines.push(`  指标：${metrics}`)
    lines.push('  不要假设该组件中不存在的数据；需要更多数据时用 query_data / refine_dataset，禁止编造数字；回答用自然语言，不必每次重复组件标题')
  }
  const active = getTurnCanvasActiveProposal(sessionId)
  if (active) {
    lines.push(`- 用户正在调整研究视图：${active.title} | ${active.type} | ${active.datasetId}`)
    lines.push(`  proposalId=${active.proposalId}`)
  }
  const proposals = getTurnCanvasProposals(sessionId) ?? []
  if (proposals.length) {
    lines.push('- 已提出的研究视图（对话预览，未加入画布）：')
    for (const proposal of proposals) {
      const styled = proposal.style ? ' | 已设样式' : ''
      lines.push(`  proposalId=${proposal.id} | ${proposal.type} | ${proposal.title} | ${proposal.datasetId}${styled}`)
    }
    lines.push('  预览改颜色/图例/轴标题 → update_proposal；已 Adopt → update_widget')
  }
  if (!widgets.length) {
    lines.push('- 当前无组件')
    return lines.join('\n')
  }
  lines.push('- 组件：')
  for (const widget of widgets) {
    const styled = widget.style ? ' | 已设样式' : ''
    lines.push(`  ${widget.id} | ${widget.type} | ${widget.title} | ${widget.datasetId}${styled}`)
  }
  return lines.join('\n')
}
