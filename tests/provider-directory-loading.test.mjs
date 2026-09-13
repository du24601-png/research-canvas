/**
 * P4 数据层 v3.5 — Provider 目录加载机制（统一模块契约 + 安全加固）测试。
 *
 * 覆盖：
 * - v1 driver 形态与 v2 SDK createDriver 形态均可在用户目录加载
 * - SDK manifest/settings 消费进 manifest（SDK 字段优先、provider.json 兜底、providerId 不可篡改）
 * - provider.json 校验失败 / 缺 entry / 错 marketGroup / 目录名≠id / entry 逃逸 / 内置冲突 / 重名 → 结构化 loadError
 * - 加载失败进入 installed 名单（loaded: false + loadError），不再静默跳过
 * - reload 走 cache-busting（?t= 时间戳），能拿到重写后的新模块代码
 *
 * fixture 全部位于 mkdtemp 临时目录（OPPTRIX_DATA_DIR 指向），不触碰真实 ~/.opptrix。
 */
import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const pkg = (...p) => pathToFileURL(path.join(here, '../packages', ...p)).href

let tmpRoot
let providersDir
let loader
let registry

/** v1 driver 形态入口模块源码（buildId 用于 reload cache-busting 断言）。 */
function legacyEntrySource(buildId) {
  return `
const driver = {
  name: 'legacy-driver',
  priority: 50,
  buildId: ${buildId},
  capabilities: () => [],
  bindings: () => [],
}
export default {
  driver,
  testConnection: async () => ({ ok: true, message: 'legacy ok' }),
}
`
}

/** v2 SDK 形态入口模块源码（经 defineProvider 产出 manifest + createDriver）。 */
function sdkEntrySource(sdkUrl) {
  return `
import { defineProvider } from '${sdkUrl}'
export default defineProvider({
  id: 'sdk-driver',
  title: 'SDK 模块标题',
  marketGroup: 'CRYPTO',
  defaultPriority: 45,
  capabilities: ['stock_basic'],
  bindings: [{ market: 'CN', assetClass: 'EQUITY', capability: 'stock_basic', defaultPriority: 45 }],
  settings: {
    providerId: 'sdk-driver',
    title: 'SDK 设置标题',
    marketGroup: 'CRYPTO',
    fields: [{ key: 'apiKey', type: 'secret', label: 'API Key', required: false }],
  },
  createDriver(ctx) {
    if (!ctx.providerId || !ctx.paths || !ctx.paths.userDataRoot) {
      throw new Error('createDriver ctx 缺少 providerId/paths')
    }
    return {
      name: ctx.providerId,
      priority: 45,
      createdVia: 'createDriver',
      capabilities: () => ['stock_basic'],
      bindings: () => [{ market: 'CN', assetClass: 'EQUITY', capability: 'stock_basic', defaultPriority: 45 }],
    }
  },
})
`
}

function writeProvider(name, json, entryName, entrySource) {
  const dir = path.join(providersDir, name)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'provider.json'), JSON.stringify(json, null, 2))
  if (entryName) fs.writeFileSync(path.join(dir, entryName), entrySource)
  return dir
}

function baseJson(providerId, extra = {}) {
  return {
    schemaVersion: 1,
    providerId,
    title: `${providerId} 标题`,
    marketGroup: 'GLOBAL',
    defaultPriority: 50,
    entry: 'index.mjs',
    ...extra,
  }
}

async function loadErrorMessage(dir) {
  try {
    await loader.loadFromDirectory(dir)
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
  return null
}

before(async () => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opptrix-provider-dir-'))
  process.env.OPPTRIX_DATA_DIR = tmpRoot
  providersDir = path.join(tmpRoot, 'providers')
  fs.mkdirSync(providersDir, { recursive: true })

  // ── 合法：v1 driver 形态 ──
  writeProvider('legacy-driver', baseJson('legacy-driver'), 'index.mjs', legacyEntrySource(1))
  // ── 合法：v2 SDK createDriver 形态（json 提供“兜底”字段，SDK manifest 全部覆盖）──
  writeProvider('sdk-driver', baseJson('sdk-driver', {
    title: 'JSON 兜底标题',
    defaultPriority: 40,
    settings: {
      providerId: 'sdk-driver',
      title: 'JSON 设置标题',
      marketGroup: 'CRYPTO',
      fields: [],
    },
    capabilities: ['stock_basic'],
    bindings: [{ market: 'CN', assetClass: 'EQUITY', capability: 'stock_basic', defaultPriority: 40 }],
    engine: { minAppVersion: '0.0.0', sdkVersion: '0.1.0' },
  }), 'index.mjs', sdkEntrySource(pkg('provider-sdk', 'dist', 'index.js')))

  // ── 坏：缺 entry 文件 ──
  writeProvider('bad-entry', baseJson('bad-entry', { entry: 'missing.mjs' }))
  // ── 坏：marketGroup 不在枚举内 ──
  writeProvider('bad-market', baseJson('bad-market', { marketGroup: 'MARS' }))
  // ── 坏：目录名 ≠ providerId ──
  writeProvider('wrong-name', baseJson('someone-else'))
  // ── 坏：entry 逃逸安装目录（外部文件真实存在，证明是逃逸检查拦截）──
  fs.writeFileSync(path.join(providersDir, 'outside.mjs'), 'export default {}\n')
  writeProvider('escaper', baseJson('escaper', { entry: '../outside.mjs' }))
  // ── 坏：v2 完整形态但 engine 为空对象（SDK json 分支权威校验拦截）──
  writeProvider('bad-engine', baseJson('bad-engine', {
    capabilities: ['stock_basic'],
    bindings: [{ market: 'CN', assetClass: 'EQUITY', capability: 'stock_basic', defaultPriority: 50 }],
    engine: {},
  }))
  // ── 坏：目录与内置数据源同名（重名/内置冲突）──
  writeProvider('tushare', baseJson('tushare', { marketGroup: 'CN', defaultPriority: 105 }))

  const loaderMod = await import(pkg('a-stock-layer', 'dist', 'providers', 'loader.js'))
  const registryMod = await import(pkg('market-data-core', 'dist', 'core', 'registry.js'))
  const configStoreMod = await import(pkg('a-stock-layer', 'dist', 'providers', 'config-store.js'))

  registry = new registryMod.DriverRegistry()
  loader = new loaderMod.ProviderLoader(registry, new configStoreMod.ProviderConfigStore())
  loader.registerBuiltins()
})

