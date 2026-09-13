/**
 * 能力目录（v3.5）— 三界（instrument / market / app）系统方法探查的唯一出口。
 *
 * - instrument 界：来源 `InstrumentDataCapability`（core/instrument-query.ts），
 *   markets/assetClasses/providers 由 registry binding 聚合（复用
 *   `engine.listMarketCapabilities` 的 scope 扫描模式）。
 * - market 界：来源 `MARKET_LEVEL_CAPABILITIES`（core/market-capabilities.ts）+ binding 聚合；
 *   引擎复合能力（realtime_batch / intraday_sessions）无 binding，用静态 scope 兜底。
 * - app 界：计算服务（无 provider，providers=['internal']），静态声明。
 *
 * 目录只描述「系统能做什么」；调用契约（args 顺序 / payload 形状）以各 handler 与
 * docs/DATA-LAYER.md 为准。长尾能力的 params 允许为空数组，description 指向文档。
 *
 * 参数命名约定（v4 统一标识符）：
 * - 单标的 `code`；批量 `codes` / `symbols`；币对 `pair`
 * - 日期 `date` / `start_date` / `end_date`（YYYY-MM-DD）；年份 `year`（number）
 * - K 线周期值域 `daily` 族（daily / weekly / monthly / 1m 等）
 * - 市场维度 `market`（CN/US/HK/CRYPTO）；交易所维度 `exchange`（SH/SZ/BJ 等）
 * - 资产类别 `asset_class`（标准名；引擎内部兼容 camelCase 变体）
 */
import type { AssetClass, Market } from '@opptrix/shared'
import { watchlistCacheTtl } from '@opptrix/market-data-core'
import { Capability } from './capabilities.js'
import { MARKET_LEVEL_CAPABILITIES } from './market-capabilities.js'
import type { DriverRegistry } from './registry.js'
import type { InstrumentDataCapability } from './instrument-query.js'
import { TONGHUASHUN_SPEC } from '../providers/tonghuashun/manifest.js'
import { TUSHARE_SPEC } from '../providers/tushare/manifest.js'
import { STOCKINDEX_SPEC } from '../providers/stockindex/manifest.js'
import { TICKFLOW_SPEC } from '../providers/tickflow/manifest.js'
import { AKSHARE_SPEC } from '../providers/akshare/manifest.js'
import { BINANCE_SPEC } from '../providers/binance/manifest.js'
import { OKX_SPEC } from '../providers/okx/manifest.js'

export type CapabilityScope = 'instrument' | 'market' | 'app'

/** 参数 schema — 位置参数（market 界 registry 能力）或命名参数（app 界 / 引擎复合能力） */
export interface CapabilityParamSpec {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object'
  required: boolean
  description: string
}

export interface CapabilityCatalogEntry {
  /** capability 名（与 queryInstrumentData / queryMarketCapability / hub feature 入参一致） */
  name: string
  scope: CapabilityScope
  /** 支持市场（由 binding 聚合；app 界为 []） */
  markets: string[]
  assetClasses: string[]
  params: CapabilityParamSpec[]
  /** 当前注册的数据源（app 界为 ['internal']） */
  providers: string[]
  description: string
  /** 关注列表缓存 TTL（秒），仅核心项给出；缺省表示未单独配置 */
  cacheTtl?: number
}

type Cap = Capability | string

/** instrument 界静态声明 — params 从 Hub 实际用法（InstrumentQueryOpts）提炼；route 为聚合 binding 用的 registry 能力 */
interface InstrumentCapMeta {
  desc: string
  params?: CapabilityParamSpec[]
  route: readonly Cap[]
  /** watchlist cache type（watchlistCacheTtl 的 key），核心项才给 */
  ttl?: string
}

const P = (
  name: string,
  type: CapabilityParamSpec['type'],
  required: boolean,
  description: string,
): CapabilityParamSpec => ({ name, type, required, description })

