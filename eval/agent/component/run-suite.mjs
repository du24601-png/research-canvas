import { judgeComponentCase, normalizeCalls } from './judge.mjs'
import { loadEvalCases, SKIP_CASE_IDS } from './load-cases.mjs'
import { buildEvalMessages } from './prompt.mjs'
import { catalogToOpenAiTools } from './tools-openai.mjs'
import { tallyMonitorFromResults } from '../monitor-metrics.mjs'

export { buildEvalMessages } from './prompt.mjs'

function callName(call) {
  if (typeof call?.name === 'string') return call.name
  if (call?.function && typeof call.function.name === 'string') return call.function.name
  return ''
}

function snapshotGold(gold) {
  if (!gold) return null
  return {
    call_policy: gold.call_policy,
    tushare_via: gold.tushare_via,
    expected: gold.expected ?? [],
    forbidden: gold.forbidden ?? [],
    max_calls: gold.max_calls,
  }
}

function skippedRow(evalCase) {
  return {
    caseId: evalCase.id,
    skipped: true,
    pass: null,
    reasons: ['skipped'],
    tool_names: [],
    calls: [],
    stats: { calls: 0 },
    question: evalCase.question ?? '',
    family: evalCase.family,
    split: evalCase.split,
    gold: snapshotGold(evalCase.gold),
  }
}

async function judgeOne(evalCase, complete, tools) {
  let calls = []
  let error = null
  try {
    const turn = await complete({
      evalCase,
      tools,
      messages: buildEvalMessages(evalCase),
    })
    calls = Array.isArray(turn?.calls) ? turn.calls : []
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
  }
  const judged = judgeComponentCase(evalCase, { calls })
  if (error) {
    judged.pass = false
    judged.reasons = [`runner: ${error}`, ...judged.reasons]
  }
  const normalized = normalizeCalls(calls)
  return {
    ...judged,
    skipped: false,
    tool_names: calls.map(callName).filter(Boolean),
    calls: normalized,
    error,
    question: evalCase.question ?? '',
    family: evalCase.family,
    split: evalCase.split,
    gold: snapshotGold(evalCase.gold),
  }
}

export async function runComponentSuite(opts) {
  const skip = new Set(opts.skipIds ?? SKIP_CASE_IDS)
  const all = await loadEvalCases({ skipIds: [] })
  const scoped = opts.caseIds ? all.filter((c) => opts.caseIds.includes(c.id)) : all
  const tools = opts.tools ?? await catalogToOpenAiTools()
  const results = []
  for (const evalCase of scoped) {
    if (skip.has(evalCase.id)) {
      results.push(skippedRow(evalCase))
      continue
    }
    results.push(await judgeOne(evalCase, opts.complete, tools))
  }
  return { ...tallyMonitorFromResults(results), results }
}
