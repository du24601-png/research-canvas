import type {
  InstrumentRef,
  ResearchResult,
  UnifiedInstrumentQuote,
} from '@opptrix/shared'
import { instrumentRefKey } from '@opptrix/shared'

export type MarketDynamicsCacheMarket = 'cn' | 'hk' | 'us'

export type MarketDynamicsCacheEntry = {
  cached_at: string
  cached_at_ms: number
  message: string
  data: Record<string, unknown>
}

export type RightPanelCacheEnvelope<T> = {
  cached_at: string
  cached_at_ms: number
  message: string
  data: T
}

/** Persistence port. Storage implements this; Hub never imports SQLite. */
export type HubDiskCache = {
  readMarketDynamicsCache(market: MarketDynamicsCacheMarket): MarketDynamicsCacheEntry | null
  writeMarketDynamicsCache(market: MarketDynamicsCacheMarket, result: ResearchResult): void
  readPortfolioSummaryCache(): RightPanelCacheEnvelope<Record<string, unknown>> | null
  writePortfolioSummaryCache(result: ResearchResult): void
  readInstrumentQuotesCache(refs: InstrumentRef[]): {
    quotes: UnifiedInstrumentQuote[]
    newestMs: number
  }
  writeInstrumentQuotesFromResult(result: ResearchResult): void
}

export function normalizeMarketDynamicsMarket(raw: unknown): MarketDynamicsCacheMarket {
  const market = String(raw ?? 'cn').trim().toLowerCase()
  if (market === 'hk' || market === 'us') return market
  return 'cn'
}

export function instrumentQuotesInflightKey(refs: InstrumentRef[]): string {
  return refs.map(r => instrumentRefKey(r)).sort().join('|')
}

export function createNoopHubDiskCache(): HubDiskCache {
  return {
    readMarketDynamicsCache: () => null,
    writeMarketDynamicsCache: () => {},
    readPortfolioSummaryCache: () => null,
    writePortfolioSummaryCache: () => {},
    readInstrumentQuotesCache: () => ({ quotes: [], newestMs: 0 }),
    writeInstrumentQuotesFromResult: () => {},
  }
}
