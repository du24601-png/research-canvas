/**
 * M2-E3：研究画布只支持 A 股。找到了但不是 A 股（美股、港股等）时，明确返回 unsupported_market，
 * 让模型照实告诉用户并停下，而不是换名称 / 代码反复重试或改用网页搜索（F1）。
 */
import type { InstrumentRef } from '@opptrix/shared'

const MARKET_LABELS: Record<string, string> = { US: '美股', HK: '港股' }

export interface UnsupportedMarketResult {
  error: string
  status: 'unsupported_market'
  market?: string
  hint: string
}

export function unsupportedMarketResult(keyword: string, market?: string): UnsupportedMarketResult {
  const label = market ? MARKET_LABELS[market.toUpperCase()] ?? '非 A 股市场' : '非 A 股市场'
  return {
    error: `「${keyword}」属于${label}，研究图表目前只支持 A 股上市公司的财务数据`,
    status: 'unsupported_market',
    ...(market ? { market } : {}),
    hint: '照实告诉用户该市场暂不支持，可以改查 A 股公司；不要换名称或代码重试，不要用网页搜索或其他工具拼数据',
  }
}

/** 搜索命中里有非 A 股标的（且没有 A 股）时返回其市场 */
export function nonCnMarketOf(hits: ReadonlyArray<{ market?: string; instrument?: InstrumentRef }>): string | null {
  for (const hit of hits) {
    const market = (hit.instrument?.market ?? hit.market ?? '').toUpperCase()
    if (market && market !== 'CN') return market
  }
  return null
}
