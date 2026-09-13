import {
  instrumentRefKey,
  parseCanonicalInstrumentInput,
  type InstrumentRef,
  type ResearchEntity,
} from '@opptrix/shared'

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
  const out: Array<{ ref: InstrumentRef; name: string }> = []
  for (const hit of hits) {
    const ref = hit.instrument
    if (!isCnEquityRef(ref)) continue
    const name = (hit.name ?? '').trim() || tickerOf(ref)
    out.push({ ref, name })
  }
  return out
}

export function pickCnEquityHit(
  keyword: string,
  hits: ResearchSearchHit[],
): { entity: ResearchEntity } | { error: string } {
  const needle = keyword.trim()
  const rows = cnEquityHits(hits)
  if (!rows.length) return { error: `无法确认「${needle}」对应的上市公司` }
  const needleNorm = normalizeName(needle)
  const exact = rows.filter(row => row.name === needle || normalizeName(row.name) === needleNorm)
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
