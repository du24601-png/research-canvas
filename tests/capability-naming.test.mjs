/**
 * 数据层 v4 能力命名合规机审 —— 命名规则 A（名词资源式 + 参数作用域）终稿。
 *
 * 规则 A（成文终稿，含增补条款）：
 * 1. 形态：^[a-z][a-z0-9]*(_[a-z][a-z0-9]+)*$（全小写蛇形；段首必须字母，禁大写、
 *    禁连续下划线、禁纯数字段、禁首尾下划线）。
 * 2. 段黑名单（作用域走参数 market/asset_class，不进能力名）：
 *    a. 市场词元：cn / us / hk / jp / kr / crypto / asia / global；
 *       豁免：global_index、exchange_rate 为跨市场本体资源（global 非作用域修饰，是资源本体）。
 *    b. 动作动词：get / fetch / query / do / run —— 资源式命名禁动词，动作语义由调用方表达。
 *    c. 形容词尾段：daily / weekly / monthly / basic / special —— 时间粒度与粗粒度属性
 *       走参数（period / report_date 等），不得落在尾段；
 *       realtime / snapshot / kline / intraday 等数据形态名词不属形容词黑名单，
 *       作为完整能力名合法（如 realtime / snapshot / realtime_batch）。
 * 3. 变体后缀白名单（增补条款）：_raw / _batch / _snapshot / _list / _history / _trend
 *    + v4 增补 _search（锚点 instrument_search）/ _pool（锚点 limit_break_pool）。
 *    允许级联，顺序 = 基础变体（raw/batch/snapshot/list/search/pool）在前、
 *    时间修饰（history/trend）在后（如 hot_stock_list_history）。
 * 4. 存量处置（零重命名，@legacy-alias 冻结；源码标注见
 *    packages/a-stock-layer/src/core/market-capabilities.ts 与 instrument-query.ts）：
 *    - 违规 3 项（豁免放行，禁止新增同模式，禁止复活扩展）：
 *        universe_get（动词段 get → 未来 universe_detail）
 *        fund_daily（形容词尾段 daily → 未来 fund_kline_raw）
 *        fund_basic（形容词尾段 basic → 未来 fund_profile_raw）
 *    - 灰名 10 项（规则当前合法或已豁免，登记观察；新增能力不得模仿）：
 *        instrument_search / limit_break_pool（白名单增补锚点）、
 *        hot_stock_list_history（级联合法锚点）、global_index（市场词元豁免）、
 *        realtime_batch（数据形态名词 + 变体，合法）、
 *        inst_holding（缩写段 inst → institution_holding）、
 *        fund_adj（缩写段 adj → fund_adjust_raw）、
 *        shareholder_num（缩写段 num → shareholder_count）、
 *        index_constituent（枚举键 INDEX_CONST 与值三方漂移 → 未来统一 index_constituents）。
 *
 * 机审范围：MARKET_LEVEL_CAPABILITIES（市场级 42 项）+ InstrumentDataCapability
 * （标的级 35 项，经 dist INSTRUMENT_CAPABILITY_META 穷举键）+ app 界目录；
 * 任一新增名违规（非冻结豁免）即 fail —— 防同模式复活。
 *
 * 本文件同时导出规则常量与校验器，供 tests/market-capability-whitelist.test.mjs
 * 的「命名合规」用例复用同一份规则事实源。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

function pathToFileURL(p) {
  return 'file://' + p.replace(/\\/g, '/')
}

// ── 规则 A 事实源（唯一，供其他测试文件 import 复用） ──

export const NAMING_RULE = Object.freeze({
  /** 形态正则：全小写蛇形，段首字母 */
  FORMAT_REGEX: /^[a-z][a-z0-9]*(_[a-z][a-z0-9]+)*$/,
  /** 段黑名单：市场词元（作用域走参数） */
  MARKET_TOKENS: Object.freeze(['cn', 'us', 'hk', 'jp', 'kr', 'crypto', 'asia', 'global']),
  /** 段黑名单：动作动词 */
  ACTION_VERBS: Object.freeze(['get', 'fetch', 'query', 'do', 'run']),
  /** 段黑名单：形容词（仅限尾段判定；数据形态名词 realtime/snapshot 等不在此列） */
  ADJECTIVES: Object.freeze(['daily', 'weekly', 'monthly', 'basic', 'special']),
  /** 变体后缀白名单：基础变体（可级联在前） */
  BASE_VARIANT_SUFFIXES: Object.freeze(['raw', 'batch', 'snapshot', 'list', 'search', 'pool']),
  /** 变体后缀白名单：时间修饰（只能级联在后） */
  TIME_VARIANT_SUFFIXES: Object.freeze(['history', 'trend']),
  /**
   * 豁免清单（显式登记，逐项给理由）：命中段黑名单或易误报，但按规则 A 增补条款合法。
   * bypass = 该名字可豁免的 issue kind。
   */
  SEGMENT_EXEMPT: Object.freeze({
    global_index: { bypass: ['market_token'], reason: '跨市场本体资源（市场词元 global 为资源本体，非作用域修饰），同 exchange_rate' },
    realtime: { bypass: [], reason: '数据形态名词作完整能力名，规则 A 明示合法（显式登记防误报）' },
    realtime_batch: { bypass: [], reason: '数据形态名词 realtime + 变体 _batch，规则 A 合法（登记观察）' },
  }),
  /**
   * @legacy-alias 冻结集：存量违规（豁免放行）——零重命名，但禁止新增同模式、
   * 禁止在该集合外复活任何违规名。violation=true 的项即防复活扫描的比对基准。
   */
  LEGACY_ALIAS: Object.freeze({
    universe_get: { bypass: ['verb'], violation: true, future: 'universe_detail', reason: '动作动词段 get' },
    fund_daily: { bypass: ['adjective_tail'], violation: true, future: 'fund_kline_raw', reason: '形容词尾段 daily' },
    fund_basic: { bypass: ['adjective_tail'], violation: true, future: 'fund_profile_raw', reason: '形容词尾段 basic' },
  }),
})

