import { matchArgs } from '../component/match-args.mjs'

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function flattenCallArgs(args) {
  const src = isRecord(args) ? args : {}
  const out = { ...src }
  if (!isRecord(src.operation)) return out
  if (src.operation.type != null) out.operation_type = src.operation.type
  if (src.operation.entities) out.entities = src.operation.entities
  if (src.operation.start != null) out.start = src.operation.start
  if (src.operation.end != null) out.end = src.operation.end
  return out
}

export function stepMatches(spec, call) {
  if (!spec?.name || spec.name !== call?.name) return false
  if (!isRecord(spec.args)) return true
  return matchArgs(spec.args, flattenCallArgs(call.args)).length === 0
}

export function checkMaxDecisions(gold, calls) {
  const cap = gold?.max_decisions
  if (typeof cap !== 'number') return []
  if (calls.length <= cap) return []
  return [`max_decisions ${cap}，实际 ${calls.length}`]
}

export function matchChain(chain, calls) {
  const required = Array.isArray(chain) ? chain : []
  let cursor = 0
  let matched = 0
  for (const call of calls) {
    const spec = required[cursor]
    if (!spec) break
    if (stepMatches(spec, call)) {
      matched += 1
      cursor += 1
    }
  }
  const missing = required.slice(cursor).map((s) => `缺少步骤 ${s.name}`)
  return { matched, reasons: missing }
}