const COUNT_PARAM = P('count', 'number', false, '返回条数，默认 120')
const PERIOD_PARAM = P('period', 'string', false, 'K 线周期：daily / weekly / monthly / 1m 等，默认 daily')
const DATE_RANGE = [
  P('start_date', 'string', false, '起始日期 YYYY-MM-DD'),
  P('end_date', 'string', false, '结束日期 YYYY-MM-DD'),
]
const KEYWORD = P('keyword', 'string', false, '关键词过滤')

/** 无位置入参能力的可选路由参数 — 与 query_market_capability 的 market/asset_class 可选入参对应 */
const ROUTE_OPTS: CapabilityParamSpec[] = [
  P('market', 'string', false, '路由市场（默认 CN；无位置入参，args 传 []）'),
  P('asset_class', 'string', false, '路由标的类型（默认 EQUITY）'),
]

/** 35 项标的级能力 — 覆盖全部 InstrumentDataCapability（Record 强制穷举） */
export const INSTRUMENT_CAPABILITY_META: Record<InstrumentDataCapability, InstrumentCapMeta> = {
  realtime: { desc: '实时/最新行情报价', ttl: 'stock_realtime', route: [Capability.STOCK_REALTIME, Capability.INDEX_REALTIME] },
  kline: {
    desc: '历史 K 线序列（日线/周线/月线/分钟线）',
    params: [COUNT_PARAM, PERIOD_PARAM, ...DATE_RANGE],
    ttl: 'stock_kline',
    route: [Capability.STOCK_KLINE, Capability.INDEX_KLINE],
  },
  snapshot: { desc: '聚合快照（概况 + 行情 + 关键序列），引擎复合路径', ttl: 'stock_realtime', route: [Capability.STOCK_REALTIME, Capability.INDEX_REALTIME] },
  profile: { desc: '公司/基金/ETF 基本面资料', ttl: 'stock_profile', route: [Capability.STOCK_PROFILE, Capability.ETF_PROFILE, Capability.FUND_PROFILE] },
  financials: {
    desc: '财务摘要多期（营收/利润/ROE 等）',
    params: [P('report_date', 'string', false, '报告期截止日 YYYY-MM-DD'), P('report_type', 'string', false, 'annual（年报）或 quarter（季报），默认 annual')],
    ttl: 'financial_summary',
    route: [Capability.FINANCIAL_SUMMARY],
  },
  balance_sheet: { desc: '资产负债表多期', params: [P('report_date', 'string', false, '报告期截止日 YYYY-MM-DD')], ttl: 'balance_sheet', route: [Capability.BALANCE_SHEET] },
  cash_flow: { desc: '现金流量表多期', params: [P('report_date', 'string', false, '报告期截止日 YYYY-MM-DD')], ttl: 'cash_flow', route: [Capability.CASH_FLOW] },
  income_statement: { desc: '利润表多期', params: [P('report_date', 'string', false, '报告期截止日 YYYY-MM-DD')], ttl: 'income_statement', route: [Capability.INCOME_STMT] },
  stock_list: {
    desc: '股票列表（分页、板块/行业过滤）',
    params: [KEYWORD, P('page', 'number', false, '页码，默认 1'), P('page_size', 'number', false, '每页条数，默认 100'), P('board_key', 'string', false, '板块过滤（如 hsj、cyb）'), P('industry_code', 'string', false, '行业代码过滤（A 股）')],
    ttl: 'stock_list',
    route: [Capability.STOCK_LIST],
  },
  instrument_search: { desc: '跨市场关键词搜索标的（相关性排序）', params: [P('keyword', 'string', true, '搜索关键词'), P('page_size', 'number', false, '返回条数，默认 30，最大 100')], route: [Capability.INSTRUMENT_SEARCH] },
  index_constituents: { desc: '指数/板块成分股', params: [P('index_code', 'string', false, '指数代码，缺省用标的自身代码')], route: [Capability.INDEX_CONST] },
  trade_calendar: { desc: '交易日历（按年返回开休市日）', params: [P('year', 'number', false, '年份，默认当前年')], route: [Capability.TRADE_CALENDAR] },
  etf_list: { desc: 'ETF 列表', params: [KEYWORD], route: [Capability.ETF_LIST] },
  etf_profile: { desc: 'ETF 基本面资料', ttl: 'etf_profile', route: [Capability.ETF_PROFILE] },
  etf_nav: { desc: 'ETF 净值序列', ttl: 'etf_nav', route: [Capability.ETF_NAV] },
  etf_holdings: { desc: 'ETF 持仓成分', ttl: 'etf_holdings', route: [Capability.ETF_HOLDINGS] },
  etf_snapshot: { desc: 'ETF 聚合快照（概况 + 净值 + 行情），引擎复合路径', route: [Capability.ETF_PROFILE, Capability.ETF_NAV] },
  fund_list: { desc: '场外基金列表', params: [KEYWORD, P('page_size', 'number', false, '返回条数，默认 30，最大 100')], route: [Capability.FUND_LIST] },
  fund_profile: { desc: '基金基本资料', ttl: 'fund_profile', route: [Capability.FUND_PROFILE] },
  fund_nav: { desc: '基金净值序列', ttl: 'fund_nav', route: [Capability.FUND_NAV] },
  fund_holdings: { desc: '基金持仓明细', ttl: 'fund_holdings', route: [Capability.FUND_HOLDINGS] },
  fund_snapshot: { desc: '基金聚合快照（概况 + 净值 + 行情），引擎复合路径', route: [Capability.FUND_PROFILE, Capability.FUND_NAV, Capability.FUND_QUOTE] },
  fund_quote: { desc: '基金最新净值/估值', ttl: 'fund_quote', route: [Capability.FUND_QUOTE] },
  fund_returns: { desc: '基金区间收益率', ttl: 'fund_returns', route: [Capability.FUND_RETURNS] },
  fund_drawdown: { desc: '基金回撤指标', ttl: 'fund_drawdown', route: [Capability.FUND_DRAWDOWN] },
  fund_allocation: { desc: '基金资产配置', ttl: 'fund_allocation', route: [Capability.FUND_ALLOCATION] },
  fund_holders: { desc: '基金持有人结构', ttl: 'fund_holders', route: [Capability.FUND_HOLDERS] },
  fund_dividend: { desc: '基金分红记录', ttl: 'fund_dividend', route: [Capability.FUND_DIVIDEND] },
  fund_manager: { desc: '基金经理信息', ttl: 'fund_manager', route: [Capability.FUND_MANAGER] },
  fund_diagnosis: { desc: '基金诊断报告', ttl: 'fund_diagnosis', route: [Capability.FUND_DIAGNOSIS] },
  fund_news: { desc: '基金相关资讯', route: [Capability.FUND_NEWS] },
  fund_financials: { desc: '基金财务指标', ttl: 'fund_financials', route: [Capability.FUND_FINANCIALS] },
  dividend: { desc: '分红送转记录', params: [P('page', 'number', false, '页码（港股）'), P('page_size', 'number', false, '每页条数（港股）')], ttl: 'dividend', route: [Capability.DIVIDEND] },
  shareholders: { desc: '股东结构/股东户数', params: [P('report_date', 'string', false, '报告期截止日（A 股）'), P('page', 'number', false, '页码（美股）')], ttl: 'shareholder', route: [Capability.SHAREHOLDER] },
  inst_holding: { desc: '机构持仓一览（A 股）', route: [Capability.INST_HOLDING] },
}

