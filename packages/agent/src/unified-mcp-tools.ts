/** 跨市场 InstrumentRef 统一 MCP 工具 — 经 ResearchHub instrument_* 路由 */

import { normalizeInstrumentHubParams } from '@opptrix/shared'

export interface JsonSchema {
  type: 'object'
  properties: Record<string, {
    type: string
    description?: string
    items?: unknown
    default?: unknown
    properties?: Record<string, { type: string; description?: string }>
    required?: string[]
  }>
  required?: string[]
}

export interface UnifiedInstrumentToolDef {
  name: string
  description: string
  category: string
  parameters: JsonSchema
  handler: (args: Record<string, unknown>) => Promise<unknown>
}

const INSTRUMENT_OBJECT_PROPERTIES: Record<string, { type: string; description?: string }> = {
  market: {
    type: 'string',
    description: '市场：CN | US | HK | CRYPTO（JP/KR 暂未接入行情）',
  },
  symbol: {
    type: 'string',
    description: '裸标的代码（如 000009、AAPL）；A 股须配合 exchange；勿填 CN:SZ.xxx 命名空间',
  },
  assetClass: {
    type: 'string',
    description: '可选资产类型：EQUITY | ETF | INDEX | FUND | CRYPTO_SPOT | CRYPTO_PERP（通常由 search 命中提供，勿自行推断指数）',
  },
  quote: {
    type: 'string',
    description: 'Crypto 计价币，如 USDT（CRYPTO 市场常用）',
  },
  exchange: {
    type: 'string',
    description: 'A 股交易所 SH | SZ | BJ（消歧同码异名，必填）',
  },
  code: {
    type: 'string',
    description: 'Stock-index 命名空间（推荐）：CN:SZ.000009、US:AAPL、HK:00700；引擎自动解析',
  },
}

/** 可复用的 InstrumentRef 参数字段：嵌套 instrument 对象，或平铺 market + symbol */
export const INSTRUMENT_REF_SCHEMA: JsonSchema['properties'] = {
  instrument: {
    type: 'object',
    description: 'InstrumentRef（推荐）：含 market、symbol、exchange；可由 MCP 搜码/问数或本地 search_instruments 得到，非唯一来源',
    properties: INSTRUMENT_OBJECT_PROPERTIES,
    required: ['market', 'symbol'],
  },
  code: INSTRUMENT_OBJECT_PROPERTIES.code,
  market: {
    type: 'string',
    description: '平铺写法：市场 CN | US | HK | CRYPTO（与 instrument/code 二选一）',
  },
  symbol: {
    type: 'string',
    description: '平铺写法：裸代码 + exchange（与 instrument/code 二选一）',
  },
  assetClass: INSTRUMENT_OBJECT_PROPERTIES.assetClass,
  quote: INSTRUMENT_OBJECT_PROPERTIES.quote,
  exchange: INSTRUMENT_OBJECT_PROPERTIES.exchange,
}

function resolveInstrumentParams(args: Record<string, unknown>): Record<string, unknown> {
  return normalizeInstrumentHubParams(args)
}

function legacyCodeFrom(args: Record<string, unknown>): string | undefined {
  if (args.code != null) return String(args.code)
  if (args.instrument && typeof args.instrument === 'object') {
    const sym = (args.instrument as Record<string, unknown>).symbol
    if (sym != null) return String(sym)
  }
  if (args.symbol != null) return String(args.symbol)
  return undefined
}

export const UNIFIED_INSTRUMENT_TOOL_NAMES = [
  'search_instruments',
  'get_instrument_capabilities',
  'get_instrument_snapshot',
  'get_instrument_quotes',
  'batch_instrument_snapshots',
  'get_instrument_institution_rating',
  'get_instrument_institution_report',
] as const

export const UNIFIED_MINING_INSTRUMENT_TOOLS = [
  'get_instrument_capabilities',
  'get_instrument_snapshot',
  'get_instrument_quotes',
] as const

export function CHAT_MCP_TOOL_NAMES(registry: { list: () => Array<{ name: string }> }): readonly string[] {
  return registry.list().map(t => t.name)
}

