import {
  instrumentRefKey,
  parseCanonicalInstrumentInput,
  type InstrumentRef,
  type ResearchEntity,
} from '@opptrix/shared'
import { nonCnMarketOf, unsupportedMarketResult } from './research-market-support.js'

export interface ResearchSearchHit {
  name: string | null
  market?: string
  assetClass?: string
  asset_class?: string
  instrument?: InstrumentRef
}

export interface ResearchSearchClient {
  search(keyword: string): Promise<ResearchSearchHit[]>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCnEquityRef(ref: InstrumentRef | null | undefined): ref is InstrumentRef {
  return Boolean(ref && ref.market === 'CN' && (ref.assetClass ?? 'EQUITY') === 'EQUITY')
}

function tickerOf(ref: InstrumentRef): string {
  const ex = ref.exchange?.toUpperCase()
  return ex ? `${ref.symbol}.${ex}` : ref.symbol
}

function entityFromRef(ref: InstrumentRef, name: string): ResearchEntity {
  return {
    id: instrumentRefKey(ref),
    name,
    ticker: tickerOf(ref),
    market: 'CN',
    type: 'equity',
  }
}

function normalizeName(value: string): string {
  return value.replace(/股份有限公司|有限公司|集团/g, '').trim()
}

function cnEquityHits(hits: ResearchSearchHit[]): Array<{ ref: InstrumentRef; name: string }> {
  const seen = new Set<string>()
  const out: Array<{ ref: InstrumentRef; name: string }> = []
  for (const hit of hits) {
    const ref = hit.instrument
    if (!isCnEquityRef(ref)) continue
    const key = instrumentRefKey(ref)
    if (seen.has(key)) continue
    seen.add(key)
    const name = (hit.name ?? '').trim() || tickerOf(ref)
    out.push({ ref, name })
  }
  return out
}

export interface AmbiguousEntityResult {
  error: string
  status: 'ambiguous_entity'
  candidates: Array<{ name: string; ticker: string }>
  hint: string
}

function ambiguousEntityResult(
  needle: string,
  candidates: Array<{ ref: InstrumentRef; name: string }>,
): AmbiguousEntityResult {
  const list = candidates.map(row => `${row.name}（${row.ref.symbol}）`).join('、')
  return {
    error: `「${needle}」对应多家公司：${list}。请先问用户指哪一家，不要自行选择。`,
    status: 'ambiguous_entity',
    candidates: candidates.map(row => ({ name: row.name, ticker: row.ref.symbol })),
    hint: '把候选公司列给用户，请用户回复全称或股票代码后再查询；不要替用户选择，不要用其他工具拼数据',
  }
}

export function pickCnEquityHit(
  keyword: string,
  hits: ResearchSearchHit[],
): { entity: ResearchEntity } | { error: string } | AmbiguousEntityResult {
  const needle = keyword.trim()
  const rows = cnEquityHits(hits)
  const foreign = rows.length ? null : nonCnMarketOf(hits)
  if (foreign) return unsupportedMarketResult(needle, foreign)
  if (!rows.length) return { error: `无法确认「${needle}」对应的上市公司` }
  const needleNorm = normalizeName(needle)
  const exact = rows.filter(row => row.name === needle || normalizeName(row.name) === needleNorm)
  if (exact.length === 1) return { entity: entityFromRef(exact[0].ref, exact[0].name) }
  const matches = rows.filter(row => row.name.includes(needle) || normalizeName(row.name).includes(needleNorm))
  if (matches.length >= 2) return ambiguousEntityResult(needle, matches)
  if (matches.length === 1) return { entity: entityFromRef(matches[0].ref, matches[0].name) }
  const prefixed = rows.filter(row => (
    row.name.startsWith(needle) || normalizeName(row.name).startsWith(needleNorm)
  ))
  const shortAlias = rows.filter(row => {
    const nameNorm = normalizeName(row.name)
    return nameNorm.length >= 2 && (needle.startsWith(row.name) || needleNorm.startsWith(nameNorm))
  })
  const unique = exact.length === 1
    ? exact[0]
    : prefixed.length === 1
      ? prefixed[0]
      : shortAlias.length === 1
        ? shortAlias[0]
        : rows.length === 1 ? rows[0] : null
  if (!unique) return { error: `「${needle}」对应多家公司，请改用全称或股票代码` }
  return { entity: entityFromRef(unique.ref, unique.name) }
}

export function parseCnEquityKeyword(raw: string): InstrumentRef | null {
  const parsed = parseCanonicalInstrumentInput(raw.trim())
  if (!isCnEquityRef(parsed)) return null
  return parsed
}

export async function resolveResearchEntity(
  raw: string,
  search: ResearchSearchClient,
): Promise<{ entity: ResearchEntity } | { error: string }> {
  const keyword = raw.trim()
  if (!keyword) return { error: '公司名称或代码不能为空' }
  const parsed = parseCnEquityKeyword(keyword)
  if (parsed) {
    try {
      const hits = await search.search(parsed.symbol)
      const picked = pickCnEquityHit(keyword, hits)
      if ('entity' in picked) return picked
    } catch {
      /* name enrichment is optional for explicit codes */
    }
    return { entity: entityFromRef(parsed, keyword) }
  }
  const foreignRef = parseCanonicalInstrumentInput(keyword)
  if (foreignRef && foreignRef.market !== 'CN') return unsupportedMarketResult(keyword, foreignRef.market)
  let hits: ResearchSearchHit[] = []
  try {
    hits = await search.search(keyword)
  } catch {
    return { error: `无法确认「${keyword}」对应的上市公司` }
  }
  return pickCnEquityHit(keyword, hits)
}

export function searchHitsFromHubData(data: unknown): ResearchSearchHit[] {
  if (!isRecord(data) || !Array.isArray(data.items)) return []
  return data.items.filter(isRecord) as unknown as ResearchSearchHit[]
}
