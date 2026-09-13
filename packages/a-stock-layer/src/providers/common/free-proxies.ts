import type { GlobalIndex } from '../../core/schema.js'
import { normalizeCode } from '../../utils/helpers.js'

/** 全球指数别名 → TickFlow 可查询的 ETF/指数代码 */
export const GLOBAL_INDEX_TICKFLOW: Record<string, { symbol: string; name: string; market: string; outCode: string }> = {
  dji: { symbol: 'DIA.US', name: '道琼斯', market: 'US', outCode: 'DJI' },
  djia: { symbol: 'DIA.US', name: '道琼斯', market: 'US', outCode: 'DJI' },
  dow: { symbol: 'DIA.US', name: '道琼斯', market: 'US', outCode: 'DJI' },
  spx: { symbol: 'SPY.US', name: '标普500', market: 'US', outCode: 'SPX' },
  spy: { symbol: 'SPY.US', name: '标普500', market: 'US', outCode: 'SPX' },
  ixic: { symbol: 'QQQ.US', name: '纳斯达克', market: 'US', outCode: 'IXIC' },
  nasdaq: { symbol: 'QQQ.US', name: '纳斯达克', market: 'US', outCode: 'IXIC' },
  qqq: { symbol: 'QQQ.US', name: '纳斯达克', market: 'US', outCode: 'IXIC' },
  hsi: { symbol: '2800.HK', name: '恒生指数', market: 'HK', outCode: 'HSI' },
  n225: { symbol: '1321.T', name: '日经225', market: 'JP', outCode: 'N225' },
  nikkei: { symbol: '1321.T', name: '日经225', market: 'JP', outCode: 'N225' },
}

/** A 股指数代码也可通过 indexRealtime 查询 */
export const GLOBAL_INDEX_CN: Record<string, { indexCode: string; name: string }> = {
  '000001': { indexCode: '000001', name: '上证指数' },
  '399001': { indexCode: '399001', name: '深证成指' },
  '399006': { indexCode: '399006', name: '创业板指' },
  '000300': { indexCode: '000300', name: '沪深300' },
}

export function resolveGlobalIndexAlias(code = ''): {
  kind: 'cn' | 'tickflow' | 'all'
  cn?: { indexCode: string; name: string; outCode: string }
  tickflow?: (typeof GLOBAL_INDEX_TICKFLOW)[string]
} {
  const raw = code.trim().toLowerCase()
  if (!raw) return { kind: 'all' }
  const cn = GLOBAL_INDEX_CN[normalizeCode(code)] ?? GLOBAL_INDEX_CN[normalizeCode(raw)]
  if (cn) return { kind: 'cn', cn: { ...cn, outCode: normalizeCode(cn.indexCode) } }
  const tf = GLOBAL_INDEX_TICKFLOW[raw]
  if (tf) return { kind: 'tickflow', tickflow: tf }
  return { kind: 'all' }
}

export function mapQuoteToGlobalIndex(
  outCode: string,
  name: string,
  market: string,
  quote: { price?: number | null; changePct?: number | null; name?: string },
): GlobalIndex {
  return {
    code: outCode,
    name: quote.name || name,
    price: quote.price ?? null,
    changePct: quote.changePct ?? null,
    market,
    timestamp: new Date().toISOString(),
  }
}
