import type { StockListItem } from '@opptrix/shared'
import { Capability } from '../../core/capabilities.js'
import { MarketHandlerShell } from '../common/driver-factory.js'
import { opptrixFxRmbLatest, opptrixInstrumentSearch } from './api/client.js'
import {
  opptrixInstrumentToStockIndexItem,
  stockIndexItemsToListRows,
} from './normalize.js'

/** OpptrixQuant 支持的市场（含 SG，超集应用内 Market） */
const OPPTRIX_MARKETS = new Set(['CN', 'US', 'HK', 'JP', 'KR', 'SG'])

function opptrixMarket(raw: string | undefined): string {
  const m = String(raw ?? '').trim().toUpperCase()
  return OPPTRIX_MARKETS.has(m) ? m : 'CN'
}

/** OpptrixQuant class_token → 搜索过滤参数 */
function classTokenForAssetType(assetType?: string): string | undefined {
  const at = String(assetType ?? '').trim().toLowerCase()
  if (at === 'stock' || at === 'equity') return 'stock'
  if (at === 'ind' || at === 'index') return 'ind'
  if (at === 'otc' || at === 'of' || at === 'fund') return 'otc'
  if (at === 'etf') return 'etf'
  if (at === 'lof') return 'lof'
  if (at === 'reit') return 'reit'
  return undefined
}

function toRows(raw: Awaited<ReturnType<typeof opptrixInstrumentSearch>>): StockListItem[] | null {
  if (!raw) return null
  const rows = stockIndexItemsToListRows(raw.map(opptrixInstrumentToStockIndexItem))
  return rows.length ? rows : null
}

/** 标准汇率行 — CAP_METHOD[EXCHANGE_RATE] 反射到 driver.exchangeRate */
function toFxRows(
  raw: Awaited<ReturnType<typeof opptrixFxRmbLatest>>,
): Record<string, unknown>[] | null {
  if (!raw?.rates?.length) return null
  const rows = raw.rates.map(rate => ({
    trade_date: rate.trade_date ?? raw.trade_date,
    pair: rate.pair
      ?? (rate.base && rate.quote ? `${rate.base}/${rate.quote}` : (rate.currency ?? '')),
    base: rate.base,
    quote: rate.quote,
    currency: rate.currency,
    nameZh: rate.name_zh,
    rate: rate.rate,
    unit: rate.unit ?? raw.unit,
    source: rate.source ?? raw.source,
  }))
  return rows.length ? rows : null
}

export class StockIndexHandler extends MarketHandlerShell {
  readonly selfThrottled = true

  /** 标准 instrument_search — 跨市场关键词搜索 */
  async instrumentSearch(
    query: string,
    market = 'CN',
    limit = 20,
    _board?: string,
    _industry?: string,
    assetType?: string,
  ): Promise<StockListItem[] | null> {
    try {
      return toRows(
        await opptrixInstrumentSearch(query, {
          market: opptrixMarket(market),
          classToken: classTokenForAssetType(assetType),
          limit: Math.min(Math.max(limit, 1), 100),
        }),
      )
    } catch {
      return null
    }
  }

  /**
   * 标准汇率 — 人民币中间价（100 单位外币兑人民币）。
   * pair 传币对（如 USD/CNY、USD）过滤；不传返回全量约 25 币种。
   * 上游为日度中间价（自带 24h 数据语义），driver 不再叠加本地缓存。
   */
  async exchangeRate(pair = ''): Promise<Record<string, unknown>[] | null> {
    try {
      const rows = toFxRows(await opptrixFxRmbLatest())
      if (!rows) return null
      const want = pair.trim().toUpperCase()
      if (!want) return rows
      const filtered = rows.filter(row => {
        const rowPair = String(row.pair ?? '').toUpperCase()
        const base = String(row.base ?? '').toUpperCase()
        const quote = String(row.quote ?? '').toUpperCase()
        return rowPair === want
          || rowPair === `${want}/CNY` || rowPair === `${want}/CNH`
          || base === want || quote === want
      })
      return filtered.length ? filtered : null
    } catch {
      return null
    }
  }
}

export const STOCKINDEX_HANDLER_CAPS = [
  Capability.INSTRUMENT_SEARCH,
  Capability.EXCHANGE_RATE,
]
