/**
 * 缓存溯源 — getEntry 交出原始 provider / storedAt，磁盘往返与旧格式兼容，
 * 以及研究数据集 sources[].provider 在缓存命中时不再退化为 unknown。
 */
import { describe, it, after, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

// 隔离用户数据目录，避免 watchlist 写入真实用户库
const dataDir = mkdtempSync(join(tmpdir(), 'opptrix-provenance-data-'))
process.env.OPPTRIX_DATA_DIR = dataDir

const { Cache } = await import('../packages/market-data-core/dist/core/cache.js')
const { resolveResearchMetric } = await import('../packages/shared/dist/research-metrics.js')
const { fetchEntityMetricSlice } = await import('../packages/agent/dist/research-query-data.js')
const { MarketDataEngine } = await import('../packages/a-stock-layer/dist/index.js')

describe('cache entry provenance', () => {
  /** @type {string} */
  let dir
  /** @type {string} */
  let filePath
  /** @type {InstanceType<typeof Cache>} */
  let cache

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'opptrix-provenance-'))
    filePath = join(dir, 'cache.json')
  })

  afterEach(() => {
    cache?.dispose?.()
    rmSync(dir, { recursive: true, force: true })
  })

  it('getEntry returns original source and storedAt', () => {
    cache = new Cache(filePath, { persistDebounceMs: 60_000, disableExitFlush: true })
    const before = Date.now()
    cache.setWithTtl('stock_kline', [{ close: 1 }], 'kline', { code: '601058' }, 3600, 'tushare')
    const entry = cache.getEntry('stock_kline', 'kline', { code: '601058' })
    assert.ok(entry)
    assert.deepEqual(entry.data, [{ close: 1 }])
    assert.equal(entry.source, 'tushare')
    assert.ok(typeof entry.storedAt === 'number')
    assert.ok(entry.storedAt >= before)
    assert.ok(entry.expiresAt > Date.now())
    // 旧签名行为不变
    assert.deepEqual(cache.getWithTtl('stock_kline', 'kline', { code: '601058' }, 3600), [{ close: 1 }])
  })

  it('survives a disk round-trip in a new Cache instance', () => {
    cache = new Cache(filePath, { persistDebounceMs: 60_000, disableExitFlush: true })
    cache.setWithTtl('financial_summary', [{ roe: 12 }], 'financials', { code: '601058' }, 3600, 'tushare')
    cache.flush()
    cache.dispose()

    const reopened = new Cache(filePath, { persistDebounceMs: 60_000, disableExitFlush: true })
    try {
      const entry = reopened.getEntry('financial_summary', 'financials', { code: '601058' })
      assert.ok(entry)
      assert.deepEqual(entry.data, [{ roe: 12 }])
      assert.equal(entry.source, 'tushare')
      assert.ok(typeof entry.storedAt === 'number')
    } finally {
      reopened.dispose()
    }
    cache = reopened
  })

  it('loads legacy disk entries without storedAt / source', () => {
    const params = { code: '601966' }
    const key = `stock_kline:kline:${JSON.stringify(params)}`
    writeFileSync(filePath, JSON.stringify({
      [key]: { data: [{ close: 2 }], expires: Date.now() + 3_600_000 },
    }))

    cache = new Cache(filePath, { persistDebounceMs: 60_000, disableExitFlush: true })
    const entry = cache.getEntry('stock_kline', 'kline', params)
    assert.ok(entry)
    assert.deepEqual(entry.data, [{ close: 2 }])
    assert.equal(entry.source, undefined)
    assert.equal(entry.storedAt, undefined)
    assert.equal(cache.stats().entries, 1)
  })

  it('returns null for non-positive TTL and for expired entries', async () => {
    cache = new Cache(filePath, { persistDebounceMs: 60_000, disableExitFlush: true })
    // stock_realtime 的 DEFAULT_TTL 为 0 → getEntry 必须与 get 一致地拒绝读取
    cache.setWithTtl('stock_realtime', [{ price: 1 }], 'realtime', { code: '601058' }, 3600, 'tickflow')
    assert.equal(cache.getEntry('stock_realtime', 'realtime', { code: '601058' }), null)
    assert.equal(cache.getEntryWithTtl('stock_realtime', 'realtime', { code: '601058' }, 0), null)
    assert.ok(cache.getEntryWithTtl('stock_realtime', 'realtime', { code: '601058' }, 3600))

    cache.setWithTtl('stock_kline', [{ close: 3 }], 'kline', { code: '000001' }, 0.001, 'tushare')
    await delay(20)
    assert.equal(cache.getEntry('stock_kline', 'kline', { code: '000001' }), null)
  })
})

