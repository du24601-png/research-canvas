/**
 * 单题：复用 planning 决策链循环 + 生产 assembleSystemPrompt，换 FinFrame 夹具，
 * 跑完后同时给出原有链路判分（planning judge）与三个 FinFrame 评分器。
 */
import { judgePlanningCase } from '../agent/planning/judge.mjs'
import { runPlanningCase } from '../agent/planning/loop.mjs'
import { buildProductPlanningMessages } from '../agent/prompt/assemble.mjs'
import { buildFixtureDataset, makeFinframeStub } from './fixtures.mjs'
import { resolveFixtureEntity } from './fixture-data.mjs'
import { runScorers } from './scorers/index.mjs'
import { runComposerForCase } from './composer-eval.mjs'

const DEFAULT_MAX_ROUNDS = 8

function years(start, end) {
  const out = []
  for (let y = Number(start); y <= Number(end); y += 1) out.push(String(y))
  return out
}

/** 多轮题的既有画布：按 context.datasets[].seed 生成同 id 的夹具数据集 */
export function seedStore(evalCase) {
  const datasets = new Map()
  for (const d of evalCase?.context?.datasets ?? []) {
    if (!d.seed) continue
    const entities = d.seed.entities.map((n) => resolveFixtureEntity(n).entity).filter(Boolean)
    datasets.set(d.id, buildFixtureDataset(d.id, entities, d.seed.metric, years(d.seed.start, d.seed.end)))
  }
  return { datasets }
}

export function assistantTexts(messages, finalText) {
  const texts = messages
    .filter((m) => m.role === 'assistant' && typeof m.content === 'string' && m.content.trim())
    .map((m) => m.content)
  if (finalText && texts[texts.length - 1] !== finalText) texts.push(finalText)
  return texts
}

function addUsage(total, usage) {
  if (!usage) return
  total.prompt_tokens += usage.prompt_tokens ?? 0
  total.completion_tokens += usage.completion_tokens ?? 0
  total.cache_hit_tokens += usage.prompt_cache_hit_tokens ?? usage.prompt_tokens_details?.cached_tokens ?? 0
  total.rounds += 1
}

async function traceCase(evalCase, opts, store, usage) {
  try {
    const trace = await runPlanningCase({
      evalCase,
      tools: opts.tools,
      maxRounds: evalCase.max_rounds ?? DEFAULT_MAX_ROUNDS,
      buildMessages: buildProductPlanningMessages,
      stubTool: makeFinframeStub(store),
      complete: async (input) => {
        const turn = await opts.complete(input)
        addUsage(usage, turn?.usage)
        return turn
      },
    })
    return { trace, error: null }
  } catch (err) {
    return { trace: { calls: [], messages: [], finalText: '', events: {} }, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function runFinframeCase(evalCase, opts) {
  const started = Date.now()
  const store = seedStore(evalCase)
  const usage = { prompt_tokens: 0, completion_tokens: 0, cache_hit_tokens: 0, rounds: 0 }
  const { trace, error } = await traceCase(evalCase, opts, store, usage)
  const chain = judgePlanningCase(evalCase, trace)
  const datasets = [...store.datasets.values()]
  const texts = assistantTexts(trace.messages ?? [], trace.finalText)
  const scores = runScorers({ evalCase, calls: trace.calls ?? [], texts, datasets })
  const applicable = scores.filter((s) => s.applicable)
  const composer = opts.composerChat ? await runComposerForCase(evalCase, datasets, opts.composerChat).catch(err => ({ error: String(err), score: null })) : null
  return {
    caseId: evalCase.id,
    slice: evalCase.slice,
    expect: evalCase.expect,
    difficulty: evalCase.difficulty,
    question: evalCase.task,
    error,
    chain: { pass: error ? false : chain.pass, reasons: error ? [`runner: ${error}`, ...chain.reasons] : chain.reasons, stats: chain.stats },
    scores,
    pass_all_scorers: !error && applicable.every((s) => s.pass),
    calls: trace.calls ?? [],
    texts,
    datasets: datasets.map((d) => ({ id: d.id, metric: d.metric, entities: d.entities.map((e) => e.name), periods: d.periods, parentDatasetId: d.parentDatasetId ?? null })),
    usage,
    composer,
    duration_ms: Date.now() - started,
  }
}
