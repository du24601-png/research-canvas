/**
 * 市场级标准能力白名单（v3）。
 *
 * 这些能力不面向单一标的（无 InstrumentRef），经由 `engine.queryMarketCapability`
 * 走与 `queryInstrumentData` 完全相同的 registry 路由 / 熔断 / 超时 / 校验管道。
 * 白名单即「系统定义的方法探查」契约：不在名单内的能力一律拒绝；
 * provider 通过 manifest bindingsFor 声明支持，缺 binding 的能力在启动断言中报错。
 */
import { Capability } from './capabilities.js'

/** 同花顺富耀专题（指数/板块/情绪/竞价）——原 ths* 自定义方法 */
export const TONGHUASHUN_MARKET_CAPABILITIES = [
  Capability.INDEX_CATALOG,
  Capability.INDEX_PRICES_SNAPSHOT,
  Capability.INDEX_CONSTITUENTS_RAW,
  Capability.FINANCIAL_INDICATORS,
  Capability.VALUATIONS_SNAPSHOT,
  Capability.LIMIT_UP_LADDER,
  Capability.SKYROCKET_LIST,
  Capability.HOT_STOCK_LIST,
  Capability.HOT_STOCK_LIST_HISTORY,
  Capability.HOT_STOCK_RANK_TREND,
  Capability.ANOMALY_ANALYSIS_LIST,
  Capability.ANOMALY_ANALYSIS_STOCK,
  Capability.LIMIT_BREAK_POOL,
  Capability.AUCTION_SNAPSHOT,
  Capability.AUCTION_SHORT_TERM_BENCHMARK,
] as const

/** Tushare 基金深挖（上游原始形状）——原 tushareFund* 自定义方法 */
export const TUSHARE_MARKET_CAPABILITIES = [
  Capability.FUND_COMPANY,
  Capability.FUND_DIVIDEND_RAW,
  // @legacy-alias fund_daily — 形容词尾段 daily 违反命名规则 A（时间粒度应走参数，不入名）；
  // 存量冻结零重命名，禁止新增同模式。未来合规名：fund_kline_raw（K 线原始形状）。
  Capability.FUND_DAILY,
  // @legacy-alias fund_adj — 缩写段 adj（adjustment）灰名（规则 A 合法但命名质量观察项），
  // 禁止新增同模式缩写。未来合规名方向：fund_adjust_raw。
  Capability.FUND_ADJ,
  // @legacy-alias fund_basic — 形容词尾段 basic 违反命名规则 A；
  // 存量冻结零重命名，禁止新增同模式。未来合规名：fund_profile_raw（资料原始形状）。
  Capability.FUND_BASIC,
  Capability.FUND_NAV_RAW,
  // @legacy-alias shareholder_num — 缩写段 num（number）灰名，禁止新增同模式缩写。
  // 未来合规名方向：shareholder_count。
  Capability.SHAREHOLDER_NUM,
] as const

/** TickFlow 多市场批量/盘口/ universe——原 tf* 自定义方法 */
export const TICKFLOW_MARKET_CAPABILITIES = [
  Capability.MARKET_DEPTH,
  Capability.MARKET_DEPTH_BATCH,
  Capability.UNIVERSE_LIST,
  // @legacy-alias universe_get — 动作动词段 get 违反命名规则 A（资源式命名禁动词）；
  // 存量冻结零重命名，禁止新增同模式。未来合规名：universe_detail（名词资源式）。
  Capability.UNIVERSE_GET,
  Capability.UNIVERSE_BATCH,
  Capability.EX_FACTOR,
  Capability.KLINE_BATCH,
  // @legacy-alias quotes_universe — 语序倒置灰名（复数形态词前置修饰资源词），
  // 禁止新增同模式。未来合规名方向：universe_quotes（资源词在前 + 变体后缀）。
  Capability.QUOTES_UNIVERSE,
  Capability.KLINE_INTRADAY,
  Capability.INTRADAY_BATCH,
] as const

