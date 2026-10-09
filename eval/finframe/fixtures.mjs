/**
 * FinFrame 夹具：在 planning 夹具之上，让 query_data / refine_dataset 产出带数值的
 * 数据集（只存在评测侧，供评分器核对）。模型看到的结果用生产 describeDatasetForModel，
 * 与线上一样不含明细数字。
 */
import { describeDatasetForModel } from '../../packages/agent/dist/research-query-data.js'
import { buildResearchFetchPlan } from '../../packages/shared/dist/research-query-plan.js'
import { resolveResearchMetric } from '../../packages/shared/dist/research-metrics.js'
import { yoyDeltaDataset } from '../../packages/shared/dist/research-dataset-delta.js'
import { stubTool } from '../agent/planning/fixtures.mjs'
import {
  FIXTURE_FETCHED_AT,
  FIXTURE_PROVIDER,
  fixtureSearch,
  isNonCnText,
  METRIC_LABELS,
  metricUnit,
  metricValue,
  resolveFixtureEntity,
} from './fixture-data.mjs'

const YEAR_RE = /^\d{4}$/


function years(start, end) {
  const out = []
  for (let y = Number(start); y <= Number(end); y += 1) out.push(String(y))
  return out
}

function resolveAll(names) {
  const entities = []
  for (const raw of names) {
    const hit = resolveFixtureEntity(raw)
    if (hit.error) return hit
    entities.push(hit.entity)
  }
  return { entities }
}

export function buildFixtureDataset(id, entities, metric, periods, extra = {}) {
  const data = []
  const sources = []
  for (const e of entities) {
    for (const period of periods) {
      const value = metricValue(e.ticker, metric, period)
      data.push({ entityId: e.id, period, value })
      if (value != null) {
        sources.push({ provider: FIXTURE_PROVIDER, entityId: e.id, metric, period, fetchedAt: FIXTURE_FETCHED_AT, fieldLabel: METRIC_LABELS[metric] })
      }
    }
  }
  const title = `${entities.map((e) => e.name).join('、')} ${METRIC_LABELS[metric] ?? metric}`
  return { id, title, metric, unit: metricUnit(metric), entities, periods, data, sources, createdAt: FIXTURE_FETCHED_AT, ...extra }
}

function nextId(state) {
  return `research-ds-ff-${state.datasets.size + 1}`
}

function validateQuery(args) {
  const names = Array.isArray(args?.entities) ? args.entities.map(String) : []
  if (!names.length) return { error: 'entities 至少包含一家公司' }
  if (!METRIC_LABELS[args?.metric]) return { error: '不支持该指标' }
  const start = String(args?.start ?? '').trim()
  const end = String(args?.end ?? '').trim()
  if (!YEAR_RE.test(start) || !YEAR_RE.test(end)) return { error: '年份须为四位数字' }
  if (start > end) return { error: '起始年份不能晚于结束年份' }
  return { names, start, end }
}

function storeDataset(state, dataset) {
  state.datasets.set(dataset.id, dataset)
  state.lastDatasetId = dataset.id
  state.lastStatus = 'dataset'
}

export function stubQueryData(args, state) {
  const parsed = validateQuery(args)
  if (parsed.error) return parsed
  const resolved = resolveAll(parsed.names)
  if (resolved.error) return resolved
  const { entities } = resolved
  // 与生产一致：传指标对象（M1–M4 的种子运行误传字符串，计划文案里指标显示为 undefined）
  const plan = buildResearchFetchPlan({ entityNames: entities.map((e) => e.name), metric: resolveResearchMetric(args.metric), start: parsed.start, end: parsed.end })
  const confirmed = args.confirmed === true || args.confirmed === 'true'
  if (!confirmed && plan.tier === 'must_confirm') {
    state.lastStatus = 'plan_preview'
    return { ok: true, status: 'plan_preview', plan, tier: plan.tier, requires_user_confirm: true, query: { entities: parsed.names, metric: args.metric, start: parsed.start, end: parsed.end }, hint: '等待用户确认后再取数；须再次调用 query_data 并设置 confirmed 为 true。' }
  }
  const dataset = buildFixtureDataset(nextId(state), entities, args.metric, years(parsed.start, parsed.end))
  if (dataset.data.every((p) => p.value == null)) return { error: '当前数据源未能提供该指标，请稍后再试' }
  storeDataset(state, dataset)
  const autoPlan = !confirmed && plan.tier === 'auto' ? { plan, tier: plan.tier, statement: plan.statement } : {}
  return { ok: true, datasetId: dataset.id, metric: dataset.metric, entities: entities.length, periods: dataset.periods.length, ...describeDatasetForModel(dataset), ...autoPlan }
}

