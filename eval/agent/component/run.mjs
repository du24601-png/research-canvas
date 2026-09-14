#!/usr/bin/env node
/**
 * Agent 组件评测单轮 runner。不执行工具、不打 Tushare。
 * 正式全量：node eval/agent/component/run.mjs
 * 冒烟：EVAL_LIMIT=3 node eval/agent/component/run.mjs
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EVAL_SYSTEM_PROMPT } from './prompt.mjs'
import { completeOpenAiRound, resolveLlmFromEnv } from './llm-client.mjs'
import { resolveLlmFromUserStore } from './load-llm-config.mjs'
import { loadEvalCases, listEvalSourceFiles, SKIP_CASE_IDS } from './load-cases.mjs'
import { runComponentSuite } from './run-suite.mjs'
import { buildEvalRecord } from './archive-record.mjs'
import { hashEvalSources, readGitMeta } from './archive-meta.mjs'
import { writeEvalArchive } from './archive-write.mjs'
import { finishEvalCli, isDirectRun, limitCaseIds } from '../eval-cli.mjs'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(DIR, '../../..')

export async function runComponentEval(opts = {}) {
  const llm = opts.llm ?? resolveLlmFromEnv() ?? await resolveLlmFromUserStore()
  if (!llm) return { error: 'no_llm' }
  const available = await loadEvalCases()
  const limit = opts.limit ?? Number(process.env.EVAL_LIMIT || 0)
  const caseIds = opts.caseIds ?? limitCaseIds(available, limit)
  const kind = caseIds ? 'smoke' : 'official'
  const started = Date.now()
  const prefix = opts.logPrefix ?? 'eval'
  if (opts.quiet !== true) {
    console.error(`[${prefix}] kind=${kind} model=${llm.model} cases=${caseIds?.length ?? available.length}`)
  }
  const report = await runComponentSuite({
    caseIds,
    complete: ({ messages, tools }) => completeOpenAiRound({
      apiKey: llm.apiKey,
      baseUrl: llm.baseUrl,
      model: llm.model,
      messages,
      tools,
    }),
  })
  const record = buildEvalRecord({
    kind,
    datasetId: 'agent-component-tushare-v1',
    at: opts.at ?? new Date().toISOString(),
    durationMs: Date.now() - started,
    git: opts.git ?? readGitMeta(REPO),
    hashes: await hashEvalSources(DIR, await listEvalSourceFiles()),
    llm,
    prompt: EVAL_SYSTEM_PROMPT,
    skip: SKIP_CASE_IDS,
    report,
  })
  const written = await writeEvalArchive(record, {
    scratchDir: opts.scratchDir ?? path.join(DIR, 'runs'),
    recordsDir: opts.recordsDir ?? path.join(DIR, '../records'),
  })
  return { error: null, record, written, report }
}

async function main() {
  finishEvalCli(await runComponentEval(), 'eval')
}

if (isDirectRun(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
