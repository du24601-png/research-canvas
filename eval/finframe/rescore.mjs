#!/usr/bin/env node
/**
 * 用当前评分器重算一份已存档的 FinFrame 记录（不调模型）。评分器改动后用它
 * 把新旧口径并排，避免为了改评分器重跑模型。
 * 用法：node eval/finframe/rescore.mjs eval/finframe/records/<file>.json
 */
import { readFile } from 'node:fs/promises'
import { buildFixtureDataset } from './fixtures.mjs'
import { resolveFixtureEntity } from './fixture-data.mjs'
import { loadSeedCases, tallyScorers } from './run.mjs'
import { runScorers } from './scorers/index.mjs'

function rebuildDatasets(row) {
  return row.datasets.map((d) => {
    const entities = d.entities.map((n) => resolveFixtureEntity(n).entity).filter(Boolean)
    return buildFixtureDataset(d.id, entities, d.metric, d.periods)
  })
}

async function main() {
  const file = process.argv[2]
  if (!file) throw new Error('需要记录文件路径')
  const record = JSON.parse(await readFile(file, 'utf8'))
  const { cases } = await loadSeedCases()
  const rows = record.results.map((row) => {
    const evalCase = cases.find((c) => c.id === row.caseId) ?? {}
    const scores = runScorers({ evalCase, calls: row.calls, texts: row.texts, datasets: rebuildDatasets(row) })
    return { ...row, scores }
  })
  const before = record.summary.scorers
  const after = tallyScorers(rows)
  for (const name of Object.keys(after)) {
    console.log(`${name}: ${before[name]?.passed}/${before[name]?.applicable} -> ${after[name].passed}/${after[name].applicable}  fail=${after[name].failed_cases.join(',') || '-'}`)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