function financialHub(result) {
  return {
    async dispatch() {
      return { success: false, message: 'unsupported' }
    },
    de: {
      async queryInstrumentData() {
        return result
      },
    },
  }
}

const ENTITY = {
  id: 'e1',
  name: '赛轮轮胎',
  ticker: '601058.SH',
  market: 'CN',
  type: 'equity',
}

const ROW = {
  code: '601058',
  reportDate: '2024-12-31',
  reportType: 'annual',
  grossMargin: 18.2,
}

async function providerOf(result) {
  const metric = resolveResearchMetric('gross_margin')
  assert.ok(metric)
  const slice = await fetchEntityMetricSlice(
    financialHub(result),
    ENTITY,
    metric,
    '2024',
    '2024',
    '2026-01-01T00:00:00.000Z',
  )
  return slice.sources[0]?.provider
}

describe('research dataset provider attribution', () => {
  it('prefers meta.provider on a cache hit', async () => {
    const provider = await providerOf({
      success: true,
      source: 'cache',
      cached: true,
      meta: { provider: 'tushare', cached: true, cachedAt: Date.now() },
      data: [ROW],
    })
    assert.equal(provider, 'tushare')
  })

  it('stays unknown when only source: cache is available', async () => {
    const provider = await providerOf({
      success: true,
      source: 'cache',
      cached: true,
      data: [ROW],
    })
    assert.equal(provider, 'unknown')
  })

  it('keeps live provider attribution unchanged', async () => {
    const provider = await providerOf({ success: true, source: 'tushare', data: [ROW] })
    assert.equal(provider, 'tushare')
  })
})

const CN_REF = { market: 'CN', assetClass: 'EQUITY', symbol: '601058', exchange: 'SH' }

/** 预热 engine 磁盘缓存，模拟「第二天打开产品」的缓存命中路径。 */
function engineWithSeededCache() {
  const engine = new MarketDataEngine(false)
  engine.watchlist.replace([{
    code: '601058',
    name: '赛轮轮胎',
    instrument: CN_REF,
  }])
  engine.cache.setWithTtl(
    'financial_summary',
    [ROW],
    'financials',
    {
      method: 'financials',
      market: 'CN',
      assetClass: 'EQUITY',
      args: JSON.stringify(['601058', '', 'annual']),
    },
    86_400,
    'tushare',
  )
  // 立即摘掉 flush 钩子与 debounce 定时器，避免测试写入数据目录 cache.json
  engine.cache.dispose()
  return engine
}

describe('engine cache hit keeps provider provenance end to end', () => {
  after(async () => {
    const { getUserDataStore } = await import('../packages/user-store/dist/index.js')
    getUserDataStore().close()
    // Windows 下 SQLite 句柄可能尚未完全释放；临时目录清理为 best-effort
    try {
      rmSync(dataDir, { recursive: true, force: true, maxRetries: 3 })
    } catch { /* 临时目录留给 OS 回收 */ }
  })

  it('queryInstrumentData exposes the original provider in meta on a cache hit', async () => {
    const engine = engineWithSeededCache()
    const result = await engine.queryInstrumentData(CN_REF, 'financials', { reportType: 'annual' })
    assert.equal(result.success, true)
    assert.equal(result.source, 'cache')
    assert.equal(result.cached, true)
    assert.equal(result.meta?.provider, 'tushare')
    assert.equal(result.meta?.cached, true)
    assert.ok(typeof result.meta?.cachedAt === 'number')
    assert.ok(result.meta?.expiresAt > Date.now())
  })

  it('research dataset sources report the real provider instead of unknown', async () => {
    const engine = engineWithSeededCache()
    const metric = resolveResearchMetric('gross_margin')
    assert.ok(metric)
    const slice = await fetchEntityMetricSlice(
      { async dispatch() { return { success: false, message: 'unsupported' } }, de: engine },
      ENTITY,
      metric,
      '2024',
      '2024',
      '2026-01-01T00:00:00.000Z',
    )
    assert.equal(slice.sources.length, 1)
    assert.notEqual(slice.sources[0].provider, 'unknown')
    assert.equal(slice.sources[0].provider, 'tushare')
    assert.equal(slice.data[0]?.value, 18.2)
  })
})
