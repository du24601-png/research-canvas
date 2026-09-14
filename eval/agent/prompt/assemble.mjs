import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assembleSystemPrompt } from '../../../packages/agent/dist/system-prompt.js'
import { buildSkillCatalogPrompt } from '../../../packages/agent-skills/dist/prompt.js'
import {
  appendTurnTailMessages,
  buildResearchTierTurnTail,
  buildSessionClockPlaybook,
  buildTurnTailPrompt,
  defaultSessionPackIds,
} from '../../../packages/shared/dist/index.js'

const CATALOG_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../component/tool-catalog.json')

const EVAL_CLOCK = {
  iso: '2026-09-14T05:00:00.000Z',
  local: '2026/9/14 13:00:00',
  timezone: 'Asia/Shanghai',
  weekday: '星期一',
  unix_ms: Date.parse('2026-09-14T05:00:00.000Z'),
}

const DATA_SOURCING = [
  '【数据源优先级策略 — 必须严格遵守】',
  '0. 三级优先，不可倒置：外部 MCP（命名空间 server__tool）优先级与稳定性优于本地 MCP/本地工具；同一能力先远程，远程失败/熔断再本地。工具列表中远程工具已排在最前。',
  '1. 数据获取一律先调远程 MCP：同一能力若远程可用，禁止绕过远程直接调本地工具。search_instruments、get_instrument_snapshot、get_instrument_quotes 及财务/概况类本地工具仅当外部 MCP 未启用/失败（search_instruments 另含标的代码歧义）时才允许；search_instruments 禁止用于名称搜索/选股/问数。外部 MCP 按优先级轮询；精确工具优先于问数；不足再本地。榜单/全景/日历开盘/情绪市况/板块目录与筹码同此。评分/策略/回测/风格评级与关注列表/持仓仅本地。',
  '2. 充分性自检：若远程返回缺字段、缺记录或数据陈旧，系统会自动补充本地数据后合并返回，无需你手动重复调用。',
  '3. 结果已标注 _mcp.source 和 _mcp.sufficient，据此判断可信度。',
  '网页搜索不是投研数据源：仅一般公开资料；行情/公告/研报禁止首选；专用工具失败后才可兜底，且须标明内容可能不真实或过期。',
].join('\n')

function catalogToolNames() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'))
  return (catalog.tools ?? []).map((t) => t.name).filter(Boolean)
}

function formatCanvasBlock(ctx) {
  const datasets = ctx?.datasets ?? []
  const proposals = ctx?.proposals ?? []
  const widgets = ctx?.widgets
  if (!widgets && !datasets.length && !proposals.length) return ''
  const lines = ['【本轮研究画布 — 仅元数据，不含数值】']
  if (!datasets.length) lines.push('- 当前无数据集')
  else {
    lines.push('- 数据集：')
    for (const d of datasets) {
      const names = (d.entityNames ?? []).join('、') || '—'
      lines.push(`  ${d.id} | ${d.metric} | ${d.title} | ${names} | ${d.periodRange ?? ''}`)
    }
  }
  if (proposals.length) {
    lines.push('- 已提出的研究视图（对话预览，未加入画布）：')
    for (const p of proposals) {
      lines.push(`  proposalId=${p.id} | ${p.type} | ${p.title} | ${p.datasetId}`)
    }
    lines.push('  预览改颜色/图例/轴标题 → update_proposal；已 Adopt → update_widget')
  }
  if (!widgets?.length) {
    lines.push('- 当前无组件')
    return lines.join('\n')
  }
  lines.push('- 组件：')
  for (const w of widgets) {
    lines.push(`  ${w.id} | ${w.type} | ${w.title} | ${w.datasetId}`)
  }
  return lines.join('\n')
}

function routePlaybook() {
  const names = catalogToolNames()
  return ['【本轮工具选型卡 — 必须优先遵守】', ...names.map((n) => `- ${n}`), '仅调用上列工具名；勿虚构未出现的工具。'].join('\n')
}

export function assembleProductSystemPrompt() {
  return assembleSystemPrompt({
    sessionRolePersona: null,
    dataSourcingPolicy: DATA_SOURCING,
    agentSkillCatalog: buildSkillCatalogPrompt(),
    activePacks: defaultSessionPackIds(),
  })
}

export function buildProductTurnTail(evalCase) {
  const base = buildTurnTailPrompt({
    sessionClock: buildSessionClockPlaybook(EVAL_CLOCK),
    routePlaybook: routePlaybook(),
  })
  const extras = [
    buildResearchTierTurnTail('L2', { artifactsAvailable: false }),
    formatCanvasBlock(evalCase?.context),
  ].filter(Boolean)
  return [base, ...extras].join('\n\n')
}

export function buildProductPlanningMessages(evalCase) {
  const task = String(evalCase?.task ?? evalCase?.question ?? '')
  const messages = [
    { role: 'system', content: assembleProductSystemPrompt() },
    { role: 'user', content: task },
  ]
  return appendTurnTailMessages(messages, buildProductTurnTail(evalCase))
}