/** market 界参数契约 — 10 个关键能力必须完整，其余按 P1 契约表 / driver @usage 提炼 */
export const MARKET_CAPABILITY_PARAMS: Partial<Record<Cap, CapabilityParamSpec[]>> = {
  [Capability.REALTIME_BATCH]: [P('market', 'string', true, 'CN / US / HK / CRYPTO（市场维度）'), P('symbols', 'object', true, '标的代码字符串数组（单对象参数 {market, symbols}）'), P('asset_class', 'string', false, '预留参数（标准名），作用域由 market 决定'), P('markets', 'object', false, 'CN 分支：代码 → 交易所映射表（Record<code, "SH"|"SZ"|"BJ">），缺省自动识别'), P('assetClasses', 'object', false, 'CN 分支：代码 → 资产类别映射表（Record<code, AssetClass>），缺省 EQUITY')],
  [Capability.INTRADAY_SESSIONS]: [P('symbol', 'string', true, 'A 股标的代码（单对象参数 {symbol, exchange, days}）'), P('exchange', 'string', false, '交易所维度：SH / SZ / BJ，缺省自动识别；旧名 market 兼容读取'), P('days', 'number', false, '最近 N 个交易日分时，默认 5')],
  [Capability.EXCHANGE_RATE]: [P('pair', 'string', false, '币对如 USD/CNY 或 USD；缺省返回全量约 25 币种')],
  [Capability.LIMIT_UPDOWN]: [P('date', 'string', false, '交易日 YYYY-MM-DD，缺省当日')],
  [Capability.DRAGON_TIGER]: [P('date', 'string', false, '交易日 YYYY-MM-DD，缺省当日')],
  [Capability.SENTIMENT]: [P('code', 'string', false, '个股代码；空为全市场情绪')],
  [Capability.GLOBAL_INDEX]: [P('code', 'string', false, '全球指数代码；缺省返回全量')],
  [Capability.TRADE_CALENDAR]: [P('year', 'number', false, '年份，默认当前年')],
  [Capability.INST_HOLDING]: [P('code', 'string', true, 'A 股代码')],
  [Capability.INDEX_CONST]: [P('index_code', 'string', true, '指数代码（如 000300 / 885338.TI）')],
  [Capability.INDEX_CATALOG]: [P('tag', 'string', true, '目录标签，如 cn_concept / cn_industry')],
  [Capability.INDEX_PRICES_SNAPSHOT]: [P('thscodes', 'string', true, '同花顺指数代码，逗号分隔')],
  [Capability.INDEX_CONSTITUENTS_RAW]: [P('index_code', 'string', true, '同花顺指数代码（如 885338.TI）')],
  [Capability.FINANCIAL_INDICATORS]: [P('code', 'string', true, 'A 股代码'), P('report_period', 'string', false, '报告期如 2024Q3')],
  [Capability.VALUATIONS_SNAPSHOT]: [P('code', 'string', true, 'A 股代码')],
  [Capability.LIMIT_UP_LADDER]: ROUTE_OPTS,
  [Capability.SKYROCKET_LIST]: [P('period', 'string', false, '周期，默认 day')],
  [Capability.HOT_STOCK_LIST]: [P('period', 'string', false, '周期，默认 day')],
  [Capability.HOT_STOCK_LIST_HISTORY]: [P('date', 'string', true, '交易日 YYYY-MM-DD')],
  [Capability.HOT_STOCK_RANK_TREND]: [P('code', 'string', true, 'A 股代码'), P('start_date', 'string', false, '起始日 YYYY-MM-DD'), P('end_date', 'string', false, '结束日 YYYY-MM-DD')],
  [Capability.ANOMALY_ANALYSIS_LIST]: [P('tag', 'string', false, '异动标签过滤')],
  [Capability.ANOMALY_ANALYSIS_STOCK]: [P('codes', 'string', true, 'A 股代码（可逗号分隔）')],
  [Capability.LIMIT_BREAK_POOL]: [P('date', 'string', false, '交易日 YYYY-MM-DD，缺省当日')],
  [Capability.AUCTION_SNAPSHOT]: [P('code', 'string', true, 'A 股代码'), P('mode', 'string', false, 'live（实时）等模式')],
  [Capability.AUCTION_SHORT_TERM_BENCHMARK]: [P('date', 'string', true, '交易日 YYYY-MM-DD')],
  [Capability.FUND_COMPANY]: ROUTE_OPTS,
  [Capability.FUND_DIVIDEND_RAW]: [P('code', 'string', true, '基金代码')],
  [Capability.FUND_DAILY]: [P('code', 'string', true, '场内基金代码'), P('start_date', 'string', false, '起始日 YYYYMMDD'), P('end_date', 'string', false, '结束日 YYYYMMDD')],
  [Capability.FUND_ADJ]: [P('code', 'string', true, '场内基金代码')],
  [Capability.FUND_BASIC]: [P('code', 'string', true, '基金代码（如 000001.OF）')],
  [Capability.FUND_NAV_RAW]: [P('code', 'string', true, '基金代码')],
  [Capability.SHAREHOLDER_NUM]: [P('code', 'string', true, 'A 股代码')],
  [Capability.MARKET_DEPTH]: [P('code', 'string', true, '标的代码')],
  [Capability.MARKET_DEPTH_BATCH]: [P('codes', 'object', true, '标的代码字符串数组')],
  [Capability.UNIVERSE_LIST]: ROUTE_OPTS,
  [Capability.UNIVERSE_GET]: [P('universe_id', 'string', true, '标的池 ID')],
  [Capability.UNIVERSE_BATCH]: [P('universe_ids', 'object', true, '标的池 ID 字符串数组')],
  [Capability.EX_FACTOR]: [P('code', 'string', true, '标的代码'), P('start_ms', 'number', false, '起始时间戳（毫秒）'), P('end_ms', 'number', false, '结束时间戳（毫秒）')],
  [Capability.KLINE_BATCH]: [P('codes', 'object', true, '标的代码字符串数组'), P('period', 'string', false, '周期，默认 1d'), P('count', 'number', false, '每标的根数，默认 120，最大 10000')],
  [Capability.QUOTES_UNIVERSE]: [P('universe_ids', 'object', true, '标的池 ID 字符串数组')],
  [Capability.KLINE_INTRADAY]: [P('code', 'string', true, '标的代码'), P('period', 'string', false, '分钟周期，默认 1m'), P('count', 'number', false, '根数')],
  [Capability.INTRADAY_BATCH]: [P('codes', 'object', true, '标的代码字符串数组'), P('period', 'string', false, '分钟周期：1m/5m/15m/30m/60m，默认 1m')],
}

