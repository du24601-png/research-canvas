/**
 * 研究回答的 UI Spec（FinFrame M3）。Spec 只描述「用哪些已注册组件、引用哪些已有 Dataset、
 * 允许哪些已注册动作」，不携带任何数值；数值一律由组件从 Dataset 读或由代码计算。
 * 校验失败整份拒绝（不修补、不补值），调用方回退到原预览卡。
 *
 * 说明：计划用 zod（F2-A），但本机安装依赖被拒，先用手写严格校验，规则与 zod 版一致：
 * 未知字段拒绝、未知组件/动作拒绝、未知 datasetId 拒绝、标题里不许出现年份以外的数字。
 */
export const RESEARCH_UI_SPEC_VERSION = 1

export const RESEARCH_UI_COMPONENTS = ['ComparisonView', 'TrendView', 'EvidencePanel', 'MissingData'] as const
export type ResearchUiComponent = typeof RESEARCH_UI_COMPONENTS[number]

export const RESEARCH_UI_ACTIONS = ['pin', 'open_sources', 'highlight_largest_change', 'rerun'] as const
export type ResearchUiAction = typeof RESEARCH_UI_ACTIONS[number]

export type ResearchUiBlock =
  | { component: 'ComparisonView'; datasetIds: string[]; title?: string; actions?: ResearchUiAction[] }
  | { component: 'TrendView'; datasetId: string; deltaDatasetId?: string; title?: string; actions?: ResearchUiAction[] }
  | { component: 'EvidencePanel'; datasetIds: string[] }
  | { component: 'MissingData'; datasetId: string }

export interface ResearchUiSpec {
  version: typeof RESEARCH_UI_SPEC_VERSION
  blocks: ResearchUiBlock[]
}

/** 校验时需要知道的 Dataset 元信息（不含数值） */
export interface ResearchUiDatasetRef {
  parentDatasetId?: string
  transformType?: string
}

export type ResearchUiSpecResult = { ok: true; spec: ResearchUiSpec } | { ok: false; errors: string[] }

const BLOCK_LIMIT = 8
const DATASETS_PER_BLOCK = 4
const TITLE_MAX = 40
/** 去掉四位年份后还剩数字 → 视为在 Spec 里写了数值 */
const YEAR_TOKEN = /(?:19|20)\d{2}/g

const FIELDS: Record<ResearchUiComponent, readonly string[]> = {
  ComparisonView: ['component', 'datasetIds', 'title', 'actions'],
  TrendView: ['component', 'datasetId', 'deltaDatasetId', 'title', 'actions'],
  EvidencePanel: ['component', 'datasetIds'],
  MissingData: ['component', 'datasetId'],
}

const ACTIONS_FOR: Record<ResearchUiComponent, readonly ResearchUiAction[]> = {
  ComparisonView: ['pin', 'open_sources', 'rerun'],
  TrendView: ['pin', 'open_sources', 'highlight_largest_change', 'rerun'],
  EvidencePanel: [],
  MissingData: [],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isComponent(value: unknown): value is ResearchUiComponent {
  return typeof value === 'string' && (RESEARCH_UI_COMPONENTS as readonly string[]).includes(value)
}

function checkTitle(raw: unknown, at: string, errors: string[]): string | undefined {
  if (raw === undefined) return undefined
  if (typeof raw !== 'string' || !raw.trim() || raw.length > TITLE_MAX) {
    errors.push(`${at}.title 须为 1–${TITLE_MAX} 字`)
    return undefined
  }
  if (/\d/.test(raw.replace(YEAR_TOKEN, ''))) errors.push(`${at}.title 不能包含数值（年份除外）`)
  return raw.trim()
}

function checkDatasetId(raw: unknown, at: string, known: ReadonlyMap<string, ResearchUiDatasetRef>, errors: string[]): string {
  if (typeof raw !== 'string' || !known.has(raw)) {
    errors.push(`${at} 引用了未知数据集 ${typeof raw === 'string' ? raw : '(非字符串)'}`)
    return ''
  }
  return raw
}

function checkDatasetIds(raw: unknown, at: string, known: ReadonlyMap<string, ResearchUiDatasetRef>, errors: string[]): string[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > DATASETS_PER_BLOCK) {
    errors.push(`${at} 须包含 1–${DATASETS_PER_BLOCK} 个数据集`)
    return []
  }
  if (new Set(raw).size !== raw.length) errors.push(`${at} 有重复数据集`)
  return raw.map((id, i) => checkDatasetId(id, `${at}[${i}]`, known, errors))
}