/** 全部变体后缀（基础 + 时间修饰） */
const ALL_VARIANT_SUFFIXES = Object.freeze([
  ...NAMING_RULE.BASE_VARIANT_SUFFIXES,
  ...NAMING_RULE.TIME_VARIANT_SUFFIXES,
])

/**
 * 规则 A 校验器。返回 { name, issues, bypassed, legacy, exempt, ok }：
 * - issues: 未登记豁免的违规（非空即违规名）
 * - bypassed: 命中段黑名单但被冻结集/豁免清单放行的项（存量 @legacy-alias 锚点）
 * - legacy / exempt: 是否命中冻结集 / 豁免清单
 * - ok: 是否合规（含形态正则；bypassed 不影响合规判定）
 */
export function validateCapabilityName(name) {
  const formatOk = NAMING_RULE.FORMAT_REGEX.test(name)
  const legacy = NAMING_RULE.LEGACY_ALIAS[name]
  const exempt = NAMING_RULE.SEGMENT_EXEMPT[name]
  const bypassKinds = new Set([
    ...(legacy?.bypass ?? []),
    ...(exempt?.bypass ?? []),
  ])
  const raw = rawIssues(name)
  const issues = raw.filter(issue => issue.kind !== 'format' && !bypassKinds.has(issue.kind))
  const bypassed = raw.filter(issue => issue.kind !== 'format' && bypassKinds.has(issue.kind))
  return {
    name,
    issues,
    bypassed,
    legacy: Boolean(legacy),
    exempt: Boolean(exempt),
    ok: formatOk && issues.length === 0,
  }
}

function rawIssues(name) {
  const issues = []
  if (!NAMING_RULE.FORMAT_REGEX.test(name)) {
    issues.push({ kind: 'format', segment: name })
    return issues
  }
  const segments = name.split('_')
  for (const segment of segments) {
    if (NAMING_RULE.MARKET_TOKENS.includes(segment)) {
      issues.push({ kind: 'market_token', segment })
    }
    if (NAMING_RULE.ACTION_VERBS.includes(segment)) {
      issues.push({ kind: 'verb', segment })
    }
  }
  const tail = segments[segments.length - 1]
  if (NAMING_RULE.ADJECTIVES.includes(tail)) {
    issues.push({ kind: 'adjective_tail', segment: tail })
  }
  // 变体后缀链：从尾段向前取连续后缀段
  const chain = []
  for (let i = segments.length - 1; i >= 0; i--) {
    if (ALL_VARIANT_SUFFIXES.includes(segments[i])) chain.unshift(segments[i])
    else break
  }
  // 全名皆后缀（≥2 段）→ 无资源主干；单段（snapshot 等形态名词）合法
  if (chain.length >= 2 && chain.length === segments.length) {
    issues.push({ kind: 'suffix_only', segment: chain.join('_') })
  }
  // 级联顺序：基础变体在前、时间修饰在后（时间修饰之后不得再出现基础变体）
  let seenTimeModifier = false
  for (const segment of chain) {
    if (NAMING_RULE.TIME_VARIANT_SUFFIXES.includes(segment)) {
      seenTimeModifier = true
    } else if (seenTimeModifier) {
      issues.push({ kind: 'suffix_order', segment, detail: '基础变体出现在时间修饰之后' })
    }
  }
  return issues
}

