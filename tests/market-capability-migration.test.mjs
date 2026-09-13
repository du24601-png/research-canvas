/**
 * 数据层 v3.5（P5）—— Hub 数据面直连清零锁（market-capability migration）。
 *
 * 锁定的架构不变量：
 *   research-hub 的数据面唯一入口是 engine.queryInstrumentData / engine.queryMarketCapability
 *   （registry 路由 + 熔断 + 超时 + 校验管道，与标的能力完全同构）。
 *   Hub 层禁止再直连 MarketDataEngine 的具体 de.* 方法——那些方法只是
 *   capability 管道的旧式入口，直连会绕过白名单校验与 provider 路由。
 *   本测试静态扫描 packages/research-hub/src/hub.ts 源码（剥离注释后计数，
 *   注释里的历史提法不构成运行时违例），逐个断言直连出现次数为 0。
 *
 * 谁负责让它保持绿：
 *   - P2（hub 数据面迁移到 capability 注册表）落地后本测试必须转绿；
 *   - 此后 research-hub 维护者：任何新增 de.* 直连都会打红本测试。
 *     正确做法：market-data-core 登记 capability → provider manifest
 *     bindingsFor 声明 → 经 queryMarketCapability / queryInstrumentData 走标准管道。
 *
 * PENDING 豁免（每项暂允许 ≤1 处直连；对应 provider 落地后必须清零并删除豁免）：
 *   - de.marketBreadth(    —— capability market_breadth 仍在 PENDING_PROVIDER_MARKET_CAPABILITIES（无内置 binding / driver 实现，见 tests/market-capability-whitelist.test.mjs 第 4 用例）
 *   - de.marketMoneyFlow(  —— capability market_money_flow 同上，等待 provider 落地
 *   - de.minuteKline(      —— minute 级 K 线暂无独立 capability（kline 周期参数化尚未覆盖 minute 分片合并）
 *
 * 状态：依赖 P2 落地（P2 迁移进行中，本测试红项随迁移进度收敛）。
 * 撰写时快照：禁列直连剩 de.batchRealtime( x1、de.indexRealtime( x1；
 * PENDING 超限剩 de.minuteKline( x3（豁免上限 ≤1）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const HUB_SRC = path.join(root, 'packages/research-hub/src/hub.ts')

/**
 * 彻底禁列的引擎直连方法（v3.5 起一律改走 capability 注册表）。
 * 词边界 \b 防止误伤以 de 结尾的标识符（如 thscode.xxx(）。
 */
const FORBIDDEN_DE_CALLS = [
  'batchRealtime',
  'batchRealtimeByMarket',
  'limitUpdown',
  'dragonTiger',
  'sentiment',
  'tradeCalendar',
  'instHolding',
  'indexConstituents',
  'globalIndex',
  'indexRealtime',
  'fetchIntradaySessions',
]

/** PENDING 豁免：[方法名, 豁免原因]（原因须随清零一并删除）。 */
const PENDING_DE_CALLS = [
  [
    'marketBreadth',
    'market_breadth 仍在 PENDING_PROVIDER_MARKET_CAPABILITIES（无内置 binding / driver 实现）',
  ],
  [
    'marketMoneyFlow',
    'market_money_flow 仍在 PENDING_PROVIDER_MARKET_CAPABILITIES（无内置 binding / driver 实现）',
  ],
  [
    'minuteKline',
    'minute 级 K 线暂无独立 capability（kline 周期参数化尚未覆盖 minute 分片合并）',
    3, // stock_chart 分钟翻页 tail/step 三处调用为同一语义单元
  ],
]

/** 剥离注释：块注释整段删除；行注释删除但保护字符串里的 protocol://（如 https://）。 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/** 统计 `de.<method>(` 直连出现次数（含 this.de.<method>(，不含标识符内嵌 de）。 */
function deCallCount(code, method) {
  const re = new RegExp(`\\bde\\.${method}\\s*\\(`, 'g')
  return (code.match(re) ?? []).length
}

if (!fs.existsSync(HUB_SRC)) {
  throw new Error(`hub 源码缺失，无法执行直连清零锁：${HUB_SRC}`)
}
const hubCode = stripComments(fs.readFileSync(HUB_SRC, 'utf8'))

test('禁列引擎直连方法出现次数为 0（数据面唯一入口 = queryInstrumentData / queryMarketCapability）', () => {
  const offenders = FORBIDDEN_DE_CALLS.map(m => [m, deCallCount(hubCode, m)]).filter(
    ([, n]) => n > 0,
  )
  assert.deepEqual(
    offenders,
    [],
    `hub.ts 仍直连引擎方法（应改走 queryInstrumentData / queryMarketCapability）：` +
      offenders.map(([m, n]) => `de.${m}() x${n}`).join('、'),
  )
})

test('PENDING 豁免直连每项 ≤1 处（provider 落地后清零并移除豁免）', () => {
  const over = PENDING_DE_CALLS.map(([m, reason, limit = 1]) => [m, deCallCount(hubCode, m), reason, limit]).filter(
    ([, n, , limit]) => n > limit,
  )
  assert.deepEqual(
    over,
    [],
    `PENDING 豁免超限（过渡直连超出条目级上限）：` +
      over.map(([m, n, , limit]) => `de.${m}() x${n}（上限 ${limit ?? 1}）`).join('、'),
  )
})

test('正向守卫：hub 数据面仍经标准管道（queryInstrumentData / queryMarketCapability 至少 1 处）', () => {
  const n = (hubCode.match(/\b(?:queryInstrumentData|queryMarketCapability)\s*\(/g) ?? []).length
  assert.ok(
    n >= 1,
    `hub.ts 未发现标准数据面入口调用（queryInstrumentData / queryMarketCapability），数据面管道疑似被绕空`,
  )
})
