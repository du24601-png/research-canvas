import { normalizeCalls } from '../component/judge.mjs'
import { isRejectText } from './fixture-data.mjs'
import { initFixtureState, stubTool } from './fixtures.mjs'
import { formatPlanningContext, PLANNING_SYSTEM_PROMPT } from './prompt.mjs'

const DEFAULT_MAX_ROUNDS = 8

export function buildPlanningMessages(evalCase, opts = {}) {
  if (typeof opts.buildMessages === 'function') return opts.buildMessages(evalCase)
  const task = String(evalCase?.task ?? evalCase?.question ?? '')
  const ctx = formatPlanningContext(evalCase?.context)
  const user = ctx ? `${ctx}\n\n${task}` : task
  return [
    { role: 'system', content: PLANNING_SYSTEM_PROMPT },
    { role: 'user', content: user },
  ]
}

function toOpenAiCall(raw, index) {
  if (raw?.function?.name) {
    return { ...raw, id: raw.id || `call_${index + 1}`, type: raw.type || 'function' }
  }
  return {
    id: raw?.id || `call_${index + 1}`,
    type: 'function',
    function: { name: raw?.name ?? '', arguments: JSON.stringify(raw?.args ?? {}) },
  }
}

export function matchingIdleScript(evalCase, state) {
  const item = (evalCase?.user_script ?? [])[state.scriptIndex]
  if (!item) return null
  if (item.when === 'plan_preview' && state.lastStatus === 'plan_preview') return item
  if (item.when === 'tool_idle') {
    if (!item.tool) return item
    if (item.tool === state.lastTool) return item
    if (state.calledTools?.has?.(item.tool)) return item
  }
  return null
}

function injectIdleUser(evalCase, state, messages, message) {
  const script = matchingIdleScript(evalCase, state)
  if (!script) return false
  messages.push({ role: 'assistant', content: message?.content || '' })
  messages.push({ role: 'user', content: script.content })
  state.scriptIndex += 1
  if (script.when === 'plan_preview' && !isRejectText(script.content)) state.userConfirm = true
  state.lastStatus = 'user_injected'
  return true
}

function applyRoundCalls(turn, evalCase, state, messages, calls) {
  const rawCalls = Array.isArray(turn?.calls) ? turn.calls : []
  const openai = rawCalls.map((raw, i) => toOpenAiCall(raw, i))
  messages.push({
    role: 'assistant',
    content: turn?.message?.content ?? null,
    tool_calls: openai,
  })
  for (const raw of openai) {
    const call = normalizeCalls([raw])[0]
    if (!call) continue
    calls.push(call)
    const body = stubTool(call, evalCase, state)
    state.lastTool = call.name
    state.calledTools?.add?.(call.name)
    if (call.name === 'ask_user' && body.selected_ids?.[0] === 'confirm') {
      state.userConfirm = true
    }
    messages.push({ role: 'tool', tool_call_id: raw.id, content: JSON.stringify(body) })
  }
}

export async function runPlanningCase(opts) {
  const evalCase = opts.evalCase
  const messages = opts.messages ?? buildPlanningMessages(evalCase, opts)
  const state = initFixtureState(evalCase)
  const calls = []
  const maxRounds = opts.maxRounds ?? DEFAULT_MAX_ROUNDS
  for (let round = 0; round < maxRounds; round += 1) {
    const turn = await opts.complete({ messages, tools: opts.tools, evalCase })
    const rawCalls = Array.isArray(turn?.calls) ? turn.calls : []
    if (!rawCalls.length) {
      if (!injectIdleUser(evalCase, state, messages, turn?.message)) break
      continue
    }
    applyRoundCalls(turn, evalCase, state, messages, calls)
  }
  return { calls, messages, events: { user_confirm: state.userConfirm === true } }
}
