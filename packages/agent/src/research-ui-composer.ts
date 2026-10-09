/**
 * FinFrame M4 Composer（O1-A）：工具循环结束后单独一次模型调用，按本轮任务和 Dataset 元数据
 * 选组件、排顺序，产出 UI Spec。模型只看到 id / 指标 / 实体 / 期间 / 覆盖度，看不到任何数值。
 * 产出经 parseResearchUiSpec 整份校验；任何失败返回 null，前端保留原预览卡。
 */
import {
  datasetShape,
  parseResearchUiSpec,
  resolveResearchMetric,
  type ResearchDataset,
  type ResearchUiDatasetRef,
  type ResearchUiSpec,
} from '@opptrix/shared'
import type { ChatToolStep } from './chat-progress.js'

export const COMPOSE_RESEARCH_UI_TOOL = 'compose_research_ui'
const DATASET_TOOLS = new Set(['query_data', 'refine_dataset'])
const DATASET_LIMIT = 8

export type ComposerChat = (messages: Array<{ role: 'system' | 'user'; content: string }>) => Promise<string>

const SYSTEM = [
  '你为投研对话的回答挑选界面组件，只输出一个 JSON 对象，不要解释、不要代码块。',
  '格式：{"version":1,"blocks":[...]}，blocks 按展示顺序排列，1–6 个。可用组件：',
  '- ComparisonView {"component":"ComparisonView","datasetIds":[1–4 个 id],"actions":[...]}：多个指标或数据集并排对比。',
  '- TrendView {"component":"TrendView","datasetId":id,"actions":[...]}：单个数据集随年份的走势。用户问「哪年变化最大 / 变化明显」时加 "highlight_largest_change"。',
  '- MissingData {"component":"MissingData","datasetId":id}：数据集覆盖不完整时放一个。',
  '- EvidencePanel {"component":"EvidencePanel","datasetIds":[...]}：来源与口径，放在最后，列出用到的数据集。',
  'actions 只能用 "pin"（钉住）、"open_sources"（查看来源）、"rerun"（再查一次）、"adjust"（让用户说明怎么调整这张图）、"highlight_largest_change"（仅 TrendView）。',
  '只能引用下面列出的 datasetId。可选 "title"，须为中文短语，不得包含数字（年份除外）。你看不到数值，也不得写任何数值。',
].join('\n')

/** 本轮新产生的数据集 id（query_data / refine_dataset 成功结果里的 datasetId） */
export function turnDatasetIds(steps: readonly ChatToolStep[]): string[] {
  const ids: string[] = []
  for (const step of steps) {
    if (!DATASET_TOOLS.has(step.tool) || step.status !== 'done' || !step.resultDetail) continue
    try {
      const parsed = JSON.parse(step.resultDetail) as { datasetId?: unknown }
      if (typeof parsed.datasetId === 'string' && !ids.includes(parsed.datasetId)) ids.push(parsed.datasetId)
    } catch { /* 非 JSON 结果忽略 */ }
  }
  return ids.slice(-DATASET_LIMIT)
}

/** 给模型的元数据：不含任何数值 */
export function datasetMetaForComposer(dataset: ResearchDataset): Record<string, unknown> {
  const shape = datasetShape(dataset)
  return {
    id: dataset.id,
    metric: resolveResearchMetric(dataset.metric)?.name ?? dataset.metric,
    entities: dataset.entities.map(entity => entity.name),
    periods: dataset.periods,
    coverage: `${shape.filled}/${shape.total}`,
    complete: shape.filled === shape.total,
    ...(dataset.transform ? { derived: dataset.transform.type } : {}),
  }
}

function datasetRefs(datasets: readonly ResearchDataset[]): Map<string, ResearchUiDatasetRef> {
  return new Map(datasets.map(dataset => [dataset.id, {
    ...(dataset.parentDatasetId ? { parentDatasetId: dataset.parentDatasetId } : {}),
    ...(dataset.transform ? { transformType: dataset.transform.type } : {}),
  }]))
}

export function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

export type ComposeResult = { spec: ResearchUiSpec } | { error: string }

export async function composeResearchUi(input: {
  task: string
  datasets: readonly ResearchDataset[]
  chat: ComposerChat
}): Promise<ComposeResult> {
  if (!input.datasets.length) return { error: '本轮没有数据集' }
  const user = `用户问题：${input.task.slice(0, 600)}\n\n本轮数据集（只有元数据）：\n${JSON.stringify(input.datasets.map(datasetMetaForComposer))}`
  let text: string
  try {
    text = await input.chat([{ role: 'system', content: SYSTEM }, { role: 'user', content: user }])
  } catch (err) {
    return { error: `模型调用失败：${err instanceof Error ? err.message : String(err)}` }
  }
  const parsed = parseResearchUiSpec(extractJsonObject(text), datasetRefs(input.datasets))
  return parsed.ok ? { spec: parsed.spec } : { error: parsed.errors.slice(0, 3).join('；') }
}

/** 成功的 Spec 作为一个合成步骤随本轮保存，历史回放与实时一致 */
export function composerStep(spec: ResearchUiSpec, datasetIds: readonly string[]): ChatToolStep {
  const now = new Date().toISOString()
  return {
    id: `compose-ui-${now}`,
    tool: COMPOSE_RESEARCH_UI_TOOL,
    label: '组织界面',
    status: 'done',
    startedAt: now,
    finishedAt: now,
    resultDetail: JSON.stringify({ ok: true, spec, datasetIds }),
  }
}
