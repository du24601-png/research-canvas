/**
 * 向量检索相关度下限：仅过滤「纯向量命中」（关键词也命中的片段始终保留）。
 *
 * 数值来自 eval/rag/records 的评测（有答案题与无答案题 top1 相似度分布），
 * 是保守起点而非定论 —— 评测里两类分布有重叠，只能挡掉明显无关的尾部；可按模型调整。
 * 未登记的模型不设下限（保持旧行为）。
 */
import { MemoryVectorStore, type VectorStore } from './vector-store.js'

export const VECTOR_COSINE_FLOOR: Readonly<Record<string, number>> = {
  'bge-small-zh-v1.5': 0.45,
  'Qwen3-Embedding-0.6B': 0.45,
  // e5 的余弦整体偏高（无关文本也常在 0.7+），下限相应更高
  'multilingual-e5-small': 0.8,
}

export function relevanceFloorFor(modelId: string): number | undefined {
  return VECTOR_COSINE_FLOOR[modelId]
}

/**
 * 把向量库返回的 score 还原成余弦相似度。
 * - MemoryVectorStore：score 即余弦；
 * - LanceDB：score = 1 / (1 + d)，d 为 L2 距离的平方；向量已归一化时 d = 2 - 2cos，故 cos = (3 - 1/score) / 2。
 */
export function scoreToCosine(store: VectorStore, score: number): number {
  if (store instanceof MemoryVectorStore) return score
  if (!(score > 0)) return -1
  return (3 - 1 / score) / 2
}
