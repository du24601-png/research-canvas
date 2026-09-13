import {
  mergeChartStyle,
  RESEARCH_CANVAS_TITLE_MAX,
  RESEARCH_CANVAS_WIDGET_LIMIT,
  RESEARCH_CANVAS_WIDGET_TYPES,
  isAllowedResearchCanvasDatasetId,
  isLegacyMockResearchDatasetId,
  isResearchCanvasWidgetType,
  parseResearchCanvasEvent,
  sanitizeChartStyle,
  sanitizeResearchCanvasTitle,
  type ResearchCanvasEvent,
  type ResearchCanvasWidgetSnapshot,
  type ResearchCanvasWidgetType,
} from '@opptrix/shared'
import { randomUUID } from 'node:crypto'
import { TOOL_META } from './tool-meta.js'
import {
  applyTurnCanvasEvent,
  knownTurnDatasetIds,
  replaceTurnCanvasWidgets,
  requireTurnCanvasState,
} from './research-canvas-turn-state.js'
import { executeQueryData, type ResearchDataHub } from './research-query-data.js'
import { executeProposeWidget } from './research-propose-widget.js'
import { executeRefineDataset } from './research-refine-dataset.js'
import { executeUpdateProposal } from './research-update-proposal.js'
import { executeResolveIndustryUniverse } from './research-industry-universe.js'
import { bindChartStyle } from './research-style-bind.js'

type JsonSchemaProperty = {
  type: string
  description?: string
  enum?: string[]
  items?: JsonSchemaProperty
  properties?: Record<string, JsonSchemaProperty>
  required?: string[]
  additionalProperties?: boolean | JsonSchemaProperty
}

type JsonSchema = {
  type: 'object'
  properties: Record<string, JsonSchemaProperty>
  required?: string[]
  additionalProperties: false
}

export interface ResearchCanvasToolDef {
  name: string
  description: string
  category: string
  parameters: JsonSchema
  handler: (args: Record<string, unknown>) => Promise<unknown>
  meta?: (typeof TOOL_META)[string]
}

const TYPE_ENUM = [...RESEARCH_CANVAS_WIDGET_TYPES]
const LAYOUT_KEYS = new Set(['x', 'y', 'w', 'h', 'i', 'minW', 'minH', 'layout'])

const S = (
  properties: JsonSchema['properties'],
  required: string[],
): JsonSchema => ({ type: 'object', properties, required, additionalProperties: false })

