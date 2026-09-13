/**
 * 数据层 v3.5 — 扩展 DI 增强测试（N7）。
 *
 * 覆盖：
 * 1. data.query 白名单扩容（4 → 22 个只读标准数据 feature，fail-closed 保留）；
 * 2. market_capability_query 参数化放行 — capability 名必须命中
 *    a-stock-layer MARKET_LEVEL_CAPABILITIES（服务端校验，防任意透传）；
 * 3. ctx.data facade（host-process-entry buildContextFacade）子进程端到端 —
 *    capabilities() / queryCapability() / quote() 经真实 gate 往返到父进程 hub。
 */
import assert from 'node:assert/strict'
import { describe, it, beforeEach, afterEach } from 'node:test'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import os from 'node:os'
import fs from 'node:fs'
import { crc32 } from 'node:zlib'

const here = path.dirname(fileURLToPath(import.meta.url))
const platformModUrl = pathToFileURL(
  path.join(here, '../apps/server/dist/platform/index.js'),
).href

/** v3.5 扩容后的扩展白名单（与 late-bound-handlers.ts EXTENSION_DATA_FEATURES 对齐） */
const EXPECTED_ALLOWLIST = [
  'instrument_quotes',
  'instrument_quote',
  'instrument_snapshot',
  'instrument_search',
  'instrument_capabilities',
  'market_capabilities',
  'instrument_chart',
  'instrument_profile',
  'instrument_financials',
  'instrument_balance_sheet',
  'instrument_cash_flow',
  'instrument_income_statement',
  'instrument_shareholders',
  'instrument_dividend',
  'instrument_institution_rating',
  'etf_snapshot',
  'etf_nav',
  'fund_snapshot',
  'fund_nav',
  'market_regime',
  'trade_calendar',
  'market_session',
]
assert.equal(EXPECTED_ALLOWLIST.length, 22)

let tmpRoot
let dataDir
let platform

beforeEach(async () => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opptrix-ext-data-'))
  dataDir = path.join(tmpRoot, 'data')
  fs.mkdirSync(dataDir, { recursive: true })
  process.env.OPPTRIX_DATA_DIR = dataDir
  platform = await import(`${platformModUrl}?t=${Date.now()}`)
  platform.resetPlatformContextForTests()
})

afterEach(async () => {
  try {
    const ctx = platform.getPlatformContext()
    await ctx.extensions.host?.stop?.()
  } catch {
    // best-effort
  }
  platform.resetPlatformContextForTests()
  delete process.env.OPPTRIX_EXT_RUNTIME
  delete process.env.OPPTRIX_DATA_DIR
  try {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  } catch {
    // best-effort
  }
})

async function activateWithDataQuery(id) {
  const ctx = platform.createPlatformContext()
  await ctx.extensions.registerFromManifest(
    { id, permissions: ['data.query'] },
    { trusted: true },
  )
  await ctx.extensions.activate(id)
  return ctx
}

describe('数据层 v3.5 — data.query 白名单扩容（fail-closed 保留）', () => {
  it('22 个白名单 feature 全部放行并到达 hub 路由层', async () => {
    const dispatched = []
    platform.bindLateBoundServices({
      hub: {
        dispatch: async (feature, params) => {
          dispatched.push({ feature, params })
          return { ok: true, feature }
        },
      },
    })
    const ctx = await activateWithDataQuery('data.allow.1')
    for (const feature of EXPECTED_ALLOWLIST) {
      const result = await ctx.extensions.run('data.allow.1', async (api) =>
        api.callGate('data.query', { feature, params: {} }),
      )
      assert.equal(result.data.ok, true, `${feature} 应放行`)
      assert.equal(result.data.data.feature, feature)
    }
    assert.equal(dispatched.length, EXPECTED_ALLOWLIST.length)
  })

  it('白名单外 feature 仍拒绝（feature_denied，含真实 hub feature）', async () => {
    platform.bindLateBoundServices({
      hub: { dispatch: async () => ({ ok: true }) },
    })
    const ctx = await activateWithDataQuery('data.deny.1')
    for (const feature of ['provider_settings_save', 'instrument_institution_holdings', 'watchlist_save']) {
      const result = await ctx.extensions.run('data.deny.1', async (api) =>
        api.callGate('data.query', { feature, params: {} }),
      )
      assert.equal(result.data.ok, false, `${feature} 应拒绝`)
      assert.equal(result.data.denialCode, 'feature_denied')
    }
  })

  it('hub 未绑定时返回 service_unavailable（行为保留）', async () => {
    platform.bindLateBoundServices({ hub: undefined })
    const ctx = await activateWithDataQuery('data.nohub.1')
    const result = await ctx.extensions.run('data.nohub.1', async (api) =>
      api.callGate('data.query', { feature: 'instrument_quotes', params: {} }),
    )
    assert.equal(result.data.ok, false)
    assert.equal(result.data.denialCode, 'service_unavailable')
  })
})