const MARKET_CAPABILITY_DESC: Partial<Record<Cap, string>> = {
  [Capability.REALTIME_BATCH]: '批量实时行情（引擎复合：CN 聚合 + US/HK/CRYPTO 多源 fallback）',
  [Capability.INTRADAY_SESSIONS]: '多日分时走势（引擎复合：分时 plan + 分钟线兜底）',
  [Capability.EXCHANGE_RATE]: '人民币中间价汇率（100 单位外币兑人民币，日度）',
  [Capability.LIMIT_UPDOWN]: 'A 股涨跌停列表',
  [Capability.DRAGON_TIGER]: 'A 股龙虎榜',
  [Capability.SENTIMENT]: '市场情绪 / 个股热度',
  [Capability.GLOBAL_INDEX]: '全球指数行情',
  [Capability.TRADE_CALENDAR]: '交易日历',
  [Capability.INST_HOLDING]: '机构持仓一览（Tushare）',
  [Capability.INDEX_CONST]: '指数成分股',
  [Capability.INDEX_CATALOG]: '同花顺指数/板块目录',
  [Capability.INDEX_PRICES_SNAPSHOT]: '同花顺指数实时价格快照',
  [Capability.INDEX_CONSTITUENTS_RAW]: '同花顺指数成分（上游原始形状）',
  [Capability.FINANCIAL_INDICATORS]: '同花顺财务指标（上游原始形状）',
  [Capability.VALUATIONS_SNAPSHOT]: '个股市盈率/市净率等估值快照',
  [Capability.LIMIT_UP_LADDER]: '连板天梯（涨停梯队分布）',
  [Capability.SKYROCKET_LIST]: '飙升榜单（短线强势股）',
  [Capability.HOT_STOCK_LIST]: '热股榜单（当前人气股）',
  [Capability.HOT_STOCK_LIST_HISTORY]: '历史热榜（按交易日）',
  [Capability.HOT_STOCK_RANK_TREND]: '个股热度排名趋势',
  [Capability.ANOMALY_ANALYSIS_LIST]: '盘面异动列表',
  [Capability.ANOMALY_ANALYSIS_STOCK]: '个股异动分析',
  [Capability.LIMIT_BREAK_POOL]: '炸板池（涨停开板个股）',
  [Capability.AUCTION_SNAPSHOT]: '集合竞价快照',
  [Capability.AUCTION_SHORT_TERM_BENCHMARK]: '竞价短期情绪基准',
  [Capability.FUND_COMPANY]: '基金公司名录（Tushare 原始形状）',
  [Capability.FUND_DIVIDEND_RAW]: '基金分红（原始形状）',
  [Capability.FUND_DAILY]: '场内基金日线行情（原始形状）',
  [Capability.FUND_ADJ]: '场内基金复权因子（原始形状）',
  [Capability.FUND_BASIC]: '场外基金基本资料（原始形状）',
  [Capability.FUND_NAV_RAW]: '场外基金净值（原始形状）',
  [Capability.SHAREHOLDER_NUM]: '股东户数（Tushare 原始形状）',
  [Capability.MARKET_DEPTH]: '单标五档盘口',
  [Capability.MARKET_DEPTH_BATCH]: '批量五档盘口',
  [Capability.UNIVERSE_LIST]: '标的池列表',
  [Capability.UNIVERSE_GET]: '标的池详情',
  [Capability.UNIVERSE_BATCH]: '批量标的池详情',
  [Capability.EX_FACTOR]: '除权因子（复权基准）',
  [Capability.KLINE_BATCH]: '批量历史 K 线',
  [Capability.QUOTES_UNIVERSE]: '标的池实时行情',
  [Capability.KLINE_INTRADAY]: '单标的当日分钟 K',
  [Capability.INTRADAY_BATCH]: '批量当日分钟 K',
}

