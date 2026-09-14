import { stepMatches } from './match-chain.mjs'

export function checkForbidTool(constraint, calls) {
  const banned = new Set(constraint.tools ?? [])
  const hit = calls.filter((c) => banned.has(c.name))
  if (!hit.length) return []
  return [`${constraint.id}：禁止工具 ${hit.map((c) => c.name).join(', ')}`]
}

export function checkForbidArgs(constraint, calls, events) {
  const hits = []
  for (let i = 0; i < calls.length; i += 1) {
    const call = calls[i]
    if (call.name !== constraint.name) continue
    if (!stepMatches({ name: call.name, args: constraint.args }, call)) continue
    if (constraint.unless_after === 'user_confirm' && events?.user_confirm && i > 0) continue
    hits.push(call)
  }
  if (!hits.length) return []
  return [`${constraint.id}：禁止参数 ${constraint.name}`]
}

export function checkForbidToolUntil(constraint, calls) {
  const until = constraint.until
  const banned = new Set(constraint.tools ?? [])
  let seenUntil = false
  for (const call of calls) {
    if (call.name === until) seenUntil = true
    if (banned.has(call.name) && !seenUntil) {
      return [`${constraint.id}：${call.name} 早于 ${until}`]
    }
  }
  return []
}