describe('数据层 v3.5 — market_capability_query 参数化放行', () => {
  it('合法 capability（limit_updown）通过路由层并透传 args/market/asset_class', async () => {
    const dispatched = []
    platform.bindLateBoundServices({
      hub: {
        dispatch: async (feature, params) => {
          dispatched.push({ feature, params })
          return { ok: true, rows: [] }
        },
      },
    })
    const ctx = await activateWithDataQuery('mcq.ok.1')
    const result = await ctx.extensions.run('mcq.ok.1', async (api) =>
      api.callGate('data.query', {
        feature: 'market_capability_query',
        params: {
          capability: 'limit_updown',
          args: [{ trade_date: '2026-09-04' }],
          market: 'CN',
          asset_class: 'EQUITY',
        },
      }),
    )
    assert.equal(result.data.ok, true)
    assert.equal(dispatched.length, 1)
    assert.equal(dispatched[0].feature, 'market_capability_query')
    assert.equal(dispatched[0].params.capability, 'limit_updown')
    assert.deepEqual(dispatched[0].params.args, [{ trade_date: '2026-09-04' }])
    assert.equal(dispatched[0].params.market, 'CN')
    assert.equal(dispatched[0].params.asset_class, 'EQUITY')
  })

  it('非法 capability 名拒绝（unknown_capability），含 PENDING 名单中的 market_breadth', async () => {
    platform.bindLateBoundServices({
      hub: {
        dispatch: async () => {
          throw new Error('hub must not be reached for a non-whitelisted capability')
        },
      },
    })
    const ctx = await activateWithDataQuery('mcq.deny.1')
    for (const capability of ['market_breadth', 'market_money_flow', 'make_me_coffee', '']) {
      const result = await ctx.extensions.run('mcq.deny.1', async (api) =>
        api.callGate('data.query', {
          feature: 'market_capability_query',
          params: { capability, args: [] },
        }),
      )
      assert.equal(result.data.ok, false, `capability=${capability || '(empty)'} 应拒绝`)
      assert.equal(result.data.denialCode, 'unknown_capability')
    }
  })

  it('gate 层白名单与 a-stock-layer MARKET_LEVEL_CAPABILITIES 一致（limit_updown 在、market_breadth 不在）', async () => {
    const layerUrl = pathToFileURL(
      path.join(here, '../packages/a-stock-layer/dist/index.js'),
    ).href
    const layer = await import(layerUrl)
    const names = new Set(layer.MARKET_LEVEL_CAPABILITIES.map((c) => String(c)))
    assert.equal(layer.MARKET_LEVEL_CAPABILITIES.length, 42)
    assert.ok(names.has('limit_updown'))
    assert.ok(!names.has('market_breadth'), 'PENDING 能力不得放行')
  })
})

// ── 子进程端到端：ctx.data facade（host-process-entry buildContextFacade）────

