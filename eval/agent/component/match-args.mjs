function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function norm(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function tokenHit(value, alias) {
  const a = norm(alias)
  const b = norm(value)
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

export function collectSymbols(args) {
  if (!isRecord(args)) return []
  const out = []
  const push = (v) => {
    if (v == null || v === '') return
    if (Array.isArray(v)) {
      for (const item of v) push(item)
      return
    }
    if (isRecord(v)) {
      push(v.code)
      push(v.symbol)
      push(v.name)
      return
    }
    out.push(String(v))
  }
  push(args.code)
  push(args.symbol)
  push(args.keyword)
  push(args.instrument)
  push(args.instruments)
  push(args.entities)
  push(args.codes)
  return out
}

function matchCovers(groups, actual) {
  const entities = Array.isArray(actual) ? actual.map(String) : []
  if (!Array.isArray(groups)) return 'covers 不是数组'
  for (const group of groups) {
    const aliases = isRecord(group) && Array.isArray(group.any) ? group.any : []
    const hit = aliases.some((alias) => entities.some((ent) => tokenHit(ent, alias)))
    if (!hit) return `covers 未覆盖 ${aliases.join('/')}`
  }
  return null
}

function matchScalar(spec, actual) {
  if ('eq' in spec) {
    if (typeof spec.eq === 'boolean') {
      return actual === spec.eq || String(actual) === String(spec.eq) ? null : `期望 ${spec.eq}`
    }
    return String(actual ?? '') === String(spec.eq) ? null : `期望 ${spec.eq}，实际 ${actual}`
  }
  if ('in' in spec) {
    const ok = Array.isArray(spec.in) && spec.in.map(String).includes(String(actual ?? ''))
    return ok ? null : `期望属于 [${spec.in}]，实际 ${actual}`
  }
  if (spec.absent_or_false === true) {
    return actual === undefined || actual === null || actual === false || actual === 'false'
      ? null
      : `应缺省或为 false，实际 ${actual}`
  }
  if (Array.isArray(spec.contains_any)) {
    const hay = String(actual ?? '')
    return spec.contains_any.some((n) => hay.includes(String(n))) ? null : `未包含 ${spec.contains_any.join('/')}`
  }
  if ('covers' in spec) return matchCovers(spec.covers, actual)
  return null
}

export function matchArgs(expected, actual) {
  if (!isRecord(expected)) return []
  const args = isRecord(actual) ? actual : {}
  const reasons = []
  if (Array.isArray(expected.symbol_any)) {
    const tokens = collectSymbols(args)
    const hit = expected.symbol_any.some((alias) => tokens.some((t) => tokenHit(t, alias)))
    if (!hit) reasons.push(`symbol_any 未命中 ${expected.symbol_any.join('/')}`)
  }
  for (const [key, spec] of Object.entries(expected)) {
    if (key === 'symbol_any') continue
    if (!isRecord(spec)) continue
    const miss = matchScalar(spec, args[key])
    if (miss) reasons.push(`${key}: ${miss}`)
  }
  return reasons
}
