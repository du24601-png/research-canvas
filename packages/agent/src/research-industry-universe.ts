import type { InstrumentRef } from '@opptrix/shared'
import {
  RESEARCH_DATASET_ENTITY_LIMIT,
} from '@opptrix/shared'
import { searchHitsFromHubData } from './research-entity-resolver.js'
import type { ResearchDataHub } from './research-query-data.js'

export const INDUSTRY_UNIVERSE_DEFAULT_N = 8
export const INDUSTRY_UNIVERSE_EXPAND_N = RESEARCH_DATASET_ENTITY_LIMIT
export const INDUSTRY_UNIVERSE_CANDIDATE_CAP = 40

export interface IndustryUniverseCandidate {
  name: string
  symbol: string
  entity: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function tickerOf(ref: InstrumentRef): string {
  const ex = ref.exchange?.toUpperCase()
  return ex ? `${ref.symbol}.${ex}` : ref.symbol
}

function isCnEquityRef(ref: InstrumentRef | null | undefined): ref is InstrumentRef {
  return Boolean(ref && ref.market === 'CN' && (ref.assetClass ?? 'EQUITY') === 'EQUITY')
}

function parseIndustry(raw: unknown): string | { error: string } {
  if (typeof raw !== 'string' || !raw.trim()) return { error: 'industry 须为行业或主题名称' }
  const industry = raw.trim()
  if (industry.length > 40) return { error: 'industry 不超过 40 字' }
  return industry
}

function candidateFromRef(ref: InstrumentRef, name: string): IndustryUniverseCandidate {
  const symbol = tickerOf(ref)
  const label = name.trim() || ref.symbol
  return { name: label, symbol, entity: label }
}

function candidateFromListRow(row: unknown): IndustryUniverseCandidate | null {
  if (!isRecord(row)) return null
  const asset = String(row.assetClass ?? row.asset_class ?? 'EQUITY').toUpperCase()
  if (asset && asset !== 'EQUITY') return null
  const region = String(row.region ?? '').toUpperCase()
  const market = String(row.market ?? '').toUpperCase()
  if (region && region !== 'CN') return null
  if (!region && market && !['CN', 'SH', 'SZ', 'BJ'].includes(market)) return null
  const name = typeof row.name === 'string' ? row.name.trim() : ''
  const code = typeof row.code === 'string' ? row.code.trim() : ''
  const symbol = typeof row.symbol === 'string' ? row.symbol.trim() : code
  if (!symbol) return null
  const label = name || symbol
  return { name: label, symbol, entity: label }
}

function dedupeCandidates(
  rows: IndustryUniverseCandidate[],
): IndustryUniverseCandidate[] {
  const seen = new Set<string>()
  const out: IndustryUniverseCandidate[] = []
  for (const row of rows) {
    const key = row.symbol.replace(/\.(SH|SZ|BJ)$/i, '')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
    if (out.length >= INDUSTRY_UNIVERSE_CANDIDATE_CAP) break
  }
  return out
}

function candidatesFromSearch(data: unknown): IndustryUniverseCandidate[] {
  const out: IndustryUniverseCandidate[] = []
  for (const hit of searchHitsFromHubData(data)) {
    const ref = hit.instrument
    if (!isCnEquityRef(ref)) continue
    const name = (hit.name ?? '').trim() || tickerOf(ref)
    out.push(candidateFromRef(ref, name))
  }
  return dedupeCandidates(out)
}

function candidatesFromConstituents(data: unknown): IndustryUniverseCandidate[] {
  if (!isRecord(data) || !Array.isArray(data.items)) return []
  const out: IndustryUniverseCandidate[] = []
  for (const item of data.items) {
    const row = candidateFromListRow(item)
    if (row) out.push(row)
  }
  return dedupeCandidates(out)
}

function okUniverse(
  industry: string,
  source: 'constituents' | 'keyword_search',
  candidates: IndustryUniverseCandidate[],
): Record<string, unknown> {
  const defaultEntities = candidates
    .slice(0, INDUSTRY_UNIVERSE_DEFAULT_N)
    .map(row => row.entity)
  return {
    ok: true,
    industry,
    source,
    complete: false,
    candidates,
    default_n: INDUSTRY_UNIVERSE_DEFAULT_N,
    expand_n: INDUSTRY_UNIVERSE_EXPAND_N,
    default_entities: defaultEntities,
    ask_user_prompt: `请确认要纳入对比的公司。已预选 ${defaultEntities.length} 家，这不是完整行业名单。若要看更全，最多勾选 ${INDUSTRY_UNIVERSE_EXPAND_N} 家。`,
    ask_user_options: candidates.map(row => ({
      id: row.symbol,
      label: `${row.name} ${row.symbol}`,
    })),
    next: '先 ask_user（allow_multiple）确认公司，默认勾选 default_entities；确认后再 query_data。标题用「已确认的 N 家 + 指标 + 年份」，禁止写「行业排名」。禁止把未确认名单当作行业全集。',
  }
}

async function loadConstituents(
  hub: ResearchDataHub,
  args: Record<string, unknown>,
): Promise<IndustryUniverseCandidate[]> {
  const boardKey = typeof args.board_key === 'string' ? args.board_key.trim() : ''
  const industryCode = typeof args.industry_code === 'string' ? args.industry_code.trim() : ''
  if (!boardKey && !industryCode) return []
  const result = await hub.dispatch('sector_constituents', {
    market: 'CN',
    board_key: boardKey || undefined,
    industry_code: industryCode || undefined,
    page: 1,
    page_size: INDUSTRY_UNIVERSE_CANDIDATE_CAP,
  })
  if (!result.success) return []
  return candidatesFromConstituents(result.data)
}

async function loadKeywordHits(
  hub: ResearchDataHub,
  industry: string,
): Promise<IndustryUniverseCandidate[]> {
  const result = await hub.dispatch('instrument_search', {
    keyword: industry,
    limit: INDUSTRY_UNIVERSE_CANDIDATE_CAP,
    markets: ['CN'],
  })
  if (!result.success) return []
  return candidatesFromSearch(result.data)
}

export async function executeResolveIndustryUniverse(
  hub: ResearchDataHub,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const industry = parseIndustry(args.industry)
  if (typeof industry !== 'string') return industry
  const fromBoard = await loadConstituents(hub, args)
  if (fromBoard.length) return okUniverse(industry, 'constituents', fromBoard)
  const fromSearch = await loadKeywordHits(hub, industry)
  if (fromSearch.length) return okUniverse(industry, 'keyword_search', fromSearch)
  return { error: `未能解析「${industry}」的上市公司，请改用公司名称或提供板块代码` }
}
