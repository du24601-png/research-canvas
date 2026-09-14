#!/usr/bin/env node
/** 把 component/runs 里缺元数据的旧报告补成正式留档。 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EVAL_SYSTEM_PROMPT } from './prompt.mjs'
import { loadEvalCases, listEvalSourceFiles, SKIP_CASE_IDS } from './load-cases.mjs'
import { buildEvalRecord, hydrateLegacyResults } from './archive-record.mjs'
import { hashEvalSources, readGitMeta } from './archive-meta.mjs'
import { writeEvalArchive } from './archive-write.mjs'

function stampToIso(stamp) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d+)Z$/.exec(String(stamp))
  if (!m) return new Date().toISOString()
  return `${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`
}

const DIR = path.dirname(fileURLToPath(import.meta.url))
const src = process.argv[2]
if (!src) {
  console.error('用法: node eval/agent/component/backfill-record.mjs <runs/run-*.json>')
  process.exit(2)
}

const legacy = JSON.parse(await readFile(path.resolve(src), 'utf8'))
const cases = await loadEvalCases({ skipIds: [] })
const report = {
  judged: legacy.judged,
  skipped: legacy.skipped,
  passed: legacy.passed,
  failed: legacy.failed,
  pass_rate: legacy.pass_rate,
  results: hydrateLegacyResults(legacy.results, cases),
}
const record = buildEvalRecord({
  kind: 'official',
  datasetId: 'agent-component-tushare-v1',
  at: stampToIso(legacy.at),
  durationMs: Number(process.env.EVAL_DURATION_MS || 64671),
  git: readGitMeta(path.resolve(DIR, '../../..')),
  hashes: await hashEvalSources(DIR, await listEvalSourceFiles()),
  llm: { model: legacy.model },
  prompt: EVAL_SYSTEM_PROMPT,
  skip: SKIP_CASE_IDS,
  notes: '由首轮 scratch 报告回填。当时 runner 未保存 tool args，本档案补了问句与 gold。',
  report,
})
const written = await writeEvalArchive(record, {
  scratchDir: path.join(DIR, 'runs'),
  recordsDir: path.join(DIR, '../records'),
})
console.log(written.records?.mdPath ?? written.scratch.mdPath)