after(async () => {
  try {
    const { getUserDataStore } = await import(pkg('user-store', 'dist', 'index.js'))
    getUserDataStore().close()
  } catch { /* best-effort */ }
  delete process.env.OPPTRIX_DATA_DIR
  fs.rmSync(tmpRoot, { recursive: true, force: true })
})

describe('provider directory loading (v3.5 P4)', () => {
  let legacyDriver

  it('v1 driver 形态与 v2 createDriver 形态均加载成功', async () => {
    const records = await loader.loadInstalled()
    const byId = new Map(records.map(r => [r.providerId, r]))

    assert.equal(byId.get('legacy-driver')?.loaded, true)
    assert.equal(byId.get('legacy-driver')?.loadError, undefined)
    assert.equal(byId.get('sdk-driver')?.loaded, true)
    assert.equal(byId.get('sdk-driver')?.loadError, undefined)

    legacyDriver = registry.get('legacy-driver')
    assert.equal(legacyDriver?.buildId, 1)
    assert.equal(registry.get('sdk-driver')?.createdVia, 'createDriver')
  })

  it('SDK manifest/settings 消费进 manifest：SDK 字段优先、json 兜底、providerId 不可篡改', async () => {
    const { getManifestRegistry } = await import(
      pkg('a-stock-layer', 'dist', 'providers', 'manifest-registry.js')
    )
    const get = id => getManifestRegistry().get(id)
    const sdkManifest = get('sdk-driver')
    assert.ok(sdkManifest, 'sdk-driver manifest 应已注册')
    assert.equal(sdkManifest.title, 'SDK 模块标题')
    assert.equal(sdkManifest.defaultPriority, 45)
    assert.equal(sdkManifest.providerId, 'sdk-driver')
    assert.equal(sdkManifest.settings?.title, 'SDK 设置标题')

    const legacyManifest = get('legacy-driver')
    assert.equal(legacyManifest?.title, 'legacy-driver 标题')
  })

  it('加载失败结构化进入 installed 名单（loaded:false + loadError）', () => {
    const failures = loader.listInstalled().filter(r => r.loaded === false)
    const errOf = name =>
      failures.find(r => r.installDir.endsWith(name))?.loadError ?? ''

    assert.equal(failures.length, 6, `应有 6 条失败记录，实际 ${failures.length}`)
    assert.match(errOf('bad-entry'), /入口文件不存在/)
    assert.match(errOf('bad-market'), /marketGroup must be one of/)
    assert.match(errOf('escaper'), /入口文件必须位于数据源目录内/)
    assert.match(errOf('bad-engine'), /engine\.minAppVersion must be a non-empty string/)
    assert.match(errOf('tushare'), /与内置数据源 tushare 冲突/)
    assert.match(errOf('wrong-name'), /目录名 \(wrong-name\) 必须与 providerId \(someone-else\) 一致/)

    const badMarket = failures.find(r => r.installDir.endsWith('bad-market'))
    assert.equal(badMarket?.providerId, 'bad-market')
    assert.ok(badMarket?.loadError, '失败记录应带结构化 loadError')
  })

  it('目录名≠id / entry 逃逸 / 内置冲突逐项直接拒绝', async () => {
    assert.equal(
      await loadErrorMessage(path.join(providersDir, 'wrong-name')),
      '目录名 (wrong-name) 必须与 providerId (someone-else) 一致',
    )
    assert.equal(
      await loadErrorMessage(path.join(providersDir, 'escaper')),
      '入口文件必须位于数据源目录内：../outside.mjs',
    )
    assert.match(
      await loadErrorMessage(path.join(providersDir, 'tushare')),
      /与内置数据源 tushare 冲突/,
    )
  })

  it('重名拒绝且不静默覆盖已有驱动', async () => {
    const err = await loadErrorMessage(path.join(providersDir, 'legacy-driver'))
    assert.match(err ?? '', /已加载，拒绝重复安装/)
    assert.equal(registry.get('legacy-driver'), legacyDriver, '注册表应保留原实例')
  })

  it('reload 走 cache-busting 拿到重写后的新模块', async () => {
    const entryFile = path.join(providersDir, 'legacy-driver', 'index.mjs')
    fs.writeFileSync(entryFile, legacyEntrySource(2))

    const record = await loader.reload('legacy-driver')
    assert.ok(record, 'reload 应返回记录')
    assert.equal(record?.providerId, 'legacy-driver')
    assert.equal(registry.get('legacy-driver')?.buildId, 2, '重名驱动应为新模块实例')
  })

  it('入口模块 testConnection 注册为测试钩子', async () => {
    const hook = loader.getTestConnectionHook('legacy-driver')
    assert.ok(hook, 'legacy-driver 测试钩子应已注册')
    const result = await hook({ providerId: 'legacy-driver', extra: {} })
    assert.deepEqual(result, { ok: true, message: 'legacy ok' })
    assert.ok(loader.getTestConnectionHook('tushare'), '内置 tushare 测试钩子来自 register.js 单一来源')
  })
})
