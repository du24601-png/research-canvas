/**
 * 页级检索指标。金标按「组」计：单文档题 1 组（组内任一页命中即算命中），跨公司题每家公司 1 组。
 * - Recall@k：命中的组数 / 组数
 * - MRR@10：首个命中（任一组）的倒数排名
 * - nDCG@10：每组仅首个命中页记 rel=1（重复命中同组不加分），理想 DCG = min(组数, k) 个 1
 */

/** @param {Array<{doc:string,page:number}>} ranked 去重后的页序列 */
export function scoreQuestion(ranked, gold) {
  const groups = gold.map(g => ({ doc: g.doc, pages: new Set(g.pages) }))
  const groupOf = r => groups.findIndex(g => g.doc === r.doc && g.pages.has(r.page))
  const firstRankOfGroup = new Array(groups.length).fill(null)
  ranked.forEach((r, i) => {
    const gi = groupOf(r)
    if (gi >= 0 && firstRankOfGroup[gi] == null) firstRankOfGroup[gi] = i + 1
  })
  const recallAt = k => groups.length
    ? firstRankOfGroup.filter(x => x != null && x <= k).length / groups.length
    : null
  const firstHit = Math.min(...firstRankOfGroup.filter(x => x != null), Infinity)
  const mrr10 = firstHit <= 10 ? 1 / firstHit : 0
  let dcg = 0
  for (const r of firstRankOfGroup) if (r != null && r <= 10) dcg += 1 / Math.log2(r + 1)
  let idcg = 0
  for (let i = 1; i <= Math.min(groups.length, 10); i++) idcg += 1 / Math.log2(i + 1)
  return {
    r5: recallAt(5), r10: recallAt(10), mrr10, ndcg10: idcg ? dcg / idcg : 0,
    firstHit: Number.isFinite(firstHit) ? firstHit : null,
  }
}

/** 命中块 → 去重页序列（保持首次出现顺序） */
export function hitsToPages(hits, docKeyById) {
  const seen = new Set()
  const out = []
  for (const h of hits) {
    const doc = docKeyById.get(h.document_id) ?? h.document_id
    const key = `${doc}:${h.page}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ doc, page: h.page })
  }
  return out
}

const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null

export function percentile(xs, p) {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))
  return s[idx]
}

/** 按 type 与 overall 聚合；filter 可排除 parse_gap 等 */
export function aggregate(rows, filter = () => true) {
  const answerable = rows.filter(r => r.type !== '无答案' && filter(r))
  const byType = {}
  for (const r of answerable) (byType[r.type] ??= []).push(r)
  const summarize = rs => ({
    n: rs.length,
    r5: mean(rs.map(r => r.m.r5)),
    r10: mean(rs.map(r => r.m.r10)),
    mrr10: mean(rs.map(r => r.m.mrr10)),
    ndcg10: mean(rs.map(r => r.m.ndcg10)),
    zeroHit: rs.filter(r => r.hitCount === 0).length,
  })
  return {
    overall: summarize(answerable),
    byType: Object.fromEntries(Object.entries(byType).map(([t, rs]) => [t, summarize(rs)])),
  }
}

/** 无答案题：返回结果的比例、top1 分数分布，与可答题 top1 分数对照 */
export function noAnswerStats(rows) {
  const none = rows.filter(r => r.type === '无答案')
  const ans = rows.filter(r => r.type !== '无答案' && !r.parse_gap)
  const med = rs => percentile(rs.map(r => r.top1Score).filter(x => x != null), 50)
  return {
    n: none.length,
    returnedAny: none.filter(r => r.hitCount > 0).length,
    medianTop1None: med(none),
    medianTop1Answerable: med(ans),
    medianVecTop1None: percentile(none.map(r => r.vecTop1).filter(x => x != null), 50),
    medianVecTop1Answerable: percentile(ans.map(r => r.vecTop1).filter(x => x != null), 50),
  }
}
