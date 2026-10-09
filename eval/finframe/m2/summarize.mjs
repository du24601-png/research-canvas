#!/usr/bin/env node
/**
 * 汇总一组 M2 测量：从日志里找到本组写出的记录文件，按层列出分数与失败题。
 * 用法：node eval/finframe/m2/summarize.mjs <label> <logdir>
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const [label, logdir] = process.argv.slice(2)

function recordPath(log, pattern) {
  if (!existsSync(log)) return null
  const hit = readFileSync(log, 'utf8').match(pattern)
  return hit ? hit[1].trim().replace(/\.md$/, '.json') : null
}

function seedRow(file) {
  const r = JSON.parse(readFileSync(file, 'utf8'))
  const s = r.summary
  const fmt = k => `${s.scorers[k].passed}/${s.scorers[k].applicable}`
  return {
    commit: r.git.commit.slice(0, 7), dirty: r.git.dirty,
    numbers: fmt('numbers_grounded'), source_period: fmt('source_period'), refusal: fmt('refusal'),
    chain: `${s.chain.passed}/${s.chain.judged}`,
    composer: s.composer ? `${s.composer.passed}/${s.composer.applicable}` : '—',
    fails: Object.fromEntries(Object.entries(s.scorers).map(([k, v]) => [k, v.failed_cases])),
    chain_fails: r.results.filter(x => !x.chain.pass).map(x => x.caseId),
    secs: Math.round(r.duration_ms / 1000),
  }
}

function layerRow(file) {
  const r = JSON.parse(readFileSync(file, 'utf8'))
  return {
    commit: r.git.commit.slice(0, 7), dirty: r.git.dirty,
    passed: `${r.summary.passed}/${r.summary.judged}`,
    fails: r.results.filter(x => !x.skipped && !x.pass).map(x => x.caseId),
    secs: Math.round(r.duration_ms / 1000),
  }
}

const out = { label, seed: [], planning: [], prompt: [] }
for (const i of [1, 2]) {
  const seed = recordPath(path.join(logdir, `${label}-seed-${i}.log`), /record (.+\.json)/)
  if (seed) out.seed.push(seedRow(seed))
  for (const layer of ['planning', 'prompt']) {
    const rec = recordPath(path.join(logdir, `${label}-${layer}-${i}.log`), /archive (.+\.md)/)
    if (rec) out[layer].push(layerRow(rec))
  }
}
console.log(JSON.stringify(out, null, 2))
