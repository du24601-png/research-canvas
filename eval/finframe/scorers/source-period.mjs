/**
 * 评分器 2：给出数据结论的题，必须同时有「来源」与「报告期」。
 * - 结构：每个 propose_widget 指向一个存在的 Dataset，且其每个非空数据点都有带 period 的来源。
 * - 正文：回复里说明了数据期间（年份 / 财年 / 报告期）和来源出处（来源 / 数据源 / 查看来源）。
 * 只对 expect 为 answer / answer_with_gap 的题生效。
 */
const PERIOD_RE = /(?:19|20)\d{2}\s*(?:年|财年|FY|[-–—~至到])|报告期|财年|年报|FY\s?\d{2,4}|近[一二三四五六七八九十\d]+年/
const SOURCE_RE = /来源|数据源|出处|溯源/

function proposedDatasetIds(calls) {
  return calls.filter((c) => c.name === 'propose_widget').map((c) => String(c.args?.datasetId ?? ''))
}

function datasetSourced(ds) {
  const points = (ds.data ?? []).filter((p) => p.value != null)
  return points.every((p) => (ds.sources ?? []).some((s) => s.entityId === p.entityId && s.period === p.period && s.provider))
}

function structuralReasons(calls, datasets) {
  const byId = new Map(datasets.map((d) => [d.id, d]))
  const ids = proposedDatasetIds(calls)
  if (!ids.length) return ['未提出任何研究视图，无法核对来源']
  const reasons = []
  for (const id of ids) {
    const ds = byId.get(id)
    if (!ds) reasons.push(`预览引用了不存在的数据集 ${id || '(空)'}`)
    else if (!datasetSourced(ds)) reasons.push(`数据集 ${id} 有数据点缺来源或报告期`)
  }
  return reasons
}

export function scoreSourcePeriod({ evalCase, calls, texts, datasets }) {
  const expect = evalCase?.expect ?? 'answer'
  if (expect !== 'answer' && expect !== 'answer_with_gap') {
    return { scorer: 'source_period', applicable: false, pass: null, reasons: [] }
  }
  const reply = texts.join('\n')
  const checks = {
    structural: structuralReasons(calls, datasets).length === 0,
    period_in_reply: PERIOD_RE.test(reply),
    source_in_reply: SOURCE_RE.test(reply),
  }
  const reasons = [
    ...structuralReasons(calls, datasets),
    ...(checks.period_in_reply ? [] : ['回复未说明数据期间/报告期']),
    ...(checks.source_in_reply ? [] : ['回复未说明数据来源']),
  ]
  return { scorer: 'source_period', applicable: true, pass: reasons.length === 0, checks, reasons }
}
