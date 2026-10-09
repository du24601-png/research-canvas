#!/usr/bin/env node
/**
 * FinFrame 种子集评测（M1）。不是新 runner：复用 eval/agent 的 planning 循环、
 * 生产提示词拼装、LLM 配置与 git 元数据；只换夹具与评分器。
 * 正式：node eval/finframe/run.mjs        冒烟：EVAL_LIMIT=2 node eval/finframe/run.mjs
 * 不进 test:gate；评分器之间、与 eval:agent 三层之间都不加权合成。
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { completePlanningRound } from '../agent/planning/llm-round.mjs'
import { resolveLlmFromEnv } from '../agent/component/llm-client.mjs'
import { resolveLlmFromUserStore } from '../agent/component/load-llm-config.mjs'
import { publicLlmMeta } from '../agent/component/archive-record.mjs'
import { hashEvalSources, readGitMeta } from '../agent/component/archive-meta.mjs'
import { catalogToOpenAiTools } from '../agent/component/tools-openai.mjs'
import { isDirectRun, MISSING_LLM_MESSAGE } from '../agent/eval-cli.mjs'
import { FIXTURE_VERSION, fixtureMode, setFixtureMode } from './fixture-data.mjs'
import { runFinframeCase } from './run-case.mjs'
import { makeComposerChat } from './composer-eval.mjs'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(DIR, '../..')
/** EVAL_SEED=seed-v2 切换题集；默认 seed-v1（M1 起的基线） */
const CASE_FILE = `cases/${process.env.EVAL_SEED || 'seed-v1'}.json`
const MAX_TOKENS = 2048
const SOURCE_FILES = [CASE_FILE, 'composer-eval.mjs', 'snapshot-data.mjs', 'fixture-data.mjs', 'fixtures.mjs', 'run-case.mjs', 'run.mjs', 'scorers/numbers-grounded.mjs', 'scorers/source-period.mjs', 'scorers/refusal.mjs']

export async function loadSeedCases() {
  const pack = JSON.parse(await readFile(path.join(DIR, CASE_FILE), 'utf8'))
  setFixtureMode(pack.fixture_mode)
  return { pack, cases: pack.cases }
}

/** 按 §4.3 切片分别计分 */
export function tallyBySlice(results) {
  const slices = [...new Set(results.map(r => r.slice))]
  return Object.fromEntries(slices.map(slice => [slice, tallyScorers(results.filter(r => r.slice === slice))]))
}

export function tallyScorers(results) {
  const out = {}
  for (const row of results) {
    for (const s of row.scores) {
      const t = out[s.scorer] ?? (out[s.scorer] = { applicable: 0, passed: 0, failed_cases: [] })
      if (!s.applicable) continue
      t.applicable += 1
      if (s.pass && !row.error) t.passed += 1
      else t.failed_cases.push(row.caseId)
    }
  }
  return out
}

/** Composer 单独计分，不并入三个评分器 */
export function tallyComposer(results) {
  const rows = results.map(r => r.composer?.score).filter(s => s?.applicable)
  return {
    applicable: rows.length,
    valid: rows.filter(s => s.valid).length,
    passed: rows.filter(s => s.pass).length,
    zero_numbers: rows.filter(s => s.valid && s.numbers === 0).length,
    failed_cases: results.filter(r => r.composer?.score?.applicable && !r.composer.score.pass).map(r => r.caseId),
  }
}

function tallyUsage(results) {
  const keys = ['prompt_tokens', 'completion_tokens', 'cache_hit_tokens', 'rounds']
  return Object.fromEntries(keys.map((k) => [k, results.reduce((a, r) => a + (r.usage?.[k] ?? 0), 0)]))
}

function buildSummary(results) {
  return {
    cases: results.length,
    runner_errors: results.filter((r) => r.error).length,
    chain: { passed: results.filter((r) => r.chain.pass).length, judged: results.length },
    scorers: tallyScorers(results),
    all_scorers_passed: results.filter((r) => r.pass_all_scorers).length,
    composer: tallyComposer(results),
    by_slice: tallyBySlice(results),
    usage: tallyUsage(results),
  }
}

async function writeRecord(record, kind) {
  const dir = path.join(DIR, kind === 'official' ? 'records' : 'runs')
  await mkdir(dir, { recursive: true })
  const file = path.join(dir, `${record.at.replace(/[:.]/g, '-')}-${kind}-finframe.json`)
  await writeFile(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
  return file
}

export async function runFinframeEval(opts = {}) {
  const llm = opts.llm ?? resolveLlmFromEnv() ?? await resolveLlmFromUserStore()
  if (!llm) return { error: 'no_llm' }
  const { pack, cases } = await loadSeedCases()
  const limit = opts.limit ?? Number(process.env.EVAL_LIMIT || 0)
  const scoped = limit > 0 ? cases.slice(0, limit) : cases
  const kind = limit > 0 ? 'smoke' : 'official'
  const tools = await catalogToOpenAiTools()
  const complete = ({ messages, tools: t }) => completePlanningRound({ ...llm, messages, tools: t, maxTokens: MAX_TOKENS })
  const composerChat = process.env.EVAL_COMPOSER === '0' ? null : makeComposerChat(llm)
  const started = Date.now()
  const at = new Date().toISOString()
  console.error(`[eval:finframe] kind=${kind} model=${llm.model} cases=${scoped.length}`)
  const results = []
  for (const evalCase of scoped) {
    const row = await runFinframeCase(evalCase, { tools, complete, composerChat })
    const comp = row.composer?.score
    console.error(`[eval:finframe] ${row.caseId} chain=${row.chain.pass ? 'ok' : 'FAIL'} ${row.scores.map((s) => `${s.scorer}=${s.applicable ? (s.pass ? 'ok' : 'FAIL') : 'n/a'}`).join(' ')} composer=${comp?.applicable ? (comp.pass ? 'ok' : 'FAIL') : 'n/a'}`)
    results.push(row)
  }
  const record = {
    schema: 'finframe.eval.seed.v1',
    kind,
    dataset_id: pack.dataset_id,
    fixture_version: FIXTURE_VERSION,
    fixture_mode: fixtureMode(),
    at,
    duration_ms: Date.now() - started,
    git: readGitMeta(REPO),
    llm: publicLlmMeta(llm),
    params: { temperature: 0, max_tokens: MAX_TOKENS, tool_choice: 'auto', prompt: 'assembleSystemPrompt (production, artifacts off) + turn tail', tools: 'eval/agent/component/tool-catalog.json', clock: '2026-09-14T05:00:00Z' },
    sources: { hashes: await hashEvalSources(DIR, SOURCE_FILES) },
    notes: 'FinFrame 种子集。三个评分器用合成数值夹具（与 M1 可比）；Composer 评分（M4）的数据集覆盖度用 snapshot-v1 真实快照，单独计分。不与 eval:agent 三层分数混合。',
    summary: buildSummary(results),
    results,
  }
  return { error: null, record, file: await writeRecord(record, kind) }
}

async function main() {
  const result = await runFinframeEval()
  if (result.error === 'no_llm') {
    console.error(MISSING_LLM_MESSAGE)
    process.exit(2)
  }
  console.log(JSON.stringify(result.record.summary, null, 2))
  console.log(`[eval:finframe] record ${result.file}`)
}

if (isDirectRun(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
