/**
 * 数据层 v3.5（P5）—— engine.listCapabilities() 能力目录契约锁。
 *
 * 锁定的架构不变量：
 *   引擎提供统一的「系统定义方法探查」目录 listCapabilities()，三界齐全：
 *     - market 界 42 项 —— 与 MARKET_LEVEL_CAPABILITIES 白名单一一对应
 *       （引擎复合能力 realtime_batch / intraday_sessions 亦在其中，见
 *        tests/market-capability-whitelist.test.mjs）；
 *     - instrument 界 35 项 —— 与 InstrumentDataCapability 查询计划白名单一一对应；
 *     - app 界 ≥10 项 —— 引擎内部复合服务，providers 恒为 ['internal']。
 *   每个目录条目字段完整：name / scope / markets / assetClasses / params /
 *   providers / description —— 这是「方法探查」对外的自描述契约，缺字段即破坏探查方。
 *   10 个关键市场能力 params 非空（调用方需要知道传什么参才能用）。
 *
 * 谁负责让它保持绿：
 *   - P3（engine 能力目录）落地后转绿；测试读 dist，跑前须 npm run build:packages；
 *   - market=42 / instrument=35 是精确契约锁，app≥10 是下限锁：
 *     新增能力时先在 market-data-core 登记 → 更新 provider binding →
 *     有意更新本测试期望值，禁止静默漂移。
 *
 * 状态：P3 已在途（撰写时 listCapabilities 已产出 42/35/12 三界）。
 * 当前唯一已知红项：limit_up_ladder params 为空（该能力实际接受 date 入参，
 * P3 应补录）——其余契约项（三界数量、白名单一一对应、字段完整、app=internal）
 * 撰写时已绿。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

function pkgUrl(...p) {
  return pathToFileURL(path.join(root, 'packages', ...p)).href
}

/** 三界 scope 枚举（目录契约的一部分）。 */
const SCOPES = ['market', 'instrument', 'app']

/** 目录条目必须完整提供的自描述字段。 */
const REQUIRED_FIELDS = [
  'name',
  'scope',
  'markets',
  'assetClasses',
  'params',
  'providers',
  'description',
]

/** 10 个关键市场能力：params 必须非空（调用方据此构造入参）。 */
const KEY_MARKET_CAPABILITIES_REQUIRING_PARAMS = [
  'index_catalog',
  'hot_stock_list',
  'hot_stock_list_history',
  'limit_up_ladder',
  'dragon_tiger',
  'sentiment',
  'trade_calendar',
  'inst_holding',
  'index_constituent',
  'fund_daily',
]

let catalogCache = null

/** 惰性构建目录（MarketDataEngine(false) 与既有测试惯例一致：不做 provider 自动发现）。 */
async function getCatalog() {
  if (catalogCache) return catalogCache
  const { MarketDataEngine } = await import(pkgUrl('a-stock-layer', 'dist', 'engine.js'))
  const engine = new MarketDataEngine(false)
  assert.equal(
    typeof engine.listCapabilities,
    'function',
    'engine.listCapabilities 不存在 —— 依赖 P3（engine 能力目录）落地，跑前须 npm run build:packages',
  )
  const catalog = engine.listCapabilities()
  assert.ok(Array.isArray(catalog), 'listCapabilities() 必须返回数组')
  assert.ok(catalog.length > 0, '能力目录不应为空')
  catalogCache = catalog
  return catalog
}

function byScope(catalog) {
  const groups = { market: [], instrument: [], app: [] }
  for (const item of catalog) {
    if (groups[item.scope]) groups[item.scope].push(item)
  }
  return groups
}

test('三界齐全且数量符合 v3.5 契约（market=42 / instrument=35 / app≥10）', async () => {
  const groups = byScope(await getCatalog())
  assert.equal(
    groups.market.length,
    42,
    `market 界应恰为 42 项（与 MARKET_LEVEL_CAPABILITIES 一一对应），实际 ${groups.market.length}`,
  )
  assert.equal(
    groups.instrument.length,
    35,
    `instrument 界应恰为 35 项（与 InstrumentDataCapability 一一对应），实际 ${groups.instrument.length}`,
  )
  assert.ok(
    groups.app.length >= 10,
    `app 界应 ≥ 10 项，实际 ${groups.app.length}`,
  )
})