type DispatchFn = (feature: string, params: Record<string, unknown>) => Promise<unknown>
type SchemaFn = (properties: JsonSchema['properties'], required?: string[]) => JsonSchema

export function buildUnifiedInstrumentTools(
  d: DispatchFn,
  S: SchemaFn,
): UnifiedInstrumentToolDef[] {
  return [
    {
      name: 'search_instruments',
      category: '跨市场标的',
      description: '按代码或名称在线搜索标的（本地名录补充；有 MCP 搜码/问数时先远程）；可用 markets 过滤 CN/US/HK/CRYPTO',
      parameters: S({
        keyword: { type: 'string', description: '搜索关键词' },
        markets: { type: 'array', description: '可选市场过滤，如 CN、US、HK、CRYPTO' },
        limit: { type: 'number', description: '返回条数，默认 30，最大 50' },
      }, ['keyword']),
      handler: (a) => d('instrument_search', a),
    },
    {
      name: 'get_instrument_capabilities',
      category: '跨市场标的',
      description: '查询标的可用能力（快照、行情、K 线、评估等）；不熟悉的市场或代码格式时请先调用',
      parameters: S({ ...INSTRUMENT_REF_SCHEMA }),
      handler: (a) => d('instrument_capabilities', resolveInstrumentParams(a)),
    },
    {
      name: 'get_instrument_snapshot',
      category: '跨市场标的',
      description: '获取单只标的聚合快照（概况、行情、关键指标）；跨市场统一入口，使用 InstrumentRef 指定标的',
      parameters: S({ ...INSTRUMENT_REF_SCHEMA }),
      handler: (a) => d('instrument_snapshot', resolveInstrumentParams(a)),
    },
    {
      name: 'get_instrument_profile',
      category: '基本面',
      description: '公司/标的概况事实表（主业、行业、概念、上市信息等）；核实「做什么的」时优先于 snapshot 碎片',
      parameters: S({ ...INSTRUMENT_REF_SCHEMA }),
      handler: (a) => d('instrument_profile', resolveInstrumentParams(a)),
    },
    {
      name: 'get_instrument_financials',
      category: '基本面',
      description: '财务摘要多期事实表（营收/利润/ROE/同比等）；核实增速与质量时使用，勿用 evaluate 黑盒代替。要资产负债/现金流明细请改用对应工具',
      parameters: S({
        ...INSTRUMENT_REF_SCHEMA,
        report_type: {
          type: 'string',
          description: '报告类型：all（默认，多期）| annual | quarter',
        },
        report_date: {
          type: 'string',
          description: '可选，报告期 YYYY-MM-DD；空则返回可用最近若干期',
        },
      }),
      handler: (a) => d('instrument_financials', {
        ...resolveInstrumentParams(a),
        report_type: a.report_type ?? 'all',
        report_date: a.report_date ?? '',
      }),
    },
    {
      name: 'get_instrument_balance_sheet',
      category: '基本面',
      description: '资产负债表多期事实表（经 queryInstrumentData balance_sheet）；核实总资产/负债/权益时优先于摘要',
      parameters: S({
        ...INSTRUMENT_REF_SCHEMA,
        report_date: {
          type: 'string',
          description: '可选，过滤报告期 YYYY-MM-DD（返回该日及之后）',
        },
      }),
      handler: (a) => d('instrument_balance_sheet', {
        ...resolveInstrumentParams(a),
        report_date: a.report_date ?? '',
      }),
    },
    {
      name: 'get_instrument_cash_flow',
      category: '基本面',
      description: '现金流量表多期事实表（经 queryInstrumentData cash_flow）；核实经营/筹资/投资现金流时使用',
      parameters: S({
        ...INSTRUMENT_REF_SCHEMA,
        report_date: {
          type: 'string',
          description: '可选，过滤报告期 YYYY-MM-DD（返回该日及之后）',
        },
      }),
      handler: (a) => d('instrument_cash_flow', {
        ...resolveInstrumentParams(a),
        report_date: a.report_date ?? '',
      }),
    },
    {
      name: 'get_instrument_income_statement',
      category: '基本面',
      description: '利润表多期事实表（经 queryInstrumentData income_statement）；核实营收/成本/费用明细时优先于财务摘要',
      parameters: S({
        ...INSTRUMENT_REF_SCHEMA,
        report_date: {
          type: 'string',
          description: '可选，过滤报告期 YYYY-MM-DD（返回该日及之后）',
        },
      }),
      handler: (a) => d('instrument_income_statement', {
        ...resolveInstrumentParams(a),
        report_date: a.report_date ?? '',
      }),
    },
    {
      name: 'get_instrument_financial_indicators',
      category: '基本面',
      description: '财务指标树（成长/盈利/偿债/营运等，同花顺富耀）；须 report 如 2024Q3；标准三表明细请用专用工具',
      parameters: S({
        ...INSTRUMENT_REF_SCHEMA,
        report: {
          type: 'string',
          description: '报告期，如 2024Q3 或 2024（必填）',
        },
      }, ['report']),
      handler: (a) => d('instrument_financial_indicators', {
        ...resolveInstrumentParams(a),
        report: a.report ?? a.report_period,
      }),
    },
    {
      name: 'get_instrument_shareholders',
      category: '基本面',
      description: '股东结构事实表（十大股东/股本等）；核实股权集中度时使用。季报机构持仓（基金/QFII 等）改用 get_instrument_institution_holdings',
      parameters: S({
        ...INSTRUMENT_REF_SCHEMA,
        report_date: {
          type: 'string',
          description: '可选，报告期 YYYY-MM-DD',
        },
      }),
      handler: (a) => d('instrument_shareholders', {
        ...resolveInstrumentParams(a),
        report_date: a.report_date,
      }),
    },
    {
      name: 'get_instrument_institution_holdings',
      category: '基本面',
      description:
        'A 股季报机构持仓（东财 zlsj）：一览汇总 / 分类型明细（基金·QFII·社保·券商·保险·信托）/ 报告期列表。'
        + '与十大股东 get_instrument_shareholders 不同',
      parameters: S({
        ...INSTRUMENT_REF_SCHEMA,
        scope: {
          type: 'string',
          description: 'overview（默认一览）| detail（Tab 明细）| dates（报告期）',
        },
        org_type: {
          type: 'string',
          description: 'detail 时：fund|qfii|social|broker|insurance|trust|all；也可用中文「基金」等',
        },
        report_date: {
          type: 'string',
          description: '报告期 YYYY-MM-DD，空则最新；可用 scope=dates 先查',
        },
        page: { type: 'number', description: 'detail 页码，默认 1' },
        page_size: { type: 'number', description: 'detail 每页条数，默认 30' },
        limit: { type: 'number', description: 'dates 时返回条数' },
      }),
      handler: (a) => d('instrument_institution_holdings', {
        ...resolveInstrumentParams(a),
        scope: a.scope ?? 'overview',
        org_type: a.org_type ?? a.orgType ?? a.kind,
        report_date: a.report_date ?? a.reportDate,
        page: a.page,
        page_size: a.page_size,
        limit: a.limit,
      }),
    },
    {
      name: 'get_instrument_dividend',
      category: '基本面',
      description: '分红派息历史事实表；核实分红政策与历史派息时使用',
      parameters: S({
        ...INSTRUMENT_REF_SCHEMA,
        page: { type: 'number', description: '可选，页码（港股等分页源）' },
        page_size: { type: 'number', description: '可选，每页条数' },
      }),
      handler: (a) => d('instrument_dividend', {
        ...resolveInstrumentParams(a),
        page: a.page,
        page_size: a.page_size,
      }),
    },
    {
      name: 'get_sector_constituents',
      category: '行业板块',
      description: '板块或行业成分股列表；须先有 board_key 或 industry_code',
      parameters: S({
        market: { type: 'string', description: '市场 CN|US|HK，默认 CN' },
        board_key: { type: 'string', description: '板块键，如 hsj、cyb' },
        industry_code: { type: 'string', description: '行业代码（如申万）' },
        page: { type: 'number', description: '页码，默认 1' },
        page_size: { type: 'number', description: '每页条数，默认 50，最大 100' },
      }),
      handler: (a) => d('sector_constituents', {
        market: a.market ?? 'CN',
        board_key: a.board_key,
        industry_code: a.industry_code,
        page: a.page ?? 1,
        page_size: a.page_size ?? 50,
      }),
    },
    {
      name: 'get_index_constituents',
      category: '行业板块',
      description: '指数/同花顺板块成分股；沪深300 等与同花顺概念指数；优先标准 INDEX_CONST，回退同花顺',
      parameters: S({
        index_code: { type: 'string', description: '指数或板块代码，如 000300、885338.TI' },
        code: { type: 'string', description: '同 index_code' },
      }),
      handler: (a) => d('index_constituents', {
        index_code: a.index_code ?? a.code ?? a.symbol,
      }),
    },
    {
      name: 'get_etf_profile',
      category: 'ETF',
      description: 'ETF 档案事实表（跟踪指数、费率、规模等）；净值用 get_etf_nav，成分用 get_etf_holdings',
      parameters: S({ ...INSTRUMENT_REF_SCHEMA }),
      handler: (a) => d('etf_profile', resolveInstrumentParams(a)),
    },
    {
      name: 'get_fund_list',
      category: '公募基金',
      description: '公募基金列表或关键词检索；单码查询返回匹配基金',
      parameters: S({
        keyword: { type: 'string', description: '基金代码或名称关键词，可选' },
        code: { type: 'string', description: '同 keyword' },
      }),
      handler: (a) => d('fund_list', { code: a.code ?? a.keyword ?? '' }),
    },
    {
      name: 'get_fund_profile',
      category: '公募基金',
      description: '公募基金档案（类型、经理、规模、费率等）；须 assetClass=FUND / CN:PF 命名空间',
      parameters: S({ ...INSTRUMENT_REF_SCHEMA }),
      handler: (a) => d('fund_profile', resolveInstrumentParams(a)),
    },
    {
      name: 'get_fund_nav',
      category: '公募基金',
      description: '公募基金历史净值序列；勿用实时价代替净值',
      parameters: S({ ...INSTRUMENT_REF_SCHEMA }),
      handler: (a) => d('fund_nav', resolveInstrumentParams(a)),
    },
    {
      name: 'get_fund_holdings',
      category: '公募基金',
      description: '公募基金季报重仓股/资产配置',
      parameters: S({ ...INSTRUMENT_REF_SCHEMA }),
      handler: (a) => d('fund_holdings', resolveInstrumentParams(a)),
    },
    {
      name: 'get_market_session',
      category: '市场资金',
      description: '轻量交易时段状态（是否盘中/盘前）；非完整节假日日历，精确交易日走 provider_ext',
      parameters: S({
        market: { type: 'string', description: '市场 CN|US|HK，默认 CN' },
      }),
      handler: (a) => d('market_session', { market: a.market ?? 'CN' }),
    },
    {
      name: 'get_trade_calendar',
      category: '市场资金',
      description: 'A 股交易日历（按年交易日列表）；精确休市日查询用本工具，勿用 get_market_session 代替',
      parameters: S({
        year: { type: 'number', description: '年份，默认当年' },
      }),
      handler: (a) => d('trade_calendar', { year: a.year }),
    },
    {
      name: 'get_instrument_quotes',
      category: '跨市场标的',
      description: '批量获取多只标的最新价、涨跌幅等实时/近收盘行情；instruments 为 InstrumentRef 数组',
      parameters: S({
        instruments: {
          type: 'array',
          description: 'InstrumentRef 数组，每项含 market、symbol（Crypto 需 quote）',
          items: {
            type: 'object',
            properties: INSTRUMENT_OBJECT_PROPERTIES,
            required: ['market', 'symbol'],
          },
        },
      }, ['instruments']),
      handler: (a) => d('instrument_quotes', { instruments: a.instruments }),
    },
    {
      name: 'batch_instrument_snapshots',
      category: '跨市场标的',
      description: '批量获取已有候选标的的在线聚合快照；instruments 数组或 codes+market',
      parameters: S({
        instruments: {
          type: 'array',
          description: 'InstrumentRef 数组，每项含 market、symbol',
          items: {
            type: 'object',
            properties: INSTRUMENT_OBJECT_PROPERTIES,
            required: ['market', 'symbol'],
          },
        },
        codes: {
          type: 'array',
          description: '兼容写法：标的代码列表（须配合 market，默认 CN）',
        },
        market: {
          type: 'string',
          description: '与 codes 配合使用，默认 CN',
        },
      }),
      handler: (a) => {
        if (Array.isArray(a.instruments) && a.instruments.length) {
          return d('instrument_batch_snapshots', { instruments: a.instruments })
        }
        return d('instrument_batch_snapshots', {
          codes: a.codes,
          market: a.market ?? 'CN',
        })
      },
    },
    {
      name: 'get_instrument_institution_rating',
      category: '跨市场标的',
      description: '28 家机构风格综合评级与共识；仅 A 股支持，使用 InstrumentRef',
      parameters: S({
        ...INSTRUMENT_REF_SCHEMA,
        code: { type: 'string', description: '兼容旧写法：A 股 6 位代码（推荐改用 instrument 或 market+symbol）' },
        groups: { type: 'array', description: '可选机构分组过滤' },
      }),
      handler: (a) => d('instrument_institution_rating', {
        ...resolveInstrumentParams({ ...a, code: legacyCodeFrom(a) }),
        groups: a.groups,
      }),
    },
    {
      name: 'get_instrument_institution_report',
      category: '跨市场标的',
      description: '机构评级完整文本报告；仅 A 股支持，使用 InstrumentRef',
      parameters: S({
        ...INSTRUMENT_REF_SCHEMA,
        code: { type: 'string', description: '兼容旧写法：A 股 6 位代码（推荐改用 instrument 或 market+symbol）' },
        groups: { type: 'array', description: '可选机构分组过滤' },
      }),
      handler: (a) => d('instrument_institution_report', {
        ...resolveInstrumentParams({ ...a, code: legacyCodeFrom(a) }),
        groups: a.groups,
      }),
    },
    {
      name: 'list_enabled_providers',
      category: '数据源扩展',
      description: '查询已启用的数据源（provider_id、名称、优先级、能力摘要）',
      parameters: S({}),
      handler: () => d('provider_list', {}),
    },
    {
      name: 'query_market_capabilities',
      category: '数据源扩展',
      description: '探查系统能力目录（三界：market 市场级 42 项 / instrument 标的级 35 项 / app 应用计算服务 12 项），每项含 name/scope/markets/params 参数定义/providers 可用数据源；'
        + 'query_market_capability 的 capability 与 args 顺序均以本目录为准',
      parameters: S({}),
      handler: (a) => d('market_capabilities', {}),
    },
    {
      name: 'query_market_capability',
      category: '数据源扩展',
      description: '执行系统登记的市场级标准能力；须先用 query_market_capabilities 确认 capability 与参数顺序',
      parameters: S({
        capability: {
          type: 'string',
          description: 'capability 名（目录与参数顺序见 query_market_capabilities 返回）',
        },
        args: {
          type: 'array',
          description: '参数 JSON 数组，顺序与 query_market_capabilities 目录中该能力的参数定义一致；元素可为 string/number/boolean/对象',
          items: {},
        },
        market: {
          type: 'string',
          description: '可选，市场（默认 CN）',
        },
        asset_class: {
          type: 'string',
          description: '可选，标的类型（默认 EQUITY；指数用 INDEX，基金用 FUND）',
        },
      }, ['capability', 'args']),
      handler: (a) => d('market_capability_query', {
        capability: a.capability,
        args: a.args ?? [],
        ...(a.market != null ? { market: a.market } : {}),
        ...(a.asset_class != null ? { asset_class: a.asset_class } : {}),
      }),
    },
  ]
}
