/**
 * 数据层 v3 架构锁 —— capability ↔ binding 一致性。
 *
 * 1. 市场级标准能力（42 项：32 项 v3 专题 + 8 项存量 registry 管道 + 2 项引擎复合）
 *    中，非引擎复合的每个都必须有至少一个内置 provider binding；
 * 2. 每个内置 binding 的能力必须有 CAP_METHOD 实现（可路由）；
 * 3. 已废止的死路由能力（历史上只有已下线源实现）不得出现在任何 binding 中，
 *    也不得重新出现在查询计划的 InstrumentDataCapability 白名单里；
 * 4. 引擎复合能力（REALTIME_BATCH / INTRADAY_SESSIONS）豁免 binding 断言，
 *    但必须在引擎复合路由表登记且指向存在的 MarketDataEngine 方法。
 *
 * 新增能力时：先在 market-data-core capabilities.ts 登记 → provider manifest
 * bindingsFor 声明 → CAP_METHOD 绑定实现方法 → 本测试自动覆盖。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const PROVIDER_MANIFESTS = [
  ['tonghuashun', 'TONGHUASHUN_SPEC'],
  ['tushare', 'TUSHARE_SPEC'],
  ['tickflow', 'TICKFLOW_SPEC'],
  ['stockindex', 'STOCKINDEX_SPEC'],
  ['binance', 'BINANCE_SPEC'],
  ['okx', 'OKX_SPEC'],
]

async function loadSpecs() {
  const specs = []
  for (const [id, exportName] of PROVIDER_MANIFESTS) {
    const mod = await import(
      pathToFileURL(path.join(root, 'packages/a-stock-layer/dist/providers', id, 'manifest.js'))
    )
    const spec = mod[exportName]
    assert.ok(spec, `${id} manifest spec 缺失`)
    specs.push([id, spec])
  }
  return specs
}

function pathToFileURL(p) {
  return 'file://' + p.replace(/\\/g, '/')
}

test('市场级标准能力全部有生产 binding', async () => {
  const marketCaps = await import(
    pathToFileURL(path.join(root, 'packages/a-stock-layer/dist/core/market-capabilities.js'))
  )
  const { MARKET_LEVEL_CAPABILITIES, ENGINE_COMPOSED_MARKET_CAPABILITIES } = marketCaps
  assert.ok(MARKET_LEVEL_CAPABILITIES.length >= 42, `市场级能力应 ≥ 42 项（当前 ${MARKET_LEVEL_CAPABILITIES.length}）`)
  const engineComposed = new Set(ENGINE_COMPOSED_MARKET_CAPABILITIES.map(String))
  const specs = await loadSpecs()
  for (const capability of MARKET_LEVEL_CAPABILITIES) {
    const providers = []
    for (const [id, spec] of specs) {
      const bindings = spec.bindingsFor(spec.defaultPriority, spec.maxConcurrent)
      if (bindings.some(b => String(b.capability) === String(capability))) providers.push(id)
    }
    if (engineComposed.has(String(capability))) {
      // 引擎复合能力不走 provider 路由 — 必须无 binding（防死路由），分支断言见下方用例
      assert.deepEqual(providers, [], `引擎复合能力 ${String(capability)} 不应有 provider binding`)
      continue
    }
    assert.ok(
      providers.length > 0,
      `市场级能力 ${String(capability)} 没有任何 provider binding（活计划死路由）`,
    )
  }
})

test('引擎复合能力 — 路由表指向存在的引擎方法且不经 CAP_METHOD 反射', async () => {
  const { ENGINE_COMPOSED_MARKET_CAPABILITIES, ENGINE_COMPOSED_CAPABILITY_ROUTES } = await import(
    pathToFileURL(path.join(root, 'packages/a-stock-layer/dist/core/market-capabilities.js'))
  )
  const { CAP_METHOD } = await import(
    pathToFileURL(path.join(root, 'packages/a-stock-layer/dist/providers/common/base.js'))
  )
  const { MarketDataEngine } = await import(
    pathToFileURL(path.join(root, 'packages/a-stock-layer/dist/engine.js'))
  )
  assert.ok(ENGINE_COMPOSED_MARKET_CAPABILITIES.length >= 2, '引擎复合能力应 ≥ 2 项')
  for (const capability of ENGINE_COMPOSED_MARKET_CAPABILITIES) {
    const route = ENGINE_COMPOSED_CAPABILITY_ROUTES[String(capability)]
    assert.ok(route, `引擎复合能力 ${String(capability)} 缺少路由表登记`)
    assert.equal(
      typeof MarketDataEngine.prototype[route],
      'function',
      `引擎复合能力 ${String(capability)} 路由目标 MarketDataEngine.prototype.${route} 不存在`,
    )
    assert.ok(
      !CAP_METHOD[String(capability)],
      `引擎复合能力 ${String(capability)} 不得进入 CAP_METHOD driver 反射表`,
    )
  }
})

test('EXCHANGE_RATE — 由 stockindex 承接（汇率走 registry 管道）', async () => {
  const { MARKET_LEVEL_CAPABILITIES } = await import(
    pathToFileURL(path.join(root, 'packages/a-stock-layer/dist/core/market-capabilities.js'))
  )
  assert.ok(
    MARKET_LEVEL_CAPABILITIES.some(c => String(c) === 'exchange_rate'),
    'exchange_rate 应入白名单',
  )
  const specs = await loadSpecs()
  const spec = specs.find(([id]) => id === 'stockindex')
  assert.ok(spec, 'stockindex manifest 缺失')
  const bindings = spec[1].bindingsFor(spec[1].defaultPriority, spec[1].maxConcurrent)
  assert.ok(
    bindings.some(b => String(b.capability) === 'exchange_rate'),
    'stockindex 应绑定 exchange_rate（opptrixFxRmbLatest）',
  )
})

test('无实现的存量能力不得入白名单（market_breadth / market_money_flow 等待 provider 落地）', async () => {
  const { MARKET_LEVEL_CAPABILITIES, PENDING_PROVIDER_MARKET_CAPABILITIES } = await import(
    pathToFileURL(path.join(root, 'packages/a-stock-layer/dist/core/market-capabilities.js'))
  )
  const whitelisted = new Set(MARKET_LEVEL_CAPABILITIES.map(String))
  for (const pending of PENDING_PROVIDER_MARKET_CAPABILITIES) {
    assert.ok(
      !whitelisted.has(String(pending)),
      `${String(pending)} 当前无内置 binding 与 driver 实现，收录即死路由；待 provider 落地后再入列`,
    )
  }
})

test('全部内置 binding 的能力都可路由（CAP_METHOD 有实现映射）', async () => {
  const { CAP_METHOD } = await import(
    pathToFileURL(path.join(root, 'packages/a-stock-layer/dist/providers/common/base.js'))
  )
  const specs = await loadSpecs()
  // instrument_search 走专用搜索计划通道（instrumentSearchPlan），不经 registry 路由
  const DEDICATED_PLAN_CAPABILITIES = new Set(['instrument_search'])
  const unroutable = []
  for (const [id, spec] of specs) {
    for (const b of spec.bindingsFor(spec.defaultPriority, spec.maxConcurrent)) {
      if (DEDICATED_PLAN_CAPABILITIES.has(String(b.capability))) continue
      if (!CAP_METHOD[String(b.capability)]) unroutable.push(`${id}:${String(b.capability)}`)
    }
  }
  assert.deepEqual(unroutable, [], `以下 binding 缺少 CAP_METHOD 实现：${unroutable.join(', ')}`)
})

test('死路由能力不得复活', async () => {
  const DEAD_PLAN_CAPABILITIES = [
    'sector_list',
    'money_flow',
    'technical_analysis',
    'news',
    'notices',
  ]
  const specs = await loadSpecs()
  for (const dead of DEAD_PLAN_CAPABILITIES) {
    for (const [id, spec] of specs) {
      const bindings = spec.bindingsFor(spec.defaultPriority, spec.maxConcurrent)
      assert.ok(
        !bindings.some(b => String(b.capability) === dead),
        `${id} 不应绑定死路由能力 ${dead}`,
      )
    }
  }
  const planSrc = fs.readFileSync(
    path.join(root, 'packages/a-stock-layer/src/core/instrument-query.ts'),
    'utf8',
  )
  for (const dead of DEAD_PLAN_CAPABILITIES) {
    assert.doesNotMatch(planSrc, new RegExp(`'${dead}'`), `死路由能力 ${dead} 不得回到查询计划白名单`)
  }
})

test('命名合规 — 市场级白名单符合命名规则 A（复用 capability-naming 机审规则）', async () => {
  // 与 tests/capability-naming.test.mjs 共用同一份规则事实源（NAMING_RULE / 校验器）
  const { NAMING_RULE, validateCapabilityName, collectCapabilityNames } = await import(
    './capability-naming.test.mjs'
  )
  const { market } = await collectCapabilityNames()
  assert.ok(market.length >= 42, `市场级能力应 ≥ 42 项（当前 ${market.length}）`)
  for (const name of market) {
    const result = validateCapabilityName(name)
    assert.ok(
      result.ok,
      `市场级能力 ${name} 违反命名规则 A：${JSON.stringify(result.issues)}` +
        (result.legacy ? '（@legacy-alias 冻结项异常放行失败）' : ''),
    )
    if (result.legacy || result.exempt) {
      // 冻结/豁免项必须在规则事实源中有登记（防白名单新增未登记的违规名蒙混过关）
      const registered = Boolean(NAMING_RULE.LEGACY_ALIAS[name] || NAMING_RULE.SEGMENT_EXEMPT[name])
      assert.ok(registered, `${name} 命中豁免路径但未在 NAMING_RULE 登记`)
    }
  }
  // 形态正则兜底（与 naming 文件同一正则事实源）
  const badFormat = market.filter(name => !NAMING_RULE.FORMAT_REGEX.test(name))
  assert.deepEqual(badFormat, [], `市场级能力名形态违规：${badFormat.join(', ')}`)
})
