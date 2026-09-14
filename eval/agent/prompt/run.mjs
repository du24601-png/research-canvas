#!/usr/bin/env node
/**
 * Agent 生产提示词评测：同一套规划题，换成 assembleSystemPrompt + 本轮尾注。
 * 正式：node eval/agent/prompt/run.mjs
 * 冒烟：EVAL_LIMIT=3 node eval/agent/prompt/run.mjs
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { completePlanningRound } from '../planning/llm-round.mjs'
import { resolveLlmFromEnv } from '../component/llm-client.mjs'
import { resolveLlmFromUserStore } from '../component/load-llm-config.mjs'
import { loadPlanningCases, listPlanningSourceFiles, SKIP_CASE_IDS } from '../planning/load-cases.mjs'
import { runPlanningSuite } from '../planning/run-suite.mjs'
import { buildPlanningRecord } from '../planning/archive-record.mjs'
import { hashEvalSources, readGitMeta } from '../component/archive-meta.mjs'
import { writePlanningArchive } from '../planning/archive-write.mjs'
import { assembleProductSystemPrompt, buildProductPlanningMessages } from './assemble.mjs'
import { finishEvalCli, isDirectRun, limitCaseIds } from '../eval-cli.mjs'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const PLANNING_DIR = path.resolve(DIR, '../planning')
const REPO = path.resolve(DIR, '../../..')

async function hashPromptSources() {
  const planning = await hashEvalSources(PLANNING_DIR, await listPlanningSourceFiles())
  const local = await hashEvalSources(DIR, ['assemble.mjs', 'run.mjs'])
  return { ...planning, ...Object.fromEntries(Object.entries(local).map(([k, v]) => [`prompt/${k}`, v])) }
}

export async function runPromptEval(opts = {}) {
  const llm = opts.llm ?? resolveLlmFromEnv() ?? await resolveLlmFromUserStore()
  if (!llm) return { error: 'no_llm' }
  const available = await loadPlanningCases()
  const limit = opts.limit ?? Number(process.env.EVAL_LIMIT || 0)
  const caseIds = opts.caseIds ?? limitCaseIds(available, limit)
  const kind = caseIds ? 'smoke' : 'official'
  const started = Date.now()
  const prompt = assembleProductSystemPrompt()
  const prefix = opts.logPrefix ?? 'eval:prompt'
  if (opts.quiet !== true) {
    console.error(`[${prefix}] kind=${kind} model=${llm.model} cases=${caseIds?.length ?? available.length}`)
  }
  const report = await runPlanningSuite({
    caseIds,
    buildMessages: buildProductPlanningMessages,
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
    layer: 'prompt',
    focus: 'system_prompt.assembleSystemPrompt',
    datasetId: 'agent-planning-canvas-v1',
    at: opts.at ?? new Date().toISOString(),
    durationMs: Date.now() - started,
    git: opts.git ?? readGitMeta(REPO),
    hashes: await hashPromptSources(),
    llm,
    prompt,
    skip: SKIP_CASE_IDS,
    notes: '生产 assembleSystemPrompt（默认研究助手，artifacts 关闭，无外部 MCP 附录）；尾注含冻结时钟、选型卡、L2 档位、画布元数据。工具清单仍为评测冻结 catalog。',
    report,
  })
  const written = await writePlanningArchive(record, {
    scratchDir: opts.scratchDir ?? path.join(DIR, 'runs'),
    recordsDir: opts.recordsDir ?? path.join(DIR, '../records'),
  })
  return { error: null, record, written, report }
}

async function main() {
  finishEvalCli(await runPromptEval(), 'eval:prompt')
}

if (isDirectRun(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