/** 引擎复合能力无 provider binding，用静态 scope 兜底（与引擎路由校验一致） */
const ENGINE_COMPOSED_STATIC_SCOPES: Partial<Record<Cap, { markets: string[]; assetClasses: string[] }>> = {
  [Capability.REALTIME_BATCH]: { markets: ['CN', 'US', 'HK', 'CRYPTO'], assetClasses: ['EQUITY', 'CRYPTO_SPOT'] },
  [Capability.INTRADAY_SESSIONS]: { markets: ['CN'], assetClasses: ['EQUITY', 'ETF'] },
}

const SCOPE_MATRIX: Array<[Market, AssetClass]> = [
  ['CN', 'EQUITY'], ['CN', 'INDEX'], ['CN', 'FUND'], ['CN', 'ETF'], ['CN', 'LOF'], ['CN', 'REIT'],
  ['US', 'EQUITY'], ['US', 'INDEX'],
  ['HK', 'EQUITY'], ['HK', 'INDEX'],
  ['JP', 'EQUITY'], ['KR', 'EQUITY'],
  ['CRYPTO', 'CRYPTO_SPOT'], ['CRYPTO', 'CRYPTO_PERP'],
]

interface BindingAggregate {
  markets: Set<string>
  assetClasses: Set<string>
  providers: Set<string>
}

