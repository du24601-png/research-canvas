#!/usr/bin/env node
/**
 * 两份评测记录的前后对照（按配置名对齐，重新从 rows 计算指标，兼容旧记录）。
 * 用法：node eval/rag/compare.mjs <before.json> <after.json>
 */
import { readFileSync } from 'node:fs'
import { summarize } from './lib/report.mjs'

const [beforePath, afterPath] = process.argv.slice(2)
if (!beforePath || !afterPath) {
  console.error('usage: node eval/rag/compare.mjs <before.json> <after.json>')
  process.exit(1)
}
const load = p => new Map(JSON.parse(readFileSync(p, 'utf8')).results.map(r => [r.config, { ...r, summary: summarize(r) }]))
const before = load(beforePath)
const after = load(afterPath)
const f = x => (x == null ? '—' : Number(x).toFixed(3))
const pair = (a, b) => `${f(a)} → ${f(b)}`

for (const [mode, label] of [['question', '原问题'], ['keywords', '关键词']]) {
  console.log(`\n### ${label}：before → after\n`)
  console.log('| config | R@10 | MRR@10 | nDCG@10 | 招行 R@10 | found:false 可答 | found:false 无答案 |')
  console.log('|---|---|---|---|---|---|---|')
  for (const name of new Set([...before.keys(), ...after.keys()])) {
    const b = before.get(name)?.summary[mode]
    const a = after.get(name)?.summary[mode]
    const o = x => x?.all.overall
    const nf = x => (x ? `${x.all.overall.notFound}/${x.all.overall.n}` : '—')
    const nn = x => (x ? `${x.noAnswer.notFound}/${x.noAnswer.n}` : '—')
    console.log(`| ${name} | ${pair(o(b)?.r10, o(a)?.r10)} | ${pair(o(b)?.mrr10, o(a)?.mrr10)} | ${pair(o(b)?.ndcg10, o(a)?.ndcg10)} | ${pair(b?.byDoc.cmb?.r10, a?.byDoc.cmb?.r10)} | ${nf(b)} → ${nf(a)} | ${nn(b)} → ${nn(a)} |`)
  }
}
