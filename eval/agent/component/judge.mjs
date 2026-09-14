import { matchArgs } from './match-args.mjs'

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseArgs(raw) {
  if (raw == null) return {}
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return isRecord(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return isRecord(raw) ? raw : {}
}

export function normalizeCalls(calls) {
  if (!Array.isArray(calls)) return []
  const out = []
  for (const raw of calls) {
    if (!isRecord(raw)) continue
    if (typeof raw.name === 'string') {
      out.push({ name: raw.name, args: parseArgs(raw.args ?? raw.arguments) })
      continue
    }
    const fn = isRecord(raw.function) ? raw.function : null
    if (fn && typeof fn.name === 'string') {
      out.push({ name: fn.name, args: parseArgs(fn.arguments ?? fn.args) })
    }
  }
  return out
}

function checkMaxCalls(gold, calls) {
  if (typeof gold.max_calls !== 'number') return []
  if (calls.length <= gold.max_calls) return []
  return [`max_calls ${gold.max_calls}，实际 ${calls.length}`]
}

function checkForbidden(gold, calls) {
  const list = Array.isArray(gold.forbidden) ? gold.forbidden : []
  if (list.includes('*')) {
    return calls.length > 0 ? ['禁止任何工具调用'] : []
  }
  const banned = new Set(list)
  return calls.filter((c) => banned.has(c.name)).map((c) => `禁止工具 ${c.name}`)
}

function checkExpected(gold, calls) {
  const reasons = []
  for (const spec of gold.expected ?? []) {
    if (spec.required === false) continue
    const named = calls.filter((c) => c.name === spec.name)
    if (named.length === 0) {
      reasons.push(`缺少工具 ${spec.name}`)
      continue
    }
    const hit = named.some((c) => matchArgs(spec.args, c.args).length === 0)
    if (!hit) {
      const detail = matchArgs(spec.args, named[0].args).join('；')
      reasons.push(`工具 ${spec.name} 参数不匹配：${detail}`)
    }
  }
  return reasons
}

export function judgeComponentCase(evalCase, trace) {
  const gold = evalCase?.gold ?? {}
  const calls = normalizeCalls(trace?.calls)
  const reasons = [...checkMaxCalls(gold, calls), ...checkForbidden(gold, calls)]
  if (gold.call_policy === 'must_not_call') {
    if (calls.length > 0 && !gold.forbidden?.includes('*')) {
      reasons.push('must_not_call：出现工具调用')
    }
  } else {
    reasons.push(...checkExpected(gold, calls))
  }
  return {
    caseId: typeof evalCase?.id === 'string' ? evalCase.id : '',
    pass: reasons.length === 0,
    reasons,
    stats: { calls: calls.length },
  }
}
