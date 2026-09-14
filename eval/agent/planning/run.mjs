#!/usr/bin/env node
/**
 * Agent 规划评测：夹具多轮决策链。不打 Tushare。
 * 正式：node eval/agent/planning/run.mjs
 * 冒烟：EVAL_LIMIT=3 node eval/agent/planning/run.mjs
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PLANNING_SYSTEM_PROMPT } from './prompt.mjs'
import { completePlanningRound } from './llm-round.mjs'
import { resolveLlmFromEnv } from '../component/llm-client.mjs'
import { resolveLlmFromUserStore } from '../component/load-llm-config.mjs'
import { loadPlanningCases, listPlanningSourceFiles, SKIP_CASE_IDS } from './load-cases.mjs'
import { runPlanningSuite } from './run-suite.mjs'
import { buildPlanningRecord } from './archive-record.mjs'
import { hashEvalSources, readGitMeta } from '../component/archive-meta.mjs'
import { writePlanningArchive } from './archive-write.mjs'
import { finishEvalCli, isDirectRun, limitCaseIds } from '../eval-cli.mjs'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(DIR, '../../..')

export async function runPlanningEval(opts = {}) {
  const llm = opts.llm ?? resolveLlmFromEnv() ?? await resolveLlmFromUserStore()
  if (!llm) return { error: 'no_llm' }
  const available = await loadPlanningCases()
  const limit = opts.limit ?? Number(process.env.EVAL_LIMIT || 0)
  const caseIds = opts.caseIds ?? limitCaseIds(available, limit)
  const kind = caseIds ? 'smoke' : 'official'
  const started = Date.now()
  const prefix = opts.logPrefix ?? 'eval:planning'
  if (opts.quiet !== true) {
    console.error(`[${prefix}] kind=${kind} model=${llm.model} cases=${caseIds?.length ?? available.length}`)
  }
  const report = await runPlanningSuite({
    caseIds,
    complete: ({ messages, tools }) => completePlanningRound({
      apiKey: llm.apiKey,
      baseUrl: llm.baseUrl,
      model: llm.model,
      messages,
      tools,
    }),
  })
  const record = buildPlanningRecord({
    kind,
    datasetId: 'agent-planning-canvas-v1',
    at: opts.at ?? new Date().toISOString(),
    durationMs: Date.now() - started,
    git: opts.git ?? readGitMeta(REPO),
    hashes: await hashEvalSources(DIR, await listPlanningSourceFiles()),
    llm,
    prompt: PLANNING_SYSTEM_PROMPT,
    skip: SKIP_CASE_IDS,
    report,
  })
  const written = await writePlanningArchive(record, {
    scratchDir: opts.scratchDir ?? path.join(DIR, 'runs'),
    recordsDir: opts.recordsDir ?? path.join(DIR, '../records'),
  })
  return { error: null, record, written, report }
}

async function main() {
  finishEvalCli(await runPlanningEval(), 'eval:planning')
}

if (isDirectRun(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
