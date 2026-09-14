#!/usr/bin/env node
/**
 * Agent 三层整体测评：component → planning → prompt。
 * 正式：npm run eval:agent
 * 冒烟：EVAL_LIMIT=1 npm run eval:agent
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveLlmFromEnv } from '../component/llm-client.mjs'
import { resolveLlmFromUserStore } from '../component/load-llm-config.mjs'
import { readGitMeta } from '../component/archive-meta.mjs'
import { runComponentEval } from '../component/run.mjs'
import { runPlanningEval } from '../planning/run.mjs'
import { runPromptEval } from '../prompt/run.mjs'
import { emptyBaselines, loadLayerBaselines } from './baseline.mjs'
import { compareAllLayers } from './compare.mjs'
import { buildPipelineRecord } from './archive-record.mjs'
import { writePipelineArchive } from './archive-write.mjs'
import { isDirectRun, MISSING_LLM_MESSAGE, printLayerOutcome } from '../eval-cli.mjs'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(DIR, '../../..')

export function buildAgentDist(repo) {
  const result = spawnSync(
    'npm',
    ['run', 'build', '-w', '@opptrix/shared', '-w', '@opptrix/agent', '-w', '@opptrix/agent-skills'],
    { cwd: repo, encoding: 'utf8', shell: true },
  )
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim()
    throw new Error(detail || `npm build failed with status ${result.status}`)
  }
}

function archiveJsonPath(written) {
  return written.records?.jsonPath ?? written.scratch.jsonPath
}

async function runThreeLayers(shared) {
  const component = await runComponentEval({ ...shared, logPrefix: 'eval:agent/component' })
  if (component.error) return component
  printLayerOutcome('eval:agent/component', component.record, component.written)
  const planning = await runPlanningEval({ ...shared, logPrefix: 'eval:agent/planning' })
  if (planning.error) return planning
  printLayerOutcome('eval:agent/planning', planning.record, planning.written)
  const prompt = await runPromptEval({ ...shared, logPrefix: 'eval:agent/prompt' })
  if (prompt.error) return prompt
  printLayerOutcome('eval:agent/prompt', prompt.record, prompt.written)
  return { error: null, component, planning, prompt }
}

export async function runAgentPipeline(opts = {}) {
  const repo = opts.repo ?? REPO
  const recordsDir = opts.recordsDir ?? path.join(DIR, '../records')
  if (!opts.skipBuild && process.env.EVAL_SKIP_BUILD !== '1') {
    console.error('[eval:agent] building shared/agent dist')
    buildAgentDist(repo)
  }
  const llm = opts.llm ?? resolveLlmFromEnv() ?? await resolveLlmFromUserStore()
  if (!llm) return { error: 'no_llm' }
  const limit = opts.limit ?? Number(process.env.EVAL_LIMIT || 0)
  const git = opts.git ?? readGitMeta(repo)
  const started = Date.now()
  const at = opts.at ?? new Date().toISOString()
  const baselines = limit > 0 ? emptyBaselines() : await loadLayerBaselines(recordsDir)
  const layers = await runThreeLayers({ llm, limit, git, recordsDir })
  if (layers.error) return layers
  const compare = compareAllLayers({
    component: layers.component.record,
    planning: layers.planning.record,
    prompt: layers.prompt.record,
  }, baselines)
  const record = buildPipelineRecord({
    kind: layers.component.record.kind,
    at,
    durationMs: Date.now() - started,
    git,
    llm,
    notes: '三层全量串行；不合成加权总分；不进入 test:gate。',
    layers: {
      component: layers.component.record,
      planning: layers.planning.record,
      prompt: layers.prompt.record,
    },
    layerPaths: {
      component: archiveJsonPath(layers.component.written),
      planning: archiveJsonPath(layers.planning.written),
      prompt: archiveJsonPath(layers.prompt.written),
    },
    compare,
  })
  const written = await writePipelineArchive(record, {
    scratchDir: opts.scratchDir ?? path.join(DIR, 'runs'),
    recordsDir,
  })
  return { error: null, record, written }
}

async function main() {
  const result = await runAgentPipeline()
  if (result.error === 'no_llm') {
    console.error(MISSING_LLM_MESSAGE)
    process.exit(2)
  }
  console.log(`[eval:agent] scratch ${result.written.scratch.mdPath}`)
  if (result.written.records) console.log(`[eval:agent] archive ${result.written.records.mdPath}`)
  process.exit(0)
}

if (isDirectRun(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