function refineEntities(parent, op) {
  const names = (op.entities ?? []).map(String)
  if (op.type === 'remove_entities') {
    return { entities: parent.entities.filter((e) => !names.some((n) => resolveFixtureEntity(n).entity?.id === e.id)) }
  }
  const added = resolveAll(names)
  if (added.error) return added
  return { entities: [...parent.entities, ...added.entities.filter((e) => !parent.entities.some((p) => p.id === e.id))] }
}

export function stubRefine(args, state) {
  const parent = state.datasets.get(String(args?.datasetId ?? ''))
  if (!parent) return { error: '找不到该数据集，请先 query_data' }
  const op = args?.operation ?? {}
  if (op.type === 'yoy_delta') return stubYoyDelta(parent, state)
  let entities = parent.entities
  let periods = parent.periods
  if (op.type === 'change_period') periods = years(op.start, op.end)
  else if (op.type === 'remove_entities' || op.type === 'add_entities') {
    const next = refineEntities(parent, op)
    if (next.error) return next
    entities = next.entities
  } else return { error: '评测夹具未实现该变换' }
  if (!entities.length || !periods.length) return { error: '变换后没有剩余数据' }
  const dataset = buildFixtureDataset(nextId(state), entities, parent.metric, periods, { parentDatasetId: parent.id, transform: op })
  storeDataset(state, dataset)
  return { ok: true, datasetId: dataset.id, parentDatasetId: parent.id, ...describeDatasetForModel(dataset) }
}

/** 与生产一致：同比变化由 shared 代码计算，派生新数据集 */
function stubYoyDelta(parent, state) {
  const body = yoyDeltaDataset(parent)
  if (body.error) return body
  const dataset = { ...body, id: nextId(state), parentDatasetId: parent.id, transform: { type: 'yoy_delta' } }
  storeDataset(state, dataset)
  return { ok: true, datasetId: dataset.id, parentDatasetId: parent.id, transform: 'yoy_delta', ...describeDatasetForModel(dataset) }
}

function stubInstrument(name, args) {
  const sym = String(args?.symbol ?? args?.code ?? args?.keyword ?? args?.query ?? '')
  if (isNonCnText(sym)) return { ok: false, error: '当前数据源暂不支持该市场的标的' }
  if (name === 'search_instruments') return { ok: true, matches: fixtureSearch(sym) }
  return { ok: false, error: '评测夹具不提供该工具的明细数据，请用 query_data' }
}

const INSTRUMENT_TOOLS = new Set(['search_instruments', 'get_instrument_financials', 'get_instrument_snapshot', 'get_instrument_profile', 'get_instrument_quotes'])

/**
 * 题目里声明的故障注入（seed-v2 工具错误与降级）：{ tool, calls: [1, 2] | 'all', result }
 * calls 按该工具在本题里的第几次调用计（从 1 开始）。
 */
function injectedFault(call, evalCase, store) {
  const faults = Array.isArray(evalCase?.faults) ? evalCase.faults : []
  if (!faults.length) return null
  store.toolCounts = store.toolCounts ?? new Map()
  const n = (store.toolCounts.get(call.name) ?? 0) + 1
  store.toolCounts.set(call.name, n)
  const hit = faults.find(f => f.tool === call.name && (f.calls === 'all' || (Array.isArray(f.calls) && f.calls.includes(n))))
  return hit ? { ...hit.result } : null
}

/** 每题一个 store：评分器在跑完后读 store.datasets */
export function makeFinframeStub(store) {
  return (call, evalCase, state) => {
    state.datasets = store.datasets
    return injectedFault(call, evalCase, store) ?? stubFinframeTool(call, evalCase, state)
  }
}

function stubFinframeTool(call, evalCase, state) {
  const args = call?.args ?? {}
  if (call?.name === 'query_data') return stubQueryData(args, state)
  if (call?.name === 'refine_dataset') return stubRefine(args, state)
  if (INSTRUMENT_TOOLS.has(call?.name)) return stubInstrument(call.name, args)
  if (call?.name === 'propose_widget') {
    const id = String(args.datasetId ?? '')
    if (!state.datasets.has(id)) return { error: `数据集 ${id || '(空)'} 不存在` }
  }
  return stubTool(call, evalCase, state)
}