/** Minimal store-only zip writer（与 extension-subprocess-isolation.test.mjs 一致） */
function buildStoredZip(files) {
  const localParts = []
  const cdParts = []
  let offset = 0
  for (const [name, content] of files) {
    const nameBuf = Buffer.from(name, 'utf8')
    const data = Buffer.from(content)
    const crc = crc32(data) >>> 0
    const local = Buffer.alloc(30 + nameBuf.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    nameBuf.copy(local, 30)
    const cd = Buffer.alloc(46 + nameBuf.length)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(20, 4)
    cd.writeUInt16LE(20, 6)
    cd.writeUInt16LE(0, 8)
    cd.writeUInt16LE(0, 10)
    cd.writeUInt16LE(0, 12)
    cd.writeUInt16LE(0, 14)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(data.length, 20)
    cd.writeUInt32LE(data.length, 24)
    cd.writeUInt16LE(nameBuf.length, 28)
    cd.writeUInt16LE(0, 30)
    cd.writeUInt16LE(0, 32)
    cd.writeUInt16LE(0, 34)
    cd.writeUInt32LE(0, 36)
    cd.writeUInt32LE(0, 38)
    cd.writeUInt32LE(offset, 42)
    nameBuf.copy(cd, 46)
    localParts.push(local, data)
    cdParts.push(cd)
    offset += local.length + data.length
  }
  const cdBuf = Buffer.concat(cdParts)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(cdParts.length, 8)
  eocd.writeUInt16LE(cdParts.length, 10)
  eocd.writeUInt32LE(cdBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)
  return Buffer.concat([...localParts, cdBuf, eocd])
}

function installWorkerJs(ctx, id, entryJs, perms = ['data.query']) {
  const manifest = JSON.stringify({
    id,
    permissions: perms,
    activation: 'worker_js',
    entry: 'index.js',
  })
  const zip = buildStoredZip([
    ['manifest.json', manifest],
    ['index.js', entryJs],
  ])
  const installed = platform.admitRegisterOpx(ctx, zip, { trusted: true })
  assert.equal(installed.ok, true, installed.ok ? '' : installed.error)
  return installed
}

describe('数据层 v3.5 — ctx.data facade 子进程端到端', () => {
  beforeEach(() => {
    process.env.OPPTRIX_EXT_RUNTIME = 'subprocess'
  })

  it('capabilities()/queryCapability()/quote() 经真实 gate 往返到父进程 hub', async () => {
    const dispatched = []
    platform.bindLateBoundServices({
      hub: {
        dispatch: async (feature, params) => {
          dispatched.push({ feature, params })
          return { ok: true, feature }
        },
      },
    })
    const ctx = platform.createPlatformContext()
    installWorkerJs(
      ctx,
      'facade.data.1',
      `exports.activate = async (ctx) => {
         if (typeof ctx.data.capabilities !== 'function') throw new Error('ctx.data.capabilities missing')
         const catalog = await ctx.data.capabilities()
         if (!catalog || catalog.ok !== true) throw new Error('catalog failed: ' + JSON.stringify(catalog))
         const r = await ctx.data.queryCapability('limit_updown', [{ trade_date: '2026-09-04' }], { market: 'CN', assetClass: 'EQUITY' })
         if (!r || r.ok !== true) throw new Error('capability query failed: ' + JSON.stringify(r))
         const q = await ctx.data.quote({ market: 'CN', assetClass: 'EQUITY', symbol: '600519' })
         if (!q || q.ok !== true) throw new Error('quote failed: ' + JSON.stringify(q))
       }`,
      ['data.query'],
    )
    const act = await ctx.extensions.activate('facade.data.1')
    assert.equal(act.ok, true, act.ok ? '' : act.error)
    const features = dispatched.map((d) => d.feature)
    assert.deepEqual(features, ['market_capabilities', 'market_capability_query', 'instrument_quote'])
    const mcq = dispatched.find((d) => d.feature === 'market_capability_query')
    assert.equal(mcq.params.capability, 'limit_updown')
    assert.deepEqual(mcq.params.args, [{ trade_date: '2026-09-04' }])
    assert.equal(mcq.params.market, 'CN')
    assert.equal(mcq.params.asset_class, 'EQUITY')
  })

  it('facade 调用非法 capability 在子进程内得到 unknown_capability', async () => {
    platform.bindLateBoundServices({
      hub: { dispatch: async () => ({ ok: true }) },
    })
    const ctx = platform.createPlatformContext()
    installWorkerJs(
      ctx,
      'facade.data.2',
      `exports.activate = async (ctx) => {
         try {
           await ctx.data.queryCapability('market_breadth')
           throw new Error('expected market capability denial')
         } catch (err) {
           if (err.code !== 'unknown_capability') {
             throw new Error('wrong denial code: ' + String(err && err.code) + ' / ' + String(err && err.message))
           }
         }
       }`,
      ['data.query'],
    )
    const act = await ctx.extensions.activate('facade.data.2')
    // activate completes only if the child observed the expected denial code.
    assert.equal(act.ok, true, act.ok ? '' : act.error)
  })
})