function checkActions(raw: unknown, component: ResearchUiComponent, at: string, errors: string[]): ResearchUiAction[] | undefined {
  if (raw === undefined) return undefined
  if (!Array.isArray(raw)) {
    errors.push(`${at}.actions 须为数组`)
    return undefined
  }
  const allowed = ACTIONS_FOR[component]
  for (const action of raw) {
    if (!allowed.includes(action as ResearchUiAction)) errors.push(`${at} 不支持动作 ${String(action)}`)
  }
  return raw as ResearchUiAction[]
}

function checkDelta(raw: unknown, parentId: string, at: string, known: ReadonlyMap<string, ResearchUiDatasetRef>, errors: string[]): string | undefined {
  if (raw === undefined) return undefined
  const id = checkDatasetId(raw, `${at}.deltaDatasetId`, known, errors)
  const ref = id ? known.get(id) : undefined
  if (ref && (ref.transformType !== 'yoy_delta' || ref.parentDatasetId !== parentId)) {
    errors.push(`${at}.deltaDatasetId 须是 ${parentId} 的同比变化数据集`)
  }
  return id
}

function parseBlock(raw: unknown, at: string, known: ReadonlyMap<string, ResearchUiDatasetRef>, errors: string[]): ResearchUiBlock | null {
  if (!isRecord(raw) || !isComponent(raw.component)) {
    errors.push(`${at} 使用了未注册组件 ${isRecord(raw) ? String(raw.component) : ''}`)
    return null
  }
  const component = raw.component
  for (const key of Object.keys(raw)) {
    if (!FIELDS[component].includes(key)) errors.push(`${at} 不允许字段 ${key}`)
  }
  if (component === 'EvidencePanel') return { component, datasetIds: checkDatasetIds(raw.datasetIds, `${at}.datasetIds`, known, errors) }
  if (component === 'MissingData') return { component, datasetId: checkDatasetId(raw.datasetId, `${at}.datasetId`, known, errors) }
  const title = checkTitle(raw.title, at, errors)
  const actions = checkActions(raw.actions, component, at, errors)
  const extra = { ...(title ? { title } : {}), ...(actions ? { actions } : {}) }
  if (component === 'ComparisonView') {
    return { component, datasetIds: checkDatasetIds(raw.datasetIds, `${at}.datasetIds`, known, errors), ...extra }
  }
  const datasetId = checkDatasetId(raw.datasetId, `${at}.datasetId`, known, errors)
  // 没给 deltaDatasetId 时，前端用 shared 的 yoyDeltaDataset 就地计算（仍是代码算，不是模型给的数）
  const deltaDatasetId = checkDelta(raw.deltaDatasetId, datasetId, at, known, errors)
  return { component, datasetId, ...(deltaDatasetId ? { deltaDatasetId } : {}), ...extra }
}

/** 整份校验：任何一处不合规都返回 ok:false，不产出部分 Spec */
export function parseResearchUiSpec(raw: unknown, known: ReadonlyMap<string, ResearchUiDatasetRef>): ResearchUiSpecResult {
  const errors: string[] = []
  if (!isRecord(raw)) return { ok: false, errors: ['Spec 须为对象'] }
  for (const key of Object.keys(raw)) {
    if (key !== 'version' && key !== 'blocks') errors.push(`不允许字段 ${key}`)
  }
  if (raw.version !== RESEARCH_UI_SPEC_VERSION) errors.push(`version 须为 ${RESEARCH_UI_SPEC_VERSION}`)
  if (!Array.isArray(raw.blocks) || raw.blocks.length === 0 || raw.blocks.length > BLOCK_LIMIT) {
    errors.push(`blocks 须包含 1–${BLOCK_LIMIT} 个组件`)
    return { ok: false, errors }
  }
  const blocks = raw.blocks.map((block, i) => parseBlock(block, `blocks[${i}]`, known, errors))
  if (errors.length) return { ok: false, errors }
  return { ok: true, spec: { version: RESEARCH_UI_SPEC_VERSION, blocks: blocks as ResearchUiBlock[] } }
}
