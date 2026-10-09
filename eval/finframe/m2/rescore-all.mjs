#!/usr/bin/env node
/**
 * 用当前评分器统一重算一批种子记录（不调模型），输出每次运行的分数，供 M2 报告并排比较。
 * 用法：node eval/finframe/m2/rescore-all.mjs <record.json> [...]
 */
import { readFileSync } from 'node:fs'
import { buildFixtureDataset } from '../fixtures.mjs'
import { resolveFixtureEntity } from '../fixture-data.mjs'
import { loadSeedCases, tallyScorers } from '../run.mjs'
import { runScorers } from '../scorers/index.mjs'

const { cases } = await loadSeedCases()

function rebuild(row) {
  return row.datasets.map((d) => {
    const entities = d.entities.map(n => resolveFixtureEntity(n).entity).filter(Boolean)
    return buildFixtureDataset(d.id, entities, d.metric, d.periods)
  })
}

for (const file of process.argv.slice(2)) {
  const record = JSON.parse(readFileSync(file, 'utf8'))
  const rows = record.results.map((row) => {
    const evalCase = cases.find(c => c.id === row.caseId) ?? {}
    return { ...row, scores: runScorers({ evalCase, calls: row.calls, texts: row.texts, datasets: rebuild(row) }) }
  })
  const t = tallyScorers(rows)
  const fmt = k => `${t[k].passed}/${t[k].applicable}`
  const chain = record.results.filter(r => r.chain.pass).length
  const comp = record.summary.composer ? `${record.summary.composer.passed}/${record.summary.composer.applicable}` : '—'
  console.log([record.git.commit.slice(0, 7), file.split(/[\/]/).pop().slice(0, 24), fmt('numbers_grounded'), fmt('source_period'), fmt('refusal'), `${chain}/12`, comp, `refusal_fail=${t.refusal.failed_cases.join(',')}`, `numbers_fail=${t.numbers_grounded.failed_cases.join(',')}`].join('\t'))
}