/**
 * v3.5：存量 registry 管道能力（v1 时代引擎 this.q 直连方法）——
 * 此前仅缺白名单收录。逐项经 node 实测均有内置 binding + driver 实现：
 * - LIMIT_UPDOWN / DRAGON_TIGER / SENTIMENT / TRADE_CALENDAR → tonghuashun(CN/EQUITY)
 * - TRADE_CALENDAR / INST_HOLDING → tushare(CN/EQUITY)
 * - GLOBAL_INDEX → tickflow(CN/EQUITY)
 * - INDEX_CONST → tonghuashun(CN/INDEX)
 * - EXCHANGE_RATE → stockindex(CN/EQUITY)
 */
export const LEGACY_REGISTRY_MARKET_CAPABILITIES = [
  Capability.LIMIT_UPDOWN,
  Capability.DRAGON_TIGER,
  Capability.SENTIMENT,
  // @legacy-alias global_index — 市场词元 global 命中段黑名单，按规则 A 增补条款豁免：
  // 跨市场本体资源（global 是资源本体而非作用域修饰，同 exchange_rate）。非作用域用法不得模仿。
  Capability.GLOBAL_INDEX,
  Capability.TRADE_CALENDAR,
  // @legacy-alias inst_holding — 缩写段 inst（institution）灰名，禁止新增同模式缩写。
  // 未来合规名方向：institution_holding。
  Capability.INST_HOLDING,
  // @legacy-alias index_constituent — 灰名：枚举键 INDEX_CONST 与值三方上游漂移，
  // 值已入 binding 契约不可改。未来若迁移统一为 index_constituents（复数资源式）。
  Capability.INDEX_CONST,
  Capability.EXCHANGE_RATE,
] as const

/**
 * v3.5：待 provider 实现后入列——MARKET_BREADTH / MARKET_MONEY_FLOW 当前
 * 全仓无内置 binding、无 driver 实现（原实现在已下线免费源），收录即死路由。
 * 待 tonghuashun 等源补齐实现 + binding 后移入 LEGACY_REGISTRY_MARKET_CAPABILITIES。
 */
export const PENDING_PROVIDER_MARKET_CAPABILITIES = [
  Capability.MARKET_BREADTH,
  Capability.MARKET_MONEY_FLOW,
] as const

/**
 * v3.5：引擎复合能力——实现为引擎方法而非单 provider driver 反射：
 * - REALTIME_BATCH → engine.batchRealtimeByMarket（US/HK/CRYPTO 批量实时，多源 fallback）
 * - INTRADAY_SESSIONS → engine.fetchIntradaySessions（多日分时，INTRADAY_TICK plan + 分钟线兜底）
 * 无 provider binding（binding 断言豁免），路由见 ENGINE_COMPOSED_CAPABILITY_ROUTES。
 */
export const ENGINE_COMPOSED_MARKET_CAPABILITIES: readonly Capability[] = [
  // @legacy-alias realtime_batch — 灰名登记：数据形态名词 realtime + 变体 _batch 按规则 A 合法
  // （realtime 非形容词黑名单成员）；显式登记防误报，新增能力不得把 realtime 当形容词段拼接。
  Capability.REALTIME_BATCH,
  Capability.INTRADAY_SESSIONS,
]

/** 引擎复合能力 → 引擎实现方法（queryMarketCapability 专用分支的路由表） */
export const ENGINE_COMPOSED_CAPABILITY_ROUTES: Partial<Record<Capability, string>> = {
  [Capability.REALTIME_BATCH]: 'batchRealtimeByMarket',
  [Capability.INTRADAY_SESSIONS]: 'fetchIntradaySessions',
}

export function isEngineComposedMarketCapability(cap: Capability): boolean {
  return ENGINE_COMPOSED_MARKET_CAPABILITIES.includes(cap)
}

/** 全部市场级标准能力（系统方法探查的唯一事实源） */
export const MARKET_LEVEL_CAPABILITIES: readonly Capability[] = [
  ...TONGHUASHUN_MARKET_CAPABILITIES,
  ...TUSHARE_MARKET_CAPABILITIES,
  ...TICKFLOW_MARKET_CAPABILITIES,
  ...LEGACY_REGISTRY_MARKET_CAPABILITIES,
  ...ENGINE_COMPOSED_MARKET_CAPABILITIES,
]

export function isMarketLevelCapability(cap: Capability): boolean {
  return MARKET_LEVEL_CAPABILITIES.includes(cap)
}