const CHART_STYLE_PROPERTY: JsonSchemaProperty = {
  type: 'object',
  description: '图表样式：legend / xAxis / yAxis / series / marks；series 键可用公司名、代码或 entityId',
  properties: {
    legend: {
      type: 'object',
      properties: {
        show: { type: 'boolean' },
        position: { type: 'string', enum: ['top', 'right', 'bottom', 'none'] },
      },
      additionalProperties: false,
    },
    xAxis: {
      type: 'object',
      properties: { title: { type: 'string' } },
      additionalProperties: false,
    },
    yAxis: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        zero: { type: 'boolean' },
      },
      additionalProperties: false,
    },
    series: {
      type: 'object',
      description: '按公司名、代码或 entityId 设置 label / color / visible；color 可用蓝/橙或 #hex',
      additionalProperties: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          color: { type: 'string', description: '蓝/橙/绿等色名或 #hex / rgb()' },
          visible: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
    marks: {
      type: 'object',
      properties: { showValues: { type: 'boolean' } },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function rejectUnknownKeys(
  args: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): string | null {
  for (const key of Object.keys(args)) {
    if (LAYOUT_KEYS.has(key)) return '禁止传入布局坐标或尺寸'
    if (!allowed.has(key)) return `不支持参数 ${key}`
  }
  return null
}

function parseType(raw: unknown): ResearchCanvasWidgetType | { error: string } {
  if (!isResearchCanvasWidgetType(raw)) {
    return { error: `type 须为 ${TYPE_ENUM.join(' / ')}` }
  }
  return raw
}

function parseTitle(raw: unknown): string | { error: string } {
  const title = sanitizeResearchCanvasTitle(raw)
  if (!title) return { error: `title 必填且不超过 ${RESEARCH_CANVAS_TITLE_MAX} 字` }
  return title
}

function resolveDatasetId(
  raw: unknown,
  knownIds: ReadonlySet<string>,
): string | { error: string } {
  if (raw != null && raw !== '') {
    if (!isAllowedResearchCanvasDatasetId(raw, knownIds)) return { error: 'datasetId 不受支持' }
    if (!isLegacyMockResearchDatasetId(raw) && !knownIds.has(raw)) return { error: 'datasetId 不受支持' }
    return raw
  }
  if (knownIds.size === 1) return [...knownIds][0] ?? ''
  if (knownIds.size === 0) return { error: '请先查询数据，再创建组件' }
  return { error: '存在多个数据集，请指定 datasetId' }
}

function okResult(event: ResearchCanvasEvent, extra: Record<string, unknown>) {
  return { ok: true, ...extra, canvas_event: event }
}

export function extractResearchCanvasEvent(result: unknown): ResearchCanvasEvent | null {
  if (!isRecord(result) || result.error) return null
  return parseResearchCanvasEvent(result.canvas_event)
}

export function stripResearchCanvasEventField(result: unknown): unknown {
  if (!isRecord(result) || !('canvas_event' in result)) return result
  const rest = { ...result }
  delete rest.canvas_event
  return rest
}

export function buildResearchCanvasTools(hub?: ResearchDataHub | null): ResearchCanvasToolDef[] {
  const tools: ResearchCanvasToolDef[] = [
    {
      name: 'resolve_industry_universe',
      category: '研究画布',
      description:
        '把行业或主题解析为可确认的上市公司名单，不取财务数字。用于「某行业某指标排名/对比」。返回候选后必须 ask_user 确认，默认预选 8 家，最多 20 家，再 query_data。禁止口播公司名单。',
      parameters: S({
        industry: {
          type: 'string',
          description: '行业或主题，如 电池、光伏、白酒',
        },
        board_key: {
          type: 'string',
          description: '已知板块键时可传入，优先按成分股解析',
        },
        industry_code: {
          type: 'string',
          description: '已知行业代码时可传入',
        },
      }, ['industry']),
      handler: async (args: Record<string, unknown>) => {
        if (!hub) return { error: '数据层不可用' }
        if (!isRecord(args)) return { error: '参数无效' }
        const forbidden = rejectUnknownKeys(
          args,
          new Set(['industry', 'board_key', 'industry_code']),
        )
        if (forbidden) return { error: forbidden }
        return executeResolveIndustryUniverse(hub, args)
      },
    },
    {
      name: 'query_data',
      category: '研究画布',
      description: '按公司与指标查询真实财务或日K数据，生成数据集。点名不超过 3 家时直接取数；超过 3 家须先返回 plan_preview，用户确认后再传 confirmed:true。只返回 datasetId、覆盖度、intent 与 view.recommended / suggestedTitle，不返回明细数字。比较/看看/分析后应再调用 propose_widget。K 线用 metric=kline。最多 20 家；行业对比须先经 resolve_industry_universe 并经用户确认。',
      parameters: S({
        entities: {
          type: 'array',
          items: { type: 'string' },
          description: '公司简称、全称或股票代码',
        },
        metric: {
          type: 'string',
          description: '指标：gross_margin / revenue / revenue_growth / net_income / net_margin / roe / kline',
        },
        start: { type: 'string', description: '起始年份，如 2021' },
        end: { type: 'string', description: '结束年份，如 2025' },
        confirmed: {
          type: 'boolean',
          description: '用户或界面确认取数计划后为 true；首次预览计划时不要传',
        },
      }, ['entities', 'metric', 'start', 'end']),
      handler: async (args: Record<string, unknown>) => {
        if (!hub) return { error: '数据层不可用' }
        if (!isRecord(args)) return { error: '参数无效' }
        const forbidden = rejectUnknownKeys(
          args,
          new Set(['entities', 'metric', 'start', 'end', 'confirmed']),
        )
        if (forbidden) return { error: forbidden }
        return executeQueryData(hub, args)
      },
    },
    {
      name: 'refine_dataset',
      category: '研究画布',
      description: '在已有数据集上增删公司、调整年份或按组算术平均，生成新的派生数据集，绝不覆盖原数据集。成功后调用 propose_widget，不要 update_widget。去掉公司或收窄年份不重新取数；改指标请用 query_data；改图种请用 propose_widget。',
      parameters: S({
        datasetId: {
          type: 'string',
          description: '要调整的已有 datasetId',
        },
        operation: {
          type: 'object',
          description: 'remove_entities / add_entities / change_period / aggregate_groups',
          properties: {
            type: {
              type: 'string',
              enum: ['remove_entities', 'add_entities', 'change_period', 'aggregate_groups'],
              description: '调整类型',
            },
            entities: {
              type: 'array',
              items: { type: 'string' },
              description: '公司名称或代码（增删公司时必填）',
            },
            start: { type: 'string', description: '起始年份，如 2023' },
            end: { type: 'string', description: '结束年份，如 2025' },
            method: {
              type: 'string',
              enum: ['arithmetic_mean'],
              description: 'aggregate_groups 时必填，目前仅 arithmetic_mean',
            },
            groups: {
              type: 'array',
              description: 'aggregate_groups 时必填：分组名 + 成员公司',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: '分组显示名，如 电池链条' },
                  members: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '该组包含的公司简称/代码',
                  },
                },
                required: ['name', 'members'],
                additionalProperties: false,
              },
            },
          },
          required: ['type'],
          additionalProperties: false,
        },
      }, ['datasetId', 'operation']),
      handler: async (args: Record<string, unknown>) => {
        if (!isRecord(args)) return { error: '参数无效' }
        const forbidden = rejectUnknownKeys(args, new Set(['datasetId', 'operation']))
        if (forbidden) return { error: forbidden }
        return executeRefineDataset(hub, args)
      },
    },
    {
      name: 'propose_widget',
      category: '研究画布',
      description: '在对话中提出研究视图预览，不写入右侧画布。用户确认后才会加入画布。优先传 intent（trend/rank/compare），type 可省略（系统按数据形状推荐）。bar_chart 只显示 params.period 一年；grouped_bar 横轴年份、每年并排多根柱。标题用返回的 suggestedTitle。改图种也用本工具，不要 update_widget。',
      parameters: S({
        intent: {
          type: 'string',
          enum: ['trend', 'rank', 'compare', 'composition', 'price'],
          description: '分析意图：trend 走势 / rank 排名 / compare 多年对照 / composition 构成 / price 日K',
        },
        type: {
          type: 'string',
          enum: TYPE_ENUM,
          description: '视图类型，可省略。默认用 query_data 返回的 view.recommended（含 grouped_bar / heatmap_table）',
        },
        title: {
          type: 'string',
          description: `视图标题，最多 ${RESEARCH_CANVAS_TITLE_MAX} 字；可省略，系统按 suggestedTitle 生成`,
        },
        datasetId: {
          type: 'string',
          description: 'query_data 返回的 datasetId；本轮仅有一个数据集时可省略',
        },
        params: {
          type: 'object',
          description: '视图参数：period 截面年份；topN 折线高亮家数',
          properties: {
            period: { type: 'string', description: '截面图显示的年份，如 2024' },
            topN: { type: 'string', description: '折线高亮前 N 家，1–20' },
          },
          additionalProperties: false,
        },
        style: CHART_STYLE_PROPERTY,
      }, []),
      handler: async (args: Record<string, unknown>) => {
        if (!isRecord(args)) return { error: '参数无效' }
        const forbidden = rejectUnknownKeys(args, new Set(['type', 'title', 'datasetId', 'intent', 'params', 'style']))
        if (forbidden) return { error: forbidden }
        return executeProposeWidget(args)
      },
    },
    {
      name: 'update_proposal',
      category: '研究画布',
      description: '更新对话中的研究预览样式或标题，不写入右侧画布。用户改图例/颜色/轴标题/系列名且预览尚未 Adopt 时用本工具；已 Adopt 到画布则用 update_widget。',
      parameters: S({
        proposalId: {
          type: 'string',
          description: 'propose_widget 返回的 proposalId；本轮仅有一个预览时可省略',
        },
        title: {
          type: 'string',
          description: `新标题，最多 ${RESEARCH_CANVAS_TITLE_MAX} 字`,
        },
        style: CHART_STYLE_PROPERTY,
        view: {
          type: 'object',
          description: '视图参数：period / topN',
          properties: {
            period: { type: 'string', description: '截面年份' },
            topN: { type: 'string', description: '折线高亮前 N 家' },
          },
          additionalProperties: false,
        },
      }, []),
      handler: async (args: Record<string, unknown>) => {
        if (!isRecord(args)) return { error: '参数无效' }
        const forbidden = rejectUnknownKeys(args, new Set(['proposalId', 'title', 'style', 'view']))
        if (forbidden) return { error: forbidden }
        return executeUpdateProposal(args)
      },
    },
    {
      name: 'create_widget',
      category: '研究画布',
      description: '仅当用户明确要求直接加入右侧研究画布时新增组件。只声明类型与标题，不要传坐标。',
      parameters: S({
        type: {
          type: 'string',
          enum: TYPE_ENUM,
          description: '组件类型：line_chart / bar_chart / grouped_bar / stacked_bar / stacked_bar_percent / combo_bar_line / pie_chart / donut_chart / candlestick / heatmap_table / table / sources',
        },
        title: {
          type: 'string',
          description: `组件标题，最多 ${RESEARCH_CANVAS_TITLE_MAX} 字`,
        },
        datasetId: {
          type: 'string',
          description: 'query_data 返回的 datasetId；本轮仅有一个数据集时可省略',
        },
      }, ['type', 'title']),
      handler: async (args: Record<string, unknown>) => {
        if (!isRecord(args)) return { error: '参数无效' }
        const forbidden = rejectUnknownKeys(args, new Set(['type', 'title', 'datasetId']))
        if (forbidden) return { error: forbidden }
        const type = parseType(args.type)
        if (typeof type !== 'string') return type
        const title = parseTitle(args.title)
        if (typeof title !== 'string') return title
        const turn = requireTurnCanvasState()
        if ('error' in turn) return turn
        const datasetId = resolveDatasetId(args.datasetId, knownTurnDatasetIds(turn.datasets))
        if (typeof datasetId !== 'string') return datasetId
        if (turn.widgets.length >= RESEARCH_CANVAS_WIDGET_LIMIT) {
          return { error: '画布组件数量已达上限' }
        }
        const widget: ResearchCanvasWidgetSnapshot = {
          id: `rc-${randomUUID()}`,
          type,
          title,
          datasetId,
        }
        const event: ResearchCanvasEvent = { type: 'widget_created', widget }
        replaceTurnCanvasWidgets(turn.sessionId, applyTurnCanvasEvent(turn.widgets, event))
        return okResult(event, { widget })
      },
    },
    {
      name: 'update_widget',
      category: '研究画布',
      description: '更新右侧研究画布已有组件的类型、标题、数据集或图表样式（图例/颜色/轴标题），不改变用户排版。对话里改图种请用 propose_widget；改颜色/图例/标签用 style；仅当用户明确要求改右侧已有图的数据范围时才改 datasetId。',
      parameters: S({
        id: { type: 'string', description: '要更新的组件 id' },
        type: {
          type: 'string',
          enum: TYPE_ENUM,
          description: '新的组件类型',
        },
        title: {
          type: 'string',
          description: `新标题，最多 ${RESEARCH_CANVAS_TITLE_MAX} 字`,
        },
        datasetId: {
          type: 'string',
          description: '已有真实数据集 id；必须存在且不得覆盖旧数据集',
        },
        style: CHART_STYLE_PROPERTY,
      }, ['id']),
      handler: async (args: Record<string, unknown>) => {
        if (!isRecord(args)) return { error: '参数无效' }
        const forbidden = rejectUnknownKeys(args, new Set(['id', 'type', 'title', 'datasetId', 'style']))
        if (forbidden) return { error: forbidden }
        const id = typeof args.id === 'string' ? args.id.trim() : ''
        if (!id) return { error: 'id 必填' }
        const turn = requireTurnCanvasState()
        if ('error' in turn) return turn
        const patch: Partial<Pick<ResearchCanvasWidgetSnapshot, 'type' | 'title' | 'datasetId' | 'style'>> = {}
        if ('type' in args) {
          const type = parseType(args.type)
          if (typeof type !== 'string') return type
          patch.type = type
        }
        if ('title' in args) {
          const title = parseTitle(args.title)
          if (typeof title !== 'string') return title
          patch.title = title
        }
        if ('datasetId' in args) {
          const datasetId = resolveDatasetId(args.datasetId, knownTurnDatasetIds(turn.datasets))
          if (typeof datasetId !== 'string') return datasetId
          patch.datasetId = datasetId
        }
        if (!Object.keys(patch).length && !('style' in args)) {
          return { error: '至少提供 type、title、datasetId 或 style 之一' }
        }
        const current = turn.widgets.find(widget => widget.id === id)
        if (!current) return { error: '组件不存在' }
        if ('style' in args) {
          const stylePatch = bindChartStyle(
            sanitizeChartStyle(args.style),
            patch.datasetId ?? current.datasetId,
            turn.records,
          )
          if (!stylePatch) return { error: 'style 无效' }
          patch.style = stylePatch
        }
        if (!Object.keys(patch).length) return { error: '至少提供 type、title、datasetId 或 style 之一' }
        const mergedStyle = patch.style
          ? mergeChartStyle(current.style, patch.style)
          : current.style
        const eventPatch = {
          ...patch,
          ...(mergedStyle ? { style: mergedStyle } : {}),
        }
        const widget = {
          ...current,
          ...eventPatch,
        }
        const event: ResearchCanvasEvent = { type: 'widget_updated', id, patch: eventPatch }
        replaceTurnCanvasWidgets(turn.sessionId, applyTurnCanvasEvent(turn.widgets, event))
        return okResult(event, { widget })
      },
    },
    {
      name: 'delete_widget',
      category: '研究画布',
      description: '从右侧研究画布移除指定组件。',
      parameters: S({
        id: { type: 'string', description: '要删除的组件 id' },
      }, ['id']),
      handler: async (args: Record<string, unknown>) => {
        if (!isRecord(args)) return { error: '参数无效' }
        const forbidden = rejectUnknownKeys(args, new Set(['id']))
        if (forbidden) return { error: forbidden }
        const id = typeof args.id === 'string' ? args.id.trim() : ''
        if (!id) return { error: 'id 必填' }
        const turn = requireTurnCanvasState()
        if ('error' in turn) return turn
        const current = turn.widgets.find(widget => widget.id === id)
        if (!current) return { error: '组件不存在' }
        const event: ResearchCanvasEvent = { type: 'widget_deleted', id }
        replaceTurnCanvasWidgets(turn.sessionId, applyTurnCanvasEvent(turn.widgets, event))
        return okResult(event, { widget: current })
      },
    },
  ]
  return tools.map(tool => ({ ...tool, meta: TOOL_META[tool.name] }))
}