function aggregateBindings(
  registry: DriverRegistry,
  caps: readonly Cap[],
): BindingAggregate {
  const agg: BindingAggregate = { markets: new Set(), assetClasses: new Set(), providers: new Set() }
  for (const cap of caps) {
    for (const [market, assetClass] of SCOPE_MATRIX) {
      for (const driver of registry.getProvidersWithFallback(market, assetClass, cap as Capability)) {
        agg.providers.add(driver.name)
        agg.markets.add(market)
        agg.assetClasses.add(assetClass)
      }
    }
  }
  return agg
}

/**
 * 内置 provider 的「设计归属」— 由各 manifest bindingsFor 静态派生，不经 live registry。
 * 用途：引擎未注册 driver（如 MarketDataEngine(false)）或内置源全部停用时，
 * 目录仍能回答「该能力由哪些数据源承接」；live 聚合非空时以 live 为准。
 * 注意：此处只 import 各 manifest SPEC（纯声明），不经 register.ts，避免模块环。
 */
let designedProvidersCache: Map<string, string[]> | null = null
function designedCapProviders(): Map<string, string[]> {
  if (designedProvidersCache) return designedProvidersCache
  const specs = [
    TONGHUASHUN_SPEC, TUSHARE_SPEC, STOCKINDEX_SPEC, TICKFLOW_SPEC, AKSHARE_SPEC, BINANCE_SPEC, OKX_SPEC,
  ]
  const map = new Map<string, string[]>()
  for (const spec of specs) {
    for (const binding of spec.bindingsFor(spec.defaultPriority, spec.maxConcurrent)) {
      const key = String(binding.capability)
      const list = map.get(key) ?? []
      if (!list.includes(spec.id)) list.push(spec.id)
      map.set(key, list)
    }
  }
  designedProvidersCache = map
  return map
}

