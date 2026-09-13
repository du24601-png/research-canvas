/**
 * Tushare stock_basic 名录 — A 股代码 ↔ 证券简称（含简称前缀 / 唯一包含）。
 */
import { TushareClient, type TushareRow } from './api/client.js'
import { fromTsCode } from './codes.js'
import { isTushareEnabled } from './config.js'

export interface TushareCnNameHit {
  symbol: string
  exchange: 'SH' | 'SZ' | 'BJ'
  name: string
  keys: string[]
}

const DIRECTORY_TTL_MS = 12 * 60 * 60 * 1000
const GENERIC_NAME = /^(股份|集团|科技|银行|中国|国际|控股|有限|公司|A股)$/
const SUFFIX_RE = /股份有限公司|有限公司|集团股份|集团|股份/g

let directoryCache: { expires: number; items: TushareCnNameHit[] } | null = null

export function resetTushareCnDirectoryForTests(): void {
  directoryCache = null
}

export function setTushareCnDirectoryForTests(items: TushareCnNameHit[] | null): void {
  directoryCache = items
    ? { expires: Date.now() + DIRECTORY_TTL_MS, items }
    : null
}

function slimName(value: string): string {
  return value.replace(SUFFIX_RE, '').trim()
}

function uniqueKeys(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const text = value.trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    out.push(text)
  }
  return out
}

function displayName(name: string, fullname: string): string {
  if (fullname && !fullname.includes(name)) return slimName(fullname) || name
  return name
}

function exchangeOf(tsCode: string, market: string): 'SH' | 'SZ' | 'BJ' {
  if (tsCode.endsWith('.BJ') || market.includes('北交')) return 'BJ'
  if (tsCode.endsWith('.SH') || market.includes('沪')) return 'SH'
  if (tsCode.endsWith('.SZ') || market.includes('深')) return 'SZ'
  const symbol = fromTsCode(tsCode)
  return symbol.startsWith('6') ? 'SH' : 'SZ'
}

function hitsFromRows(rows: TushareRow[]): TushareCnNameHit[] {
  const out: TushareCnNameHit[] = []
  for (const row of rows) {
    const tsCode = String(row.ts_code ?? '').trim()
    const symbol = fromTsCode(tsCode)
    const name = String(row.name ?? '').trim()
    const fullname = String(row.fullname ?? '').trim()
    if (!name || !/^\d{6}$/.test(symbol)) continue
    const shown = displayName(name, fullname)
    out.push({
      symbol,
      exchange: exchangeOf(tsCode, String(row.market ?? '')),
      name: shown,
      keys: uniqueKeys([name, shown, slimName(name), slimName(fullname), fullname]),
    })
  }
  return out
}

function scoreNameHit(row: TushareCnNameHit, keyword: string): number {
  const kw = keyword.trim()
  const code = kw.replace(/\.(SH|SZ|BJ)$/i, '')
  if (row.symbol === code || `${row.symbol}.${row.exchange}` === kw.toUpperCase()) return 100
  const kwSlim = slimName(kw)
  if (GENERIC_NAME.test(kw) || kwSlim.length < 2) return 0
  const keys = row.keys.length ? row.keys : [row.name]
  if (keys.some(key => key === kw || key === kwSlim)) return 100
  if (keys.some(key => key.startsWith(kw) || key.startsWith(kwSlim))) return 80
  if (keys.some(key => key.length >= 2 && (kw.startsWith(key) || kwSlim.startsWith(key)))) return 70
  if (keys.some(key => key.includes(kw) || key.includes(kwSlim))) return 50
  return 0
}

/** 纯函数：精确代码 / 全称 > 前缀简称 > 输入包含简称 > 唯一包含。 */
export function matchTushareCnNameRows(
  rows: readonly TushareCnNameHit[],
  keyword: string,
  limit: number,
): TushareCnNameHit[] {
  const kw = keyword.trim()
  if (!kw || limit < 1) return []
  const scored: Array<{ row: TushareCnNameHit; score: number }> = []
  for (const row of rows) {
    const score = scoreNameHit(row, kw)
    if (score > 0) scored.push({ row, score })
  }
  scored.sort((left, right) => right.score - left.score || left.row.symbol.localeCompare(right.row.symbol))
  const best = scored[0]?.score
  if (best == null) return []
  return scored.filter(item => item.score === best).map(item => item.row).slice(0, limit)
}

async function loadDirectory(): Promise<TushareCnNameHit[]> {
  const now = Date.now()
  if (directoryCache && directoryCache.expires > now) return directoryCache.items
  const client = new TushareClient()
  const rows = await client.queryAll(
    'stock_basic',
    { list_status: 'L' },
    'ts_code,symbol,name,fullname,market',
  )
  const items = hitsFromRows(rows)
  directoryCache = { expires: now + DIRECTORY_TTL_MS, items }
  return items
}

export async function searchTushareCnNames(keyword: string, limit = 8): Promise<TushareCnNameHit[]> {
  if (!isTushareEnabled()) return []
  const kw = keyword.trim()
  if (!kw) return []
  try {
    const items = await loadDirectory()
    return matchTushareCnNameRows(items, kw, limit)
  } catch {
    return []
  }
}