test('market 界与 MARKET_LEVEL_CAPABILITIES 白名单一一对应（不缺不增）', async () => {
  const catalog = await getCatalog()
  const { MARKET_LEVEL_CAPABILITIES } = await import(
    pkgUrl('a-stock-layer', 'dist', 'core', 'market-capabilities.js')
  )
  const catalogNames = new Set(
    catalog.filter(i => i.scope === 'market').map(i => String(i.name)),
  )
  const whitelist = new Set(MARKET_LEVEL_CAPABILITIES.map(String))
  const missing = [...whitelist].filter(n => !catalogNames.has(n))
  const extra = [...catalogNames].filter(n => !whitelist.has(n))
  assert.deepEqual(
    [missing, extra],
    [[], []],
    `market 界目录与白名单漂移 —— 缺: ${missing.join(', ') || '无'}；多: ${extra.join(', ') || '无'}`,
  )
})

test('每个目录条目字段完整且类型正确（自描述探查契约）', async () => {
  const catalog = await getCatalog()
  const incomplete = []
  for (const item of catalog) {
    const problems = []
    for (const field of REQUIRED_FIELDS) {
      if (!(field in item)) problems.push(`缺字段 ${field}`)
    }
    if (typeof item.name !== 'string' || item.name.trim() === '') problems.push('name 应为非空字符串')
    if (!SCOPES.includes(item.scope)) problems.push(`scope 应为 ${SCOPES.join('/')}，实际 ${item.scope}`)
    if (!Array.isArray(item.markets)) problems.push('markets 应为数组')
    if (!Array.isArray(item.assetClasses)) problems.push('assetClasses 应为数组')
    if (!Array.isArray(item.params)) problems.push('params 应为数组')
    // providers 只要求是数组：market/instrument 界的实际承接方由
    // tests/market-capability-whitelist.test.mjs 的 binding 断言锁定，
    // 目录可留空由引擎按市场动态解析；app 界非空约束见专用用例（恰为 ['internal']）
    if (!Array.isArray(item.providers)) problems.push('providers 应为数组')
    if (typeof item.description !== 'string' || item.description.trim() === '')
      problems.push('description 应为非空字符串')
    if (problems.length > 0) incomplete.push(`${item.name ?? '<未命名>'}: ${problems.join('; ')}`)
  }
  assert.deepEqual(incomplete, [], `以下目录条目字段不完整：\n  ${incomplete.join('\n  ')}`)
})

test('目录条目 name 在各 scope 内唯一（跨 scope 允许同名，如 trade_calendar 同为市场/标的界）', async () => {
  const catalog = await getCatalog()
  const seen = new Map()
  for (const item of catalog) {
    const key = `${item.scope}:${String(item.name)}`
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([name, n]) => `${name} x${n}`)
  assert.deepEqual(dupes, [], `能力目录在同一 scope 内存在重名条目：${dupes.join('、')}`)
})

test('10 个关键市场能力 params 非空（探查方需要知道如何构造入参）', async () => {
  const catalog = await getCatalog()
  const marketByName = new Map(
    catalog.filter(i => i.scope === 'market').map(i => [String(i.name), i]),
  )
  const bad = []
  for (const name of KEY_MARKET_CAPABILITIES_REQUIRING_PARAMS) {
    const item = marketByName.get(name)
    if (!item) {
      bad.push(`${name}: 不在 market 界目录中`)
    } else if (!Array.isArray(item.params) || item.params.length === 0) {
      bad.push(`${name}: params 为空`)
    }
  }
  assert.deepEqual(bad, [], `关键市场能力 params 契约不满足：${bad.join('；')}`)
})

test('app 界 providers 恒为 [\'internal\']（引擎内部复合服务不经 provider 路由）', async () => {
  const catalog = await getCatalog()
  const appItems = catalog.filter(i => i.scope === 'app')
  assert.ok(appItems.length >= 10, 'app 界应 ≥ 10 项')
  const offenders = appItems
    .filter(i => JSON.stringify(i.providers) !== JSON.stringify(['internal']))
    .map(i => `${String(i.name)}: ${JSON.stringify(i.providers)}`)
  assert.deepEqual(
    offenders,
    [],
    `app 界能力 providers 必须恰为 ['internal']：${offenders.join('；')}`,
  )
})