/** live 聚合为空时回退到设计归属（按内置名单顺序），仍为空才退到 internal */
function resolveProviders(
  aggProviders: Set<string>,
  caps: readonly Cap[],
): string[] {
  if (aggProviders.size > 0) return [...aggProviders]
  const designed = designedCapProviders()
  const fallback: string[] = []
  for (const cap of caps) {
    for (const providerId of designed.get(String(cap)) ?? []) {
      if (!fallback.includes(providerId)) fallback.push(providerId)
    }
  }
  return fallback.length > 0 ? fallback : ['internal']
}

/** app 界（计算服务）静态声明 — 参数自 Hub 各 handler 的 payload 提炼；无 provider */
export const APP_CAPABILITY_CATALOG: readonly CapabilityCatalogEntry[] = [
  { name: 'instrument_evaluation', scope: 'app', markets: [], assetClasses: [], providers: ['internal'], params: [P('instrument', 'object', true, '标的引用 {market, symbol, assetClass}；A 股可用 code'), P('scorecard', 'string', false, '评分卡名称，默认「综合评估」')], description: '单只标的多因子综合评估打分' },
  { name: 'instrument_strategy_signal', scope: 'app', markets: [], assetClasses: [], providers: ['internal'], params: [P('instrument', 'object', true, '标的引用 {market, symbol, assetClass}')], description: '单只标的策略信号（金叉/死叉、趋势状态等）' },
  { name: 'instrument_indicators', scope: 'app', markets: [], assetClasses: [], providers: ['internal'], params: [P('instrument', 'object', true, '标的引用 {market, symbol, assetClass}')], description: '单只标的技术指标计算（MA/MACD/RSI 等）' },
  { name: 'instrument_strategy_verify', scope: 'app', markets: [], assetClasses: [], providers: ['internal'], params: [P('instrument', 'object', true, '标的引用；A 股可用 code'), P('checkpoints', 'number', false, '回溯验证交易日数，默认 30')], description: '策略信号历史回溯验证（胜率/收益分布）' },
  { name: 'instrument_cyq', scope: 'app', markets: [], assetClasses: [], providers: ['internal'], params: [P('instrument', 'object', true, 'A 股标的引用')], description: 'A 股筹码分布（获利盘比例、成本区）' },
  { name: 'latest_evaluation', scope: 'app', markets: [], assetClasses: [], providers: ['internal'], params: [P('instrument', 'object', true, '标的引用；A 股可用 code')], description: '读取单只标的最近一次评估缓存' },
  { name: 'institution_rating', scope: 'app', markets: [], assetClasses: [], providers: ['internal'], params: [P('instrument', 'object', true, 'A 股标的引用'), P('groups', 'object', false, '机构分组过滤（字符串数组）')], description: '28 家机构风格综合评级与共识（仅 A 股）' },
  { name: 'institution_report', scope: 'app', markets: [], assetClasses: [], providers: ['internal'], params: [P('instrument', 'object', true, 'A 股标的引用'), P('groups', 'object', false, '机构分组过滤（字符串数组）')], description: '机构评级完整文本报告（仅 A 股）' },
  { name: 'portfolio_analysis', scope: 'app', markets: [], assetClasses: [], providers: ['internal'], params: [P('holdings', 'object', true, '持仓数组 [code, weight][]'), P('scorecard', 'string', false, '评分卡名称，默认「综合评估」')], description: '投资组合组合层分析与分散度评估' },
  { name: 'backtest', scope: 'app', markets: [], assetClasses: [], providers: ['internal'], params: [P('codes', 'object', false, '回测股票池（代码数组）'), P('factors', 'object', false, '因子名数组'), P('scorecard', 'string', false, '评分卡名称'), P('periods', 'number', false, '调仓期数，默认 5'), P('forward_days', 'number', false, '每期持有交易日数，默认 20')], description: '因子/评分卡历史回测' },
  { name: 'market_regime', scope: 'app', markets: [], assetClasses: [], providers: ['internal'], params: [P('profile_scope', 'string', false, '市场画像范围：cn（默认）或 us')], description: '市场状态画像（趋势/情绪/风险偏移）' },
  { name: 'trend_brief', scope: 'app', markets: [], assetClasses: [], providers: ['internal'], params: [P('instrument', 'object', true, 'A 股标的引用'), P('holding_cost', 'number', false, '持仓成本，用于盈亏视角')], description: 'A 股个股趋势研判简报' },
]

