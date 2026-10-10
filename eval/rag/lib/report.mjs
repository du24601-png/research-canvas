/** 汇总各配置结果 → 记录 JSON 的 summary 与 Markdown 表 */
import { aggregate, noAnswerStats } from './metrics.mjs'

const f = (x, d = 3) => (x == null ? '—' : Number(x).toFixed(d))
const mb = b => (b == null ? '—' : (b / 1024 / 1024).toFixed(1))

export function summarize(result) {
  const out = {}
  for (const mode of ['question', 'keywords']) {
    const rows = result.rows.filter(r => r.mode === mode)
    out[mode] = {
      all: aggregate(rows),
      excludingParseGap: aggregate(rows, r => !r.parse_gap),
      noAnswer: noAnswerStats(rows),
    }
  }
  return out
}

function overallTable(results, mode) {
  const lines = [
    `| config | R@5 | R@10 | MRR@10 | nDCG@10 | R@10 (excl. 招行) | 0-hit | p50 ms | p95 ms |`,
    '|---|---|---|---|---|---|---|---|---|',
  ]
  for (const r of results) {
    const s = r.summary[mode]
    const o = s.all.overall
    lines.push(`| ${r.config} | ${f(o.r5)} | ${f(o.r10)} | ${f(o.mrr10)} | ${f(o.ndcg10)} | ${f(s.excludingParseGap.overall.r10)} | ${o.zeroHit}/${o.n} | ${f(r.latencyMs[mode].p50, 1)} | ${f(r.latencyMs[mode].p95, 1)} |`)
  }
  return lines.join('\n')
}

function typeTable(results, mode) {
  const types = [...new Set(results.flatMap(r => Object.keys(r.summary[mode].excludingParseGap.byType)))]
  const lines = [`| config | ${types.join(' | ')} |`, `|---|${types.map(() => '---').join('|')}|`]
  for (const r of results) {
    const bt = r.summary[mode].excludingParseGap.byType
    lines.push(`| ${r.config} | ${types.map(t => f(bt[t]?.r10)).join(' | ')} |`)
  }
  return lines.join('\n')
}

function costTable(results) {
  const lines = [
    '| config | ingest s | embed s | SQLite MB | FTS-u61 MB | FTS-tri MB | Lance MB | peak RSS MB |',
    '|---|---|---|---|---|---|---|---|',
  ]
  for (const r of results) {
    const embed = r.ingest.perDoc.reduce((a, d) => a + d.embedMs, 0)
    const t = r.index.tables
    lines.push(`| ${r.config} | ${f(r.ingest.totalMs / 1000, 1)} | ${f(embed / 1000, 1)} | ${mb(r.index.sqliteBytes)} | ${mb(t?.fts_unicode61)} | ${mb(t?.fts_trigram)} | ${mb(r.index.lanceBytes)} | ${mb(r.peakRssBytes)} |`)
  }
  return lines.join('\n')
}

function noAnswerTable(results, mode) {
  const lines = [
    '| config | returned hits | median top1 (none) | median top1 (answerable) | median vec cos (none) | median vec cos (answerable) |',
    '|---|---|---|---|---|---|',
  ]
  for (const r of results) {
    const s = r.summary[mode].noAnswer
    lines.push(`| ${r.config} | ${s.returnedAny}/${s.n} | ${f(s.medianTop1None)} | ${f(s.medianTop1Answerable)} | ${f(s.medianVecTop1None)} | ${f(s.medianVecTop1Answerable)} |`)
  }
  return lines.join('\n')
}

export function markdown(results) {
  const parts = []
  for (const [mode, label] of [['question', '原问题直接检索（natural question as query）'], ['keywords', 'Agent 式关键词检索（keyword rewrite）']]) {
    parts.push(`### ${label}\n\n${overallTable(results, mode)}\n\nR@10 by type (excl. 招行 parse gap):\n\n${typeTable(results, mode)}\n\n无答案 (12):\n\n${noAnswerTable(results, mode)}`)
  }
  parts.push(`### Cost\n\n${costTable(results)}`)
  return parts.join('\n\n')
}