/**
 * 从 dist + 源码收集全量受审能力名：
 * - market: dist MARKET_LEVEL_CAPABILITIES（市场级白名单唯一事实源）
 * - instrument: dist INSTRUMENT_CAPABILITY_META 穷举键（Record<InstrumentDataCapability,…> 编译期穷举）
 * - app: dist APP_CAPABILITY_CATALOG
 * - instrumentUnionSource: 从 instrument-query.ts 源码正则提取的 union（与 instrument 交叉验证）
 */
export async function collectCapabilityNames() {
  const marketCaps = await import(
    pathToFileURL(path.join(root, 'packages/a-stock-layer/dist/core/market-capabilities.js'))
  )
  const catalog = await import(
    pathToFileURL(path.join(root, 'packages/a-stock-layer/dist/core/capability-catalog.js'))
  )
  const market = marketCaps.MARKET_LEVEL_CAPABILITIES.map(c => String(c))
  const instrument = Object.keys(catalog.INSTRUMENT_CAPABILITY_META)
  const app = catalog.APP_CAPABILITY_CATALOG.map(entry => entry.name)

  const planSrc = fs.readFileSync(
    path.join(root, 'packages/a-stock-layer/src/core/instrument-query.ts'),
    'utf8',
  )
  const unionBlock = planSrc.slice(
    planSrc.indexOf('export type InstrumentDataCapability'),
    planSrc.indexOf(';', planSrc.indexOf('export type InstrumentDataCapability')),
  )
  const instrumentUnionSource = [...unionBlock.matchAll(/\|\s*'([a-z0-9_]+)'/g)].map(m => m[1])

  return { market, instrument, app, instrumentUnionSource }
}

// ── 机审用例 ──

test('规则 A 形态正则 — 全量能力名（市场级 + 标的级 + app 界）全部通过', async () => {
  const { market, instrument, app } = await collectCapabilityNames()
  assert.ok(market.length >= 42, `市场级能力应 ≥ 42 项（当前 ${market.length}）`)
  assert.ok(instrument.length >= 35, `标的级能力应 ≥ 35 项（当前 ${instrument.length}）`)
  const all = [...market, ...instrument, ...app]
  assert.ok(all.length >= 77, `受审能力应 ≥ 77 项（当前 ${all.length}）`)
  const badFormat = all.filter(name => !NAMING_RULE.FORMAT_REGEX.test(name))
  assert.deepEqual(badFormat, [], `以下能力名不符合形态正则：${badFormat.join(', ')}`)
})

test('规则 A 段黑名单 — 市场/动词/形容词尾段扫描：零未登记违规，命中集合恰为登记集', async () => {
  const { market, instrument, app } = await collectCapabilityNames()
  const all = [...market, ...instrument, ...app]
  // 防复活：任何未在冻结集/豁免清单登记的违规名（新增同模式）一律 fail
  const unregistered = all.filter(name => validateCapabilityName(name).issues.length > 0)
  assert.deepEqual(unregistered, [], `发现未登记的违规能力名：${unregistered.join(', ')}`)
  // 命中黑名单（经冻结/豁免放行）的集合必须恰好等于登记集：
  // 违规冻结 3 项（universe_get / fund_daily / fund_basic）+ 市场词元豁免 global_index。
  // 集合变小 = 冻结锚点丢失；集合变大 = 出现新同模式名。
  const hitting = all
    .filter(name => validateCapabilityName(name).bypassed.length > 0)
    .sort()
  const registered = [
    ...Object.entries(NAMING_RULE.LEGACY_ALIAS).filter(([, meta]) => meta.violation).map(([name]) => name),
    ...Object.entries(NAMING_RULE.SEGMENT_EXEMPT)
      .filter(([, meta]) => (meta.bypass ?? []).length > 0)
      .map(([name]) => name),
  ].sort()
  assert.deepEqual(
    hitting,
    registered,
    `黑名单命中集合偏离登记集：实际 [${hitting.join(', ')}]，登记 [${registered.join(', ')}]`,
  )
})

test('规则 A 豁免清单锚点 — global_index / realtime 在册且豁免生效', async () => {
  const { market, instrument } = await collectCapabilityNames()
  assert.ok(market.includes('global_index'), 'global_index 应在市场级白名单（跨市场本体资源豁免锚点）')
  assert.ok(instrument.includes('realtime'), 'realtime 应在标的级能力（数据形态名词合法锚点）')
  for (const name of ['global_index', 'realtime', 'realtime_batch']) {
    const result = validateCapabilityName(name)
    assert.ok(result.ok, `豁免项 ${name} 应判定合规：${JSON.stringify(result.issues)}`)
  }
})