/** 三界能力目录 — engine.listCapabilities() 的实现体（providers 经 binding 聚合） */
export function buildCapabilityCatalog(registry: DriverRegistry): CapabilityCatalogEntry[] {
  const instrument: CapabilityCatalogEntry[] = (
    Object.entries(INSTRUMENT_CAPABILITY_META) as Array<[InstrumentDataCapability, InstrumentCapMeta]>
  ).map(([name, meta]) => {
    const agg = aggregateBindings(registry, meta.route)
    return {
      name,
      scope: 'instrument' as const,
      markets: [...agg.markets],
      assetClasses: [...agg.assetClasses],
      params: meta.params ?? [],
      providers: resolveProviders(agg.providers, meta.route),
      description: meta.desc,
      ...(meta.ttl ? { cacheTtl: watchlistCacheTtl(meta.ttl) } : {}),
    }
  })

  const market: CapabilityCatalogEntry[] = MARKET_LEVEL_CAPABILITIES.map(capability => {
    const composed = ENGINE_COMPOSED_STATIC_SCOPES[capability]
    const agg = aggregateBindings(registry, [capability])
    return {
      name: String(capability),
      scope: 'market' as const,
      markets: composed ? composed.markets : [...agg.markets],
      assetClasses: composed ? composed.assetClasses : [...agg.assetClasses],
      params: MARKET_CAPABILITY_PARAMS[capability] ?? [],
      providers: composed ? ['internal'] : resolveProviders(agg.providers, [capability]),
      description: MARKET_CAPABILITY_DESC[capability] ?? `市场级标准能力 ${String(capability)}`,
    }
  })

  return [...instrument, ...market, ...APP_CAPABILITY_CATALOG]
}