test('规则 A 变体后缀白名单 — _search/_pool 增补在册，级联顺序合法', async () => {
  const { instrument, market } = await collectCapabilityNames()
  // 增补条款锚点
  assert.ok(instrument.includes('instrument_search'), 'instrument_search 应在标的级能力（_search 增补锚点）')
  assert.ok(market.includes('limit_break_pool'), 'limit_break_pool 应在市场级白名单（_pool 增补锚点）')
  // 级联合法样例：hot_stock_list_history = 基础变体 _list 在前 + 时间修饰 _history 在后
  const cascade = validateCapabilityName('hot_stock_list_history')
  assert.ok(cascade.ok, `级联名 hot_stock_list_history 应合规：${JSON.stringify(cascade.issues)}`)
  // 存量名单中出现的变体后缀链全部在白名单内且顺序合法（validateCapabilityName 已内建）
  const all = [...market, ...instrument]
  for (const name of all) {
    const result = validateCapabilityName(name)
    const suffixIssues = result.issues.filter(i => i.kind === 'suffix_order' || i.kind === 'suffix_only')
    assert.deepEqual(suffixIssues, [], `${name} 变体后缀链违规`)
  }
})

test('规则 A 校验器自检 — 正/负探针（负例不得混入白名单）', () => {
  const positives = [
    'realtime', 'kline', 'snapshot', 'stock_list', 'index_constituents_raw',
    'hot_stock_list_history', 'instrument_search', 'limit_break_pool',
    'universe_detail', 'fund_kline_raw', 'fund_profile_raw', // 未来合规名方向
  ]
  for (const name of positives) {
    const result = validateCapabilityName(name)
    assert.deepEqual(result.issues, [], `正例 ${name} 不应命中任何违规`)
  }
  const negatives = [
    ['cn_hot_stocks', 'market_token'],
    ['us_etf_snapshot', 'market_token'],
    ['get_universe', 'verb'],
    ['portfolio_fetch', 'verb'],
    ['fund_weekly', 'adjective_tail'],
    ['stock_special_list', null], // 形容词非尾段也登记（kind=market? 否——special 仅尾段判定，此处验证放行面）
    ['hot_stock_history_list', 'suffix_order'], // 时间修饰在前 → 顺序违规
    ['raw_list_history', 'suffix_only'], // 全名皆后缀（无资源主干）
  ]
  for (const [name, kind] of negatives) {
    const result = validateCapabilityName(name)
    if (kind === null) {
      // stock_special_list：special 非尾段，规则 A 仅约束尾段 → 合规（显式固化该判定面）
      assert.deepEqual(result.issues, [], `探针 ${name} 预期合规`)
    } else {
      assert.ok(
        result.issues.some(issue => issue.kind === kind),
        `负例 ${name} 应命中 ${kind}，实际 ${JSON.stringify(result.issues)}`,
      )
    }
  }
  // 形态正则负例：大写 / 连续下划线 / 纯数字段 / 首尾下划线 / 空段
  for (const name of ['Fund_List', 'fund__daily', 'fund_2x', '_fund', 'fund_']) {
    assert.ok(!NAMING_RULE.FORMAT_REGEX.test(name), `形态负例 ${name} 不应通过正则`)
  }
})

test('防复活 — 违规名不得新增进白名单，合规替代名与 legacy 暂不同义并存', async () => {
  const { market, instrumentUnionSource, instrument } = await collectCapabilityNames()
  // 白名单（市场级 + 标的级 union）不得出现冻结集之外的任何违规名（已在段黑名单用例断言，此处二重校验 union 源码）
  for (const name of instrumentUnionSource) {
    const result = validateCapabilityName(name)
    assert.ok(result.ok, `InstrumentDataCapability union 成员 ${name} 违反规则 A：${JSON.stringify(result.issues)}`)
  }
  // future 合规名在 legacy 在位期间不得先行入册（防同义并存双路由）
  for (const [legacyName, meta] of Object.entries(NAMING_RULE.LEGACY_ALIAS)) {
    if (!meta.future) continue
    assert.ok(
      !market.includes(meta.future) && !instrument.includes(meta.future),
      `合规替代名 ${meta.future}（${legacyName} 的未来名）在 legacy 在位期间不得入册`,
    )
  }
  // dist 目录与源码 union 一致（防 catalog / 源码漂移）
  const { instrument: instrumentFromCatalog } = await collectCapabilityNames()
  assert.deepEqual(
    [...instrumentUnionSource].sort(),
    [...instrumentFromCatalog].sort(),
    'instrument-query.ts union 与 INSTRUMENT_CAPABILITY_META 键集不一致（catalog 穷举漂移）',
  )
})
