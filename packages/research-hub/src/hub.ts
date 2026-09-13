import {   MarketDataEngine, computeIndicators, computeLatestChipProfile, computeChipDistribution, isMissingLivePrice, normalizeCode, normalizePreOpenRealtimeQuote,
  parseCryptoPair,
  pickIntradaySession, parseStockMarket, resolveMarket, resolveStockMarketCode,
  loadTushareConfig, saveTushareConfig, isBseCode, isCnEtfCode,
  wireRegistryMethodArgs,
  cnTodayString, shouldPreferTodayIntraday, type StockMarket,
  cnMarketNow, isCnMarketOpen, isCnTradingWeekday, isCnBeforeMarketOpen, isCnAfterMarketClose,
  type NewsItem, type MoneyFlow, type Dividend,
  crossMarketChartTimeZone,
  isCrossMarketTradingDay,
  resolveCrossMarketKlineEngineQuery,
  crossMarketFiveDayMinuteCount,
  resampleOhlcKlines,
  watchlistItemKey,
  isCnPublicFundRef,
} from '@opptrix/a-stock-layer'
import { resolveProvidersDir } from '@opptrix/shared'
import type { IntradayTrendFetchResult, IntradayTrendSession, GlobalIndex, LimitUpDown } from '@opptrix/a-stock-layer'
import type { FinancialSummary, StockKline, Market, AssetClass } from '@opptrix/shared'
import { ConsolidatedEngine, formatInstitutionReport } from '@opptrix/institutions'
import { Capability } from '@opptrix/market-data-core'
import { runWatchlistOnlineDisambiguationPass } from './watchlist-disambiguate.js'
import {
  ok, fail, computeMarketRegime, computeMaPositionPct, computePricePercentile,
  computeTurnoverVs20d, computeHv20Pct, momentumRegimeInputsFromKlines,
  type ResearchResult,
  resolveRegimeStrategyIds,
  ETF_REGIME_DETAIL,
  type MarketRegimeScope,
  type DiscoverStrategyProfile,
  resolveInstrumentFromParams,
  resolveCnInstrumentRef,
  normalizeInstrumentHubParams,
  instrumentRefsFromList,
  normalizeInstrumentRef,
  instrumentHubCode,
  instrumentRefKey,
  instrumentDisplayCode,
  buildInstrumentNamespace,
  coerceInstrumentQuoteRow,
  resolveInstrumentQuotePrice,
  resolveInstrumentQuotePreClose,
  parseCanonicalInstrumentInput,
  inferCnAssetClassFromSymbol,
  type InstrumentRef,
  type InstrumentHubCapability,
  UI_CACHE_TTL_MS,
} from '@opptrix/shared'
import { canonicalHkSymbol } from '@opptrix/shared/instrument-symbol'
import { serializeInstitutionData } from './serialize.js'
import {
  classifyQuoteFailureMessage,
  type QuoteFailedReason,
} from './quote-failure.js'
import {
  newsArticleDetail,
  newsArticlesList,
  newsCenterStatus,
  newsGroupCreate,
  newsGroupDelete,
  newsGroupUpdate,
  newsGroupsList,
  newsSourceAdd,
  newsSourceDelete,
  newsSourceMoveGroup,
  newsSourceValidate,
  newsSourcesImport,
  newsSourcesList,
} from './news-hub.js'
import { noticeContent } from './notice-content-hub.js'
import {
  routeInstrumentCapabilities,
  routeInstrumentChart,
  routeInstrumentInstitutionRating,
  routeInstrumentInstitutionReport,
  routeInstrumentQuotes,
  routeInstrumentQuote,
  routeInstrumentSearch,
  routeInstrumentSnapshot,
  resolveQuoteRefs,
  type InstrumentRouteHandlers,
} from './instrument-router.js'
import { mergeFundDetailParts } from './fund-detail.js'
import {
  createNoopHubDiskCache,
  instrumentQuotesInflightKey,
  normalizeMarketDynamicsMarket,
  type HubDiskCache,
  type MarketDynamicsCacheMarket,
} from './hub-disk-cache.js'
import {
  collectParallelCnBatchItems,
  routeInstrumentBatchSnapshots,
  type InstrumentBatchRouteHandlers,
} from './instrument-batch-router.js'
import {
  dedupeStockNewsItems,
  enrichDetailProfileFromQuote,
  enrichShareholderView,
  holderHistoryFromRows,
  mergeDetailQuoteRows,
  mergeStockProfileRows,
  normalizeShareholderPayload,
} from './stock-detail-normalize.js'
import {
  mapCnHotStockItems,
  mapCnLimitBreakItems,
  mapCnLimitUpItems,
  mapCnSkyrocketItems,
  parseCnLimitLadder,
} from './market-emotion-map.js'
import {
  dedupeThsCatalogEntries,
  indexSnapshotRows,
  majorCnIndexThscode,
  mapMajorCnIndexQuote,
  mapThsIndexSnapshotToQuote,
  mergeConstituentQuoteRow,
  parseConstituentStockCode,
  parseThsIndexCatalogRow,
  rankSectorIndexQuotes,
  sortConstituentRowsByChangePct,
  type ThsIndexCatalogEntry,
  type ThsSectorTag,
} from './market-sector-map.js'
import {
  buildCrossMarketDetailPayload,
  mergeCrossMarketQuote,
  quoteFromRecentKlines,
  normalizeCrossMarketArticlesFromNews,
  normalizeCrossMarketDividends,
  normalizeCrossMarketFinancialHistory,
  normalizeCrossMarketNoticesFromNews,
  normalizeCrossMarketProfile,
  normalizeCrossMarketShareholdersFromRows,
  normalizeHkFinancialHistory,
  normalizeHkDividends,
  normalizeUsFinancialHistory,
  normalizeUsShareholders,
} from './cross-market-detail.js'
import { searchInstrumentsUnified } from './instrument-search-unified.js'

function cryptoRefFromPair(pair: string): import('@opptrix/shared').InstrumentRef {
  const p = parseCryptoPair(pair)
  if (p) {
    return { market: 'CRYPTO', assetClass: 'CRYPTO_SPOT', symbol: p.base, quote: p.quote }
  }
  return { market: 'CRYPTO', assetClass: 'CRYPTO_SPOT', symbol: pair, quote: 'USDT' }
}

function instrumentRefFromWatchlistItem(
  item: import('@opptrix/a-stock-layer').WatchlistItem,
): InstrumentRef | null {
  if (item.instrument?.market && item.instrument.symbol) {
    return normalizeInstrumentRef(item.instrument)
  }
  return parseCanonicalInstrumentInput(String(item.code ?? ''))
}

function instrumentQueryError(r: { success: boolean }, fallback: string): string {
  if ('error' in r && r.error) return String(r.error)
  return fallback
}

function instrumentQueryData<T>(r: { success: boolean }): T | undefined {
  if (!r.success || !('data' in r)) return undefined
  return r.data as T
}

interface WatchlistRadarItem {
  code: string
  name: string
  pe: number | null
  pb: number | null
  main_net: number | null
  flow_date: string | null
}

/** Unified research hub — single entry for feature dispatch */
export class ResearchHub {
  readonly de = new MarketDataEngine()
  readonly institutions = new ConsolidatedEngine(this.de)
  private readonly diskCache: HubDiskCache

  constructor(opts?: { diskCache?: HubDiskCache }) {
    this.diskCache = opts?.diskCache ?? createNoopHubDiskCache()
  }
  private readonly stockNameCache = new Map<string, string>()
  /** 进程内最近一次成功报价 — live 失败时回退，避免关注列表部分无价 */
  private readonly lastInstrumentQuotes = new Map<string, Record<string, unknown>>()
  /** 同花顺板块 catalog — 慢变数据，降 market_dynamics 轮询压力 */
  private readonly thsSectorCatalogCache = new Map<
    ThsSectorTag,
    { fetchedAt: number; entries: ThsIndexCatalogEntry[] }
  >()
  /** 历史热榜档期涨跌 — 过去交易日永久、当日短 TTL */
  private readonly cnHotHistoryQuoteCache = new Map<
    string,
    {
      fetchedAt: number
      quotes: Map<string, { price: number | null; change_pct: number | null; change_amt: number | null }>
    }
  >()
  /** A 股 market_dynamics 短 TTL — 去重轮询内的重复 bulk；磁盘缓存可即时返回 */
  private marketDynamicsMemCache = new Map<
    MarketDynamicsCacheMarket,
    { at: number; payload: ResearchResult }
  >()
  private marketDynamicsRefreshInflight = new Map<MarketDynamicsCacheMarket, Promise<ResearchResult>>()

  /** 右侧关注行情 / 组合汇总 — 磁盘缓存即时返回 */
  private portfolioSummaryMemCache: { at: number; payload: ResearchResult } | null = null
  private portfolioSummaryRefreshInflight: Promise<ResearchResult> | null = null
  private instrumentQuotesRefreshInflight = new Map<string, Promise<ResearchResult>>()

  private static readonly THS_SECTOR_CATALOG_TTL_MS = 15 * 60 * 1000
  private static readonly MARKET_DYNAMICS_CN_TTL_MS = UI_CACHE_TTL_MS.marketDynamicsCn
  private static readonly HOT_HISTORY_TODAY_TTL_MS = 5 * 60 * 1000

  async dispatch(feature: string, params: Record<string, unknown>): Promise<ResearchResult> {
    const t0 = Date.now()
    try {
      switch (feature) {
        case 'institution_rating':
          return await this.dispatchInstrumentCapability('institution_rating', normalizeInstrumentHubParams(params), t0)
        case 'institution_report':
          return await this.dispatchInstrumentCapability('institution_report', normalizeInstrumentHubParams(params), t0)
        case 'market_dynamics': return await this.marketDynamics(t0, params)
        case 'search_stocks':
          return await this.dispatchInstrumentCapability('search', { keyword: params.keyword, ...params }, t0)
        case 'stock_quotes':
          return await this.instrumentQuotes(params, t0)
        case 'watchlist_radar': return this.watchlistRadar(params.codes as string[] | undefined, t0)
        case 'watchlist_list': return this.watchlistList(t0)
        case 'watchlist_save': return this.watchlistSave(params, t0)
        case 'watchlist_groups_get': return this.watchlistGroupsGet(t0)
        case 'watchlist_groups_save': return this.watchlistGroupsSave(params, t0)
        case 'market_data_packs': return this.marketDataPacks(t0)
        case 'market_data_packs_save': return this.marketDataPacksSave(params, t0)
        case 'market_regime': return this.marketRegime(params, t0)
        case 'batch_stock_snapshots': return await this.instrumentBatchSnapshots(params, t0)
        case 'instrument_batch_snapshots': return await this.instrumentBatchSnapshots(params, t0)
        case 'instrument_institution_rating': return await this.instrumentInstitutionRating(params, t0)
        case 'instrument_institution_report': return await this.instrumentInstitutionReport(params, t0)
        case 'stock_kline':
          return await this.instrumentChart(normalizeInstrumentHubParams({ ...params, period: 'daily' }), t0)
        case 'stock_chart':
          return await this.instrumentChart(normalizeInstrumentHubParams(params), t0)
        case 'stock_detail':
          return await this.instrumentSnapshot(normalizeInstrumentHubParams(params), t0)
        case 'portfolio_trades': return this.portfolioTrades(String(params.code ?? ''), params.market != null ? String(params.market) : undefined, t0)
        case 'portfolio_holdings': return this.portfolioHoldings(t0)
        case 'portfolio_summary': return this.portfolioSummary(t0, params)
        case 'portfolio_fee_global': return this.portfolioFeeGlobal(t0)
        case 'portfolio_fee_global_save': return this.portfolioFeeGlobalSave(params, t0)
        case 'portfolio_fee_instrument': return this.portfolioFeeInstrument(String(params.code ?? ''), params.market != null ? String(params.market) : undefined, t0)
        case 'portfolio_fee_instrument_save': return this.portfolioFeeInstrumentSave(params, t0)
        case 'news_center_status': return newsCenterStatus(t0)
        case 'news_groups_list': return newsGroupsList(t0)
        case 'news_sources_list': return newsSourcesList(t0)
        case 'news_articles_list': return newsArticlesList(params, t0)
        case 'news_article_detail': return await newsArticleDetail(params, t0)
        case 'news_source_add': return await newsSourceAdd(params, t0)
        case 'news_source_delete': return newsSourceDelete(params, t0)
        case 'news_sources_import': return await newsSourcesImport(params, t0)
        case 'news_group_create': return newsGroupCreate(params, t0)
        case 'news_group_update': return newsGroupUpdate(params, t0)
        case 'news_group_delete': return newsGroupDelete(params, t0)
        case 'news_source_move_group': return newsSourceMoveGroup(params, t0)
        case 'news_source_validate': return await newsSourceValidate(params, t0)
        case 'notice_content':
        case 'instrument_notice_content':
          return await noticeContent(params, t0)
        case 'tushare_config': return ok(this.de.providerCatalog.tusharePublicLegacy(), 'Tushare 配置', t0)
        case 'tushare_config_save': return this.tushareConfigSave(params, t0)
        case 'tushare_test': return this.tushareTest(params, t0)
        case 'provider_list': return ok(this.de.listProviders(), '数据源列表', t0)
        case 'provider_config': return this.providerConfig(params, t0)
        case 'provider_config_save': return this.providerConfigSave(params, t0)
        case 'provider_order_save': return this.providerOrderSave(params, t0)
        case 'provider_test': return this.providerTest(params, t0)
        case 'provider_binding_overrides': return this.providerBindingOverrides(params, t0)
        case 'provider_binding_override_save': return this.providerBindingOverrideSave(params, t0)
        case 'provider_rescan': return await this.providerRescan(t0)
        case 'provider_uninstall': return await this.providerUninstall(params, t0)
        case 'provider_reload': return await this.providerReload(params, t0)
        case 'provider_installed_list': return this.providerInstalledList(t0)
        case 'etf_list': return await this.etfList(params, t0)
        case 'etf_snapshot': {
          const ref = resolveInstrumentFromParams(params)
          if (!ref) return fail('instrument 或 code 必填', t0)
          return await this.dispatchInstrumentCapability('snapshot', { ...params, instrument: ref }, t0)
        }
        case 'etf_nav': return await this.queryEtfInstrumentData(params, 'etf_nav', t0)
        case 'etf_holdings': return await this.queryEtfInstrumentData(params, 'etf_holdings', t0)
        case 'etf_profile': return await this.queryEtfInstrumentData(params, 'etf_profile', t0)
        case 'fund_list': return await this.fundList(params, t0)
        case 'fund_snapshot': {
          const ref = resolveInstrumentFromParams(params)
          if (!ref) return fail('instrument 或 code 必填', t0)
          return await this.queryFundInstrumentData({ ...params, instrument: ref }, 'fund_snapshot', t0)
        }
        case 'fund_nav': return await this.queryFundInstrumentData(params, 'fund_nav', t0)
        case 'fund_holdings': return await this.queryFundInstrumentData(params, 'fund_holdings', t0)
        case 'fund_profile': return await this.queryFundInstrumentData(params, 'fund_profile', t0)
        case 'fund_detail': return await this.fundDetail(params, t0)
        case 'local_fund_list': return await this.localFundList(params, t0)
        case 'local_fund_nav': return await this.localFundNav(String(params.code ?? ''), params, t0)
        case 'local_fund_holdings': return await this.localFundHoldings(String(params.code ?? ''), params, t0)
        case 'sector_constituents': return await this.sectorConstituents(params, t0)
        case 'market_session': return await this.marketSession(params, t0)
        case 'local_etf_list': return await this.etfList(params, t0)
        case 'local_etf_nav': return await this.queryEtfInstrumentData(params, 'etf_nav', t0)
        case 'local_etf_holdings': return await this.queryEtfInstrumentData(params, 'etf_holdings', t0)
        case 'search_local_instruments':
        case 'instrument_search': return await this.instrumentSearch(params, t0)
        case 'instrument_resolve_names': return await this.instrumentResolveNames(params, t0)
        case 'local_instruments_summary':
          return fail('本地标的库索引已下线，请使用 instrument_search', t0)
        case 'instrument_snapshot': return await this.instrumentSnapshot(params, t0)
        case 'instrument_quotes': return await this.instrumentQuotes(params, t0)
        case 'instrument_quote': return await this.instrumentQuote(params, t0)
        case 'instrument_chart': return await this.instrumentChart(params, t0)
        case 'instrument_capabilities': return this.instrumentCapabilities(params, t0)
        case 'instrument_profile': return await this.queryInstrumentStandardData(params, 'profile', t0)
        case 'instrument_financials': return await this.queryInstrumentStandardData(params, 'financials', t0)
        case 'instrument_balance_sheet': return await this.queryInstrumentStandardData(params, 'balance_sheet', t0)
        case 'instrument_cash_flow': return await this.queryInstrumentStandardData(params, 'cash_flow', t0)
        case 'instrument_income_statement': return await this.queryInstrumentStandardData(params, 'income_statement', t0)
        case 'instrument_shareholders': return await this.queryInstrumentStandardData(params, 'shareholders', t0)
        case 'instrument_dividend': return await this.queryInstrumentStandardData(params, 'dividend', t0)
        case 'instrument_institution_holdings': return await this.instrumentInstitutionHoldings(params, t0)
        case 'instrument_financial_indicators': return await this.instrumentFinancialIndicators(params, t0)
        case 'trade_calendar': return this.tradeCalendar(params, t0)
        case 'index_constituents': return this.indexConstituents(params, t0)
        case 'local_us_screen': return this.localUsScreen(params, t0)
        case 'local_crypto_screen': return this.localCryptoScreen(params, t0)
        case 'local_jp_screen': return this.localJpScreen(params, t0)
        case 'local_kr_screen': return this.localKrScreen(params, t0)
        case 'local_hk_screen': return this.localHkScreen(params, t0)
        case 'search_etfs': return await this.searchEtfs(params, t0)
        case 'us_realtime': {
          const ref = resolveInstrumentFromParams(params)
            ?? resolveInstrumentFromParams({ market: 'US', symbol: params.symbol ?? params.code })
          if (!ref) return fail('symbol 必填', t0)
          return await this.instrumentQuotes({ instruments: [ref] }, t0)
        }
        case 'us_kline': {
          const ref = resolveInstrumentFromParams(params)
            ?? resolveInstrumentFromParams({ market: 'US', symbol: params.symbol ?? params.code })
          if (!ref) return fail('symbol 必填', t0)
          return await this.instrumentChart({ instrument: ref, count: params.count ?? 120, period: 'daily' }, t0)
        }
        case 'us_profile': {
          const ref = resolveInstrumentFromParams(params)
            ?? resolveInstrumentFromParams({ market: 'US', symbol: params.symbol ?? params.code })
          if (!ref) return fail('symbol 必填', t0)
          return await this.usProfile(ref.symbol, t0)
        }
        case 'us_financials': {
          const ref = resolveInstrumentFromParams(params)
            ?? resolveInstrumentFromParams({ market: 'US', symbol: params.symbol ?? params.code })
          if (!ref) return fail('symbol 必填', t0)
          return await this.usFinancials(ref.symbol, params, t0)
        }
        case 'us_snapshot': {
          const ref = resolveInstrumentFromParams(params)
            ?? resolveInstrumentFromParams({ market: 'US', symbol: params.symbol ?? params.code })
          if (!ref) return fail('symbol 必填', t0)
          return await this.instrumentSnapshot({ instrument: ref }, t0)
        }
        case 'us_stock_list': return await this.usStockList(params, t0)
        case 'local_us_list': return await this.localUsList(params, t0)
        case 'search_us_stocks': return await this.searchUsStocks(params, t0)
        case 'crypto_realtime': {
          const ref = resolveInstrumentFromParams({ market: 'CRYPTO', pair: params.pair ?? params.symbol })
          if (!ref) return fail('pair 必填', t0)
          return await this.instrumentQuotes({ instruments: [ref] }, t0)
        }
        case 'crypto_kline': {
          const ref = resolveInstrumentFromParams({ market: 'CRYPTO', pair: params.pair ?? params.symbol })
          if (!ref) return fail('pair 必填', t0)
          return await this.instrumentChart({ instrument: ref, count: params.count ?? 120, period: 'daily' }, t0)
        }
        case 'crypto_snapshot': {
          const ref = resolveInstrumentFromParams({ market: 'CRYPTO', pair: params.pair ?? params.symbol })
          if (!ref) return fail('pair 必填', t0)
          return await this.instrumentSnapshot({ instrument: ref }, t0)
        }
        case 'crypto_list': return await this.cryptoList(params, t0)
        case 'local_crypto_list': return await this.localCryptoList(params, t0)
        case 'search_crypto_pairs': return await this.searchCryptoPairs(params, t0)
        case 'market_capabilities': {
          // v3.5：三界能力目录（market 42 / instrument 35 / app 12），含参数定义与 providers
          return ok(this.de.listCapabilities(), '系统能力目录', t0)
        }
        case 'market_capability_query': {
          const capability = String(params.capability ?? '')
          const args = Array.isArray(params.args) ? params.args : []
          const market = params.market ? (String(params.market) as Market) : undefined
          const assetClass = params.asset_class ? (String(params.asset_class) as AssetClass) : undefined
          const r = await this.de.queryMarketCapability(capability as Capability, args, { market, assetClass })
          return r.success
            ? ok(r.data, String(capability), t0)
            : fail(r.error ?? '调用失败', t0)
        }
        default: return fail(`Unknown feature: ${feature}`, t0)
      }
    } catch (e) {
      return fail(String(e), t0)
    }
  }

  private async institutionRating(ref: InstrumentRef, groups: string[] | undefined, t0: number) {
    const cnRef = resolveCnInstrumentRef(ref)
    const data = await this.institutions.evaluate(cnRef, groups)
    return ok(serializeInstitutionData(data as unknown as Record<string, unknown>), `${data.name} 机构共识 ${data.consensus_rating_cn}`, t0)
  }

  private async institutionReport(params: Record<string, unknown>, groups: string[] | undefined, t0: number) {
    const ref = resolveInstrumentFromParams(params)
    const cnRef = ref ? resolveCnInstrumentRef(ref) : null
    const data = cnRef
      ? await this.institutions.evaluate(cnRef, groups)
      : await this.institutions.evaluate(String(params.code ?? ''), groups)
    const code = data.code
    const text = formatInstitutionReport(data)
    return ok({ code, name: data.name, report_type: 'institution_rating', text },
      `${data.name} 机构评级报告`, t0)
  }

  /** 本地市场数据包已随在线版升级移除 — 保留 feature 降级桩，向用户说明原因与下一步 */
  private marketDataPacks(t0: number) {
    return fail('本地市场数据包已随在线版升级移除，行情现已改为联网获取，无需下载或管理数据包', t0)
  }

  private marketDataPacksSave(params: Record<string, unknown>, t0: number) {
    void params
    return this.marketDataPacks(t0)
  }

  private async batchStockSnapshots(params: Record<string, unknown>, t0: number) {
    const codes = Array.isArray(params.codes)
      ? (params.codes as string[]).map(String).filter(Boolean)
      : []
    // Hub 批内全开并发；免费源仍由 HostnameRateLimiter（每 host 单在途 + 间隔）全局硬门槛。
    const { items, failed, requested_count, attempted_count } = await collectParallelCnBatchItems(
      codes,
      async (code) => {
        const snap = await this.instrumentSnapshot(
          normalizeInstrumentHubParams({ code, market: 'CN' }),
          t0,
        )
        return {
          success: snap.success,
          data: snap.data && typeof snap.data === 'object'
            ? snap.data as Record<string, unknown>
            : undefined,
          message: snap.message,
        }
      },
    )
    const msg = failed.length === 0
      ? `批量快照 ${items.length} 只`
      : `批量快照成功 ${items.length} 只，失败 ${failed.length} 只`
    return ok(
      { trade_date: null, items, requested_count, attempted_count, failed },
      msg,
      t0,
    )
  }

  private instrumentBatchHandlers(t0: number): InstrumentBatchRouteHandlers {
    return {
      cnBatchSnapshots: async symbols => this.batchStockSnapshots({ codes: symbols }, t0),
      batchQuotesOrSnapshots: async refs => this.instrumentQuotes({ instruments: refs }, t0),
    }
  }

  private instrumentBatchSnapshots(params: Record<string, unknown>, t0: number) {
    return routeInstrumentBatchSnapshots(params, this.instrumentBatchHandlers(t0))
  }

  private async instrumentInstitutionRating(params: Record<string, unknown>, t0: number) {
    return routeInstrumentInstitutionRating(params, this.instrumentRouteHandlers(t0))
  }

  private async instrumentInstitutionReport(params: Record<string, unknown>, t0: number) {
    return routeInstrumentInstitutionReport(params, this.instrumentRouteHandlers(t0))
  }

  /** Central instrument capability dispatch — routes to instrument_* handlers */
  private async dispatchInstrumentCapability(
    cap: InstrumentHubCapability,
    params: Record<string, unknown>,
    t0: number,
  ): Promise<ResearchResult> {
    const normalized = normalizeInstrumentHubParams(params)
    switch (cap) {
      case 'snapshot': return await this.instrumentSnapshot(normalized, t0)
      case 'quotes': return await this.instrumentQuotes(normalized, t0)
      case 'chart':
      case 'chart_intraday':
        return await this.instrumentChart(
          cap === 'chart_intraday' ? { ...normalized, period: 'intraday' } : normalized,
          t0,
        )
      case 'capabilities': return this.instrumentCapabilities(normalized, t0)
      case 'search': return await this.instrumentSearch(normalized, t0)
      case 'cyq':
      case 'evaluation':
      case 'strategy_signal':
      case 'indicators':
      case 'strategy_verify':
        return fail('该分析能力已下线，请使用研究画布与标准行情/基本面能力继续投研', t0)
      case 'institution_rating': return await this.instrumentInstitutionRating(normalized, t0)
      case 'institution_report': return await this.instrumentInstitutionReport(normalized, t0)
      case 'batch_snapshots': return await this.instrumentBatchSnapshots(normalized, t0)
      default: return fail(`未知 capability: ${cap}`, t0)
    }
  }

  private resolveIndexQuoteName(
    configuredName: string | undefined,
    rowName: string | undefined,
    code: string,
  ): string {
    const configured = configuredName?.trim()
    const fromApi = rowName?.trim()
    const looksLikeCode = (value: string) => /^\d{4,6}$/.test(value) || /^[A-Z]{2,6}$/.test(value)
    if (configured && !looksLikeCode(configured)) return configured
    if (fromApi && fromApi !== code && !looksLikeCode(fromApi)) return fromApi
    return configured || fromApi || code
  }

  private quoteChangeAmt(
    row: import('@opptrix/shared').StockRealtime | undefined,
    price: number | null,
    changePct: number | null,
  ): number | null {
    if (row && typeof row.change === 'number' && Number.isFinite(row.change)) return row.change
    if (price == null || changePct == null) return null
    if (!Number.isFinite(price) || !Number.isFinite(changePct)) return null
    const prev = price / (1 + changePct / 100)
    if (!Number.isFinite(prev) || prev === 0) return null
    const derived = price - prev
    return Number.isFinite(derived) ? derived : null
  }

  private bareCnStockCode(code: string): string {
    const raw = String(code ?? '').trim()
    if (!raw) return ''
    const dot = raw.indexOf('.')
    const base = dot >= 0 ? raw.slice(0, dot) : raw
    const digits = normalizeCode(base).replace(/\D/g, '').slice(-6)
    return /^\d{6}$/.test(digits) ? digits : ''
  }

  private shiftCalendarYmd(ymd: string, deltaDays: number): string {
    const d = new Date(`${ymd}T12:00:00.000Z`)
    d.setUTCDate(d.getUTCDate() + deltaDays)
    return d.toISOString().slice(0, 10)
  }

  /** 历史热榜：按 tradeDate 拉日线 close / changePct，不用实时 batch。 */
  private hotHistoryQuoteCacheTtlMs(tradeDateYmd: string): number {
    const today = cnTodayString()
    return tradeDateYmd < today
      ? Number.MAX_SAFE_INTEGER
      : ResearchHub.HOT_HISTORY_TODAY_TTL_MS
  }

  private async fetchCnHistoricalDayQuoteMap(
    codes: string[],
    tradeDateYmd: string,
  ): Promise<Map<string, { price: number | null; change_pct: number | null; change_amt: number | null }>> {
    const map = new Map<string, { price: number | null; change_pct: number | null; change_amt: number | null }>()
    const unique = [...new Set(codes.map(code => this.bareCnStockCode(code)).filter(Boolean))]
    if (!unique.length || !/^\d{4}-\d{2}-\d{2}$/.test(tradeDateYmd)) return map

    const ttlMs = this.hotHistoryQuoteCacheTtlMs(tradeDateYmd)
    const cached = this.cnHotHistoryQuoteCache.get(tradeDateYmd)
    if (cached && Date.now() - cached.fetchedAt < ttlMs) {
      for (const code of unique) {
        const quote = cached.quotes.get(code)
        if (quote) map.set(code, quote)
      }
    }

    const missing = unique.filter(code => !map.has(code))
    if (!missing.length) return map

    const startYmd = this.shiftCalendarYmd(tradeDateYmd, -20)
    const CONCURRENCY = 6
    const fetched = new Map<string, { price: number | null; change_pct: number | null; change_amt: number | null }>()
    for (let i = 0; i < missing.length; i += CONCURRENCY) {
      const chunk = missing.slice(i, i + CONCURRENCY)
      await Promise.all(chunk.map(async (code) => {
        try {
          const ref = resolveCnInstrumentRef({
            market: 'CN',
            assetClass: 'EQUITY',
            symbol: code,
          })
          const r = await this.de.queryInstrumentData(ref, 'kline', {
            startDate: startYmd,
            endDate: tradeDateYmd,
            count: 25,
          })
          const bars = instrumentQueryData<StockKline[]>(r) ?? []
          const bar = bars.find(b => b.date === tradeDateYmd)
            ?? bars.filter(b => b.date <= tradeDateYmd).at(-1)
          if (!bar) return
          const price = typeof bar.close === 'number' && Number.isFinite(bar.close) ? bar.close : null
          const change_pct = typeof bar.changePct === 'number' && Number.isFinite(bar.changePct)
            ? bar.changePct
            : null
          fetched.set(code, {
            price,
            change_pct,
            change_amt: this.quoteChangeAmt(undefined, price, change_pct),
          })
        } catch {
          /* skip single symbol */
        }
      }))
    }

    const store = cached?.quotes ?? new Map()
    for (const [code, quote] of fetched) {
      store.set(code, quote)
      map.set(code, quote)
    }
    this.cnHotHistoryQuoteCache.set(tradeDateYmd, {
      fetchedAt: Date.now(),
      quotes: store,
    })
    return map
  }

  private async fetchCnStockQuoteMap(
    codes: string[],
  ): Promise<Map<string, { price: number | null; change_pct: number | null; change_amt: number | null }>> {
    const unique = [...new Set(codes.map(code => this.bareCnStockCode(code)).filter(Boolean))]
    const map = new Map<string, { price: number | null; change_pct: number | null; change_amt: number | null }>()
    if (!unique.length) return map

    const CHUNK = 100
    for (let i = 0; i < unique.length; i += CHUNK) {
      const chunk = unique.slice(i, i + CHUNK)
      const batch = await this.stockBatchRealtime(chunk)
      chunk.forEach((code, j) => {
        const raw = batch.data?.[j] ?? null
        const merged = this.mergeQuoteWithLocal(code, raw)
        if (!merged) return
        const price = merged.price ?? null
        const change_pct = merged.changePct ?? null
        map.set(code, {
          price,
          change_pct,
          change_amt: this.quoteChangeAmt(merged, price, change_pct),
        })
      })
    }
    return map
  }

  private applyCnStockQuote<T extends {
    code: string
    price?: number | null
    change_pct?: number | null
    change_amt?: number | null
  }>(
    item: T,
    quoteMap: Map<string, { price: number | null; change_pct: number | null; change_amt: number | null }>,
  ): T {
    const key = this.bareCnStockCode(item.code)
    const quote = key ? quoteMap.get(key) : undefined
    if (!quote) return item
    return {
      ...item,
      price: item.price ?? quote.price,
      change_pct: item.change_pct ?? quote.change_pct,
      change_amt: item.change_amt ?? quote.change_amt,
    }
  }

  private async fetchCnIndexMarketItems(
    indices: Array<{ code: string; name?: string }>,
  ) {
    if (!indices.length) return []

    const thscodes = indices.map(entry => majorCnIndexThscode(entry.code)).filter(Boolean)
    const { rows } = await this.fetchThsIndexPriceSnapshots(thscodes)
    const snapByThscode = new Map(
      rows.map(row => [String(row.thscode ?? '').trim().toUpperCase(), row]),
    )

    return Promise.all(indices.map(async entry => {
      const thscode = majorCnIndexThscode(entry.code).toUpperCase()
      const snap = snapByThscode.get(thscode)
      const resolvedName = this.resolveIndexQuoteName(
        entry.name,
        snap ? String(snap.index_name ?? snap.name ?? '') : undefined,
        entry.code,
      )
      const fromSnap = mapMajorCnIndexQuote({ code: entry.code, name: resolvedName }, snap)
      if (fromSnap.price != null) {
        return {
          ...fromSnap,
          name: this.resolveIndexQuoteName(entry.name, fromSnap.name, entry.code),
        }
      }

      const ref = resolveCnInstrumentRef({
        market: 'CN',
        assetClass: 'INDEX',
        symbol: entry.code,
      })
      const r = await this.de.queryInstrumentData(ref, 'realtime')
      const row = instrumentQueryData<import('@opptrix/shared').StockRealtime[]>(r)?.[0]
      const market = entry.code.startsWith('399') ? 'SZ' : 'SH'
      const name = this.resolveIndexQuoteName(
        entry.name,
        row ? String(row.name ?? '') : undefined,
        entry.code,
      )
      if (!row) {
        return {
          code: entry.code,
          name,
          price: null,
          change_pct: null,
          change_amt: null,
          market,
        }
      }
      const price = typeof row.price === 'number' ? row.price : null
      const changePct = typeof row.changePct === 'number' ? row.changePct : null
      return {
        code: entry.code,
        name,
        price,
        change_pct: changePct,
        change_amt: this.quoteChangeAmt(row, price, changePct),
        market,
      }
    }))
  }

  private async fetchGlobalIndexProxyItems(
    proxies: Array<{
      ref: import('@opptrix/shared').InstrumentRef
      outCode: string
      displayName: string
      location: string
      chartSymbol?: string
      etfFallback?: import('@opptrix/shared').InstrumentRef
    }>,
  ) {
    const items = await Promise.all(proxies.map(async proxy => {
      const r = await this.de.queryInstrumentData(proxy.ref, 'realtime')
      const indexRow = instrumentQueryData<import('@opptrix/shared').StockRealtime[]>(r)?.[0]
      let fallbackRow: import('@opptrix/shared').StockRealtime | undefined
      if ((!indexRow || indexRow.price == null) && proxy.etfFallback) {
        const fbR = await this.de.queryInstrumentData(proxy.etfFallback, 'realtime')
        fallbackRow = instrumentQueryData<import('@opptrix/shared').StockRealtime[]>(fbR)?.[0]
      }
      const base = {
        code: proxy.outCode,
        name: proxy.displayName,
        price: null as number | null,
        change_pct: null as number | null,
        market: proxy.ref.market,
        location: proxy.location,
        chart_symbol: proxy.chartSymbol ?? proxy.ref.symbol,
      }
      const row = indexRow ?? fallbackRow
      if (!row) return base
      const price = typeof indexRow?.price === 'number' ? indexRow.price : null
      const changePct = typeof indexRow?.changePct === 'number'
        ? indexRow.changePct
        : typeof fallbackRow?.changePct === 'number'
          ? fallbackRow.changePct
          : null
      return {
        ...base,
        price,
        change_pct: changePct,
        change_amt: this.quoteChangeAmt(row, price, changePct),
      }
    }))
    return items
  }

  private async fetchThsIndexPriceSnapshots(thscodes: string[]): Promise<{
    rows: Record<string, unknown>[]
    error?: string
  }> {
    if (!thscodes.length) return { rows: [] }
    try {
      const r = await this.de.queryMarketCapability(Capability.INDEX_PRICES_SNAPSHOT, [thscodes], { assetClass: 'INDEX' })
      if (!r.success) {
        return { rows: [], error: r.error ?? '指数快照获取失败' }
      }
      return { rows: indexSnapshotRows(r.data) }
    } catch (e) {
      return {
        rows: [],
        error: e instanceof Error ? e.message : '指数快照获取失败',
      }
    }
  }

  private async fetchThsSectorCatalog(
    tag: ThsSectorTag,
    cap: number,
  ): Promise<{ entries: ThsIndexCatalogEntry[]; error?: string }> {
    const cached = this.thsSectorCatalogCache.get(tag)
    if (cached && Date.now() - cached.fetchedAt < ResearchHub.THS_SECTOR_CATALOG_TTL_MS) {
      return { entries: cached.entries.slice(0, cap) }
    }
    try {
      const r = await this.de.queryMarketCapability(Capability.INDEX_CATALOG, [tag], { assetClass: 'INDEX' })
      if (!r.success) {
        return { entries: [], error: r.error ?? '板块目录获取失败' }
      }
      if (!Array.isArray(r.data)) return { entries: [] }
      const entries = r.data
        .slice(0, cap)
        .map(row => parseThsIndexCatalogRow(row as Record<string, unknown>, tag))
        .filter((entry): entry is NonNullable<typeof entry> => entry != null)
      this.thsSectorCatalogCache.set(tag, { fetchedAt: Date.now(), entries })
      return { entries }
    } catch (e) {
      return {
        entries: [],
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }

  /**
   * 同花顺板块指数 — SDK 路由：
   * 1) index.catalogThsIndexList(tag) → thsIndexList（15min 进程缓存）
   * 2) index.pricesSnapshot(thscodes) → thsIndexPricesSnapshot（非 aShare.prices）
   */
  private async fetchCnThsSectorIndexItems(): Promise<{
    items: import('./market-sector-map.js').SectorIndexQuote[]
    status: 'ok' | 'empty' | 'error'
    hint?: string
  }> {
    const TAGS: ThsSectorTag[] = ['cn_concept', 'industry', 'tszs']
    const CATALOG_CAP = 80
    const SNAPSHOT_CAP = 120
    const DISPLAY_CAP = 36
    const catalogErrors: string[] = []

    const catalogEntries = (
      await Promise.all(TAGS.map(async tag => {
        const { entries, error } = await this.fetchThsSectorCatalog(tag, CATALOG_CAP)
        if (error) catalogErrors.push(error)
        return entries
      }))
    ).flat()

    const unique = dedupeThsCatalogEntries(catalogEntries).slice(0, SNAPSHOT_CAP)
    if (!unique.length) {
      const hint = catalogErrors.length
        ? catalogErrors[0]
        : '同花顺板块目录暂不可用，请确认数据源已启用后刷新'
      return { items: [], status: 'error', hint }
    }

    const { rows: snapshots, error: snapError } = await this.fetchThsIndexPriceSnapshots(
      unique.map(entry => entry.thscode),
    )
    const snapByThscode = new Map(
      snapshots.map(row => [String(row.thscode ?? '').trim().toUpperCase(), row]),
    )

    const quotes = unique.map(entry => mapThsIndexSnapshotToQuote(
      entry,
      snapByThscode.get(entry.thscode.trim().toUpperCase()),
    ))
    const items = rankSectorIndexQuotes(quotes, DISPLAY_CAP)
    if (!items.length) {
      return {
        items: [],
        status: 'empty',
        hint: snapError ?? '板块行情暂不可用，请稍后刷新',
      }
    }
    if (snapError && snapshots.length === 0) {
      return {
        items,
        status: 'ok',
        hint: '板块涨跌幅暂不可用，目录与名称仍可浏览',
      }
    }
    return { items, status: 'ok' }
  }

  private async marketDynamics(t0: number, params: Record<string, unknown> = {}) {
    const market = normalizeMarketDynamicsMarket(params.market)
    const force = params.force === true || params.refresh === true

    if (!force) {
      const mem = this.marketDynamicsMemCache.get(market)
      if (mem && Date.now() - mem.at < ResearchHub.MARKET_DYNAMICS_CN_TTL_MS) {
        return mem.payload
      }

      const disk = this.diskCache.readMarketDynamicsCache(market)
      if (disk?.data) {
        const payload = ok({
          ...disk.data,
          from_cache: true,
        }, disk.message, t0)
        this.marketDynamicsMemCache.set(market, { at: disk.cached_at_ms, payload })

        const stale = Date.now() - disk.cached_at_ms >= ResearchHub.MARKET_DYNAMICS_CN_TTL_MS
        if (stale && !this.marketDynamicsRefreshInflight.has(market)) {
          const inflight = this.fetchMarketDynamics(market, Date.now())
            .then(result => {
              if (result.success) {
                this.diskCache.writeMarketDynamicsCache(market, result)
                this.marketDynamicsMemCache.set(market, { at: Date.now(), payload: result })
              }
              return result
            })
            .finally(() => {
              this.marketDynamicsRefreshInflight.delete(market)
            })
          this.marketDynamicsRefreshInflight.set(market, inflight)
          void inflight
        }
        return payload
      }
    }

    const result = await this.fetchMarketDynamics(market, t0)
    if (result.success) {
      this.diskCache.writeMarketDynamicsCache(market, result)
      this.marketDynamicsMemCache.set(market, { at: Date.now(), payload: result })
    }
    return result
  }

  private fetchMarketDynamics(market: MarketDynamicsCacheMarket, t0: number): Promise<ResearchResult> {
    if (market === 'us') return this.marketDynamicsUs(t0)
    if (market === 'hk') return this.marketDynamicsHk(t0)
    return this.marketDynamicsCn(t0)
  }

  private async fetchHkSectorBoardViaTickflow() {
    const boards = [
      { code: '2828', name: '恒生中国企业', chartSymbol: '2828.HK' },
      { code: '3067', name: '恒生科技', chartSymbol: '3067.HK' },
      { code: '2800', name: '盈富基金', chartSymbol: '2800.HK' },
      { code: '3033', name: '南方恒生科技', chartSymbol: '3033.HK' },
    ]
    const batch = await this.de.queryMarketCapability<Record<string, unknown>>(
      Capability.REALTIME_BATCH,
      [{ market: 'HK', symbols: boards.map(b => b.code) }],
    )
    if (!batch.success || !batch.data?.length) return []
    return boards.flatMap(board => {
      const row = (batch.data as Record<string, unknown>[]).find(item => {
        const code = String(item.code ?? '').trim().padStart(5, '0')
        return code === board.code.padStart(5, '0')
      })
      if (!row) return []
      return [{
        code: board.code,
        name: board.name,
        price: typeof row.price === 'number' ? row.price : null,
        change_pct: typeof row.changePct === 'number' ? row.changePct : null,
        change_amt: null as number | null,
        market: 'HK' as const,
        location: '香港',
        chart_symbol: board.chartSymbol,
        sector_tag: 'sector',
      }]
    })
  }

  private async fetchHkMoversViaTickflow(limit = 12) {
    const watch = [
      '00700', '09988', '01810', '03690', '00941', '01299', '02318', '01398',
      '00883', '01024', '09999', '09618', '02382', '02628', '00005', '00011',
      '00388', '02269', '02020', '06618', '01211', '02313', '01928', '00939',
    ]
    const chunkSize = 4
    const merged: Record<string, unknown>[] = []
    for (let i = 0; i < watch.length; i += chunkSize) {
      const part = watch.slice(i, i + chunkSize)
      const batch = await this.de.queryMarketCapability<Record<string, unknown>>(
        Capability.REALTIME_BATCH,
        [{ market: 'HK', symbols: part }],
      )
      if (batch.success && batch.data?.length) {
        merged.push(...(batch.data as Record<string, unknown>[]))
      }
    }
    if (!merged.length) return { gainers: [], losers: [] }
    const rows = merged
      .map(row => {
        const code = String(row.code ?? '').trim().padStart(5, '0')
        const name = String(row.name ?? code).trim()
        const changePct = typeof row.changePct === 'number' ? row.changePct : null
        if (!code || changePct == null) return null
        return {
          code,
          name,
          price: typeof row.price === 'number' ? row.price : null,
          change_pct: changePct,
          change_amt: typeof row.change === 'number' ? row.change : null,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row != null)
      .sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0))
    return {
      gainers: rows.filter(r => (r.change_pct ?? 0) > 0).slice(0, limit),
      losers: rows.filter(r => (r.change_pct ?? 0) < 0).slice(-limit).reverse(),
    }
  }

  private async marketDynamicsHk(t0: number) {
    const hkYahooEquityTicker = (code: string) => {
      const hk = canonicalHkSymbol(code.replace(/\.HK$/i, ''))
      const yahoo = hk.length > 4 ? hk.slice(-4) : hk
      return `${yahoo}.HK`
    }
    const hkMoverChartSymbol = (code: string, chartFromRow?: unknown) => {
      const chart = String(chartFromRow ?? '').trim()
      if (chart && (chart.includes('.') || chart.startsWith('^'))) return chart
      return hkYahooEquityTicker(code)
    }

    const HK_CORE_INDICES = [
      {
        ref: { market: 'HK', assetClass: 'INDEX', symbol: '^HSI' } as import('@opptrix/shared').InstrumentRef,
        etfFallback: { market: 'HK', assetClass: 'EQUITY', symbol: '2800' } as import('@opptrix/shared').InstrumentRef,
        outCode: 'HSI', displayName: '恒生指数', chartSymbol: '^HSI', location: '香港',
      },
      {
        ref: { market: 'HK', assetClass: 'INDEX', symbol: '^HSCE' } as import('@opptrix/shared').InstrumentRef,
        etfFallback: { market: 'HK', assetClass: 'EQUITY', symbol: '2828' } as import('@opptrix/shared').InstrumentRef,
        outCode: 'HSCE', displayName: '恒生国企', chartSymbol: '^HSCE', location: '香港',
      },
      {
        ref: { market: 'HK', assetClass: 'INDEX', symbol: '^HSTECH' } as import('@opptrix/shared').InstrumentRef,
        etfFallback: { market: 'HK', assetClass: 'EQUITY', symbol: '3067' } as import('@opptrix/shared').InstrumentRef,
        outCode: 'HSTECH', displayName: '恒生科技', chartSymbol: 'HSTECH.HK', location: '香港',
      },
    ]

    const [
      hkItems,
      hkSectors,
      moversFallback,
    ] = await Promise.all([
      this.fetchGlobalIndexProxyItems(
        HK_CORE_INDICES.map(row => ({
          ref: row.ref,
          etfFallback: row.etfFallback,
          outCode: row.outCode,
          displayName: row.displayName,
          location: row.location,
          chartSymbol: row.chartSymbol,
        })),
      ).then(items => items.map((item, idx) => ({
        ...item,
        chart_symbol: HK_CORE_INDICES[idx]?.chartSymbol ?? item.code,
      }))),
      this.fetchHkSectorBoardViaTickflow(),
      this.fetchHkMoversViaTickflow(12),
    ])

    const hkGainers = moversFallback.gainers
    const hkLosers = moversFallback.losers
    const hkTrending: Array<{
      code: string
      name: string
      price: number | null
      change_pct: number | null
      change_amt: number | null
      rank?: number
    }> = []

    const sections = hkItems.length ? [{
      id: 'hk_major',
      title: '港股主要指数',
      hint: '恒生系列宽基指数实时报价',
      items: hkItems,
    }] : []

    if (hkSectors.length) {
      sections.push({
        id: 'hk_sectors',
        title: '港股板块',
        hint: '代表性 ETF 板块涨跌',
        items: hkSectors,
      })
    }

    if (hkGainers.length) {
      sections.push({
        id: 'hk_gainers',
        title: '港股涨幅榜',
        hint: '当日涨幅领先个股',
        items: hkGainers.map(row => ({
          ...row,
          market: 'HK',
          location: '香港',
          chart_symbol: hkMoverChartSymbol(row.code, row.code),
        })),
      })
    }

    if (hkLosers.length) {
      sections.push({
        id: 'hk_losers',
        title: '港股跌幅榜',
        hint: '当日跌幅靠前个股',
        items: hkLosers.map(row => ({
          ...row,
          market: 'HK',
          location: '香港',
          chart_symbol: hkMoverChartSymbol(row.code, row.code),
        })),
      })
    }

    if (hkTrending.length) {
      sections.push({
        id: 'hk_trending',
        title: '港股热门',
        hint: '当前讨论与关注度较高的标的',
        items: hkTrending.map(row => ({
          ...row,
          market: 'HK',
          location: '香港',
          chart_symbol: hkMoverChartSymbol(row.code, row.code),
        })),
      })
    }

    return ok({
      market: 'hk' as const,
      refreshed_at: new Date().toISOString(),
      sections,
      hk_indices: hkItems,
      hk_gainers: hkGainers,
      hk_losers: hkLosers,
      hk_trending: hkTrending,
      hk_sector_status: hkSectors.length ? 'ok' as const : 'empty' as const,
      hk_sector_hint: hkSectors.length ? undefined : '板块数据待更新，请稍后刷新',
    }, '港股市场动态', t0)
  }

  private async marketDynamicsUs(t0: number) {
    const US_CORE_INDICES = [
      { ref: { market: 'US', assetClass: 'INDEX', symbol: '^GSPC' } as import('@opptrix/shared').InstrumentRef, outCode: 'SPX', displayName: '标普500', chartSymbol: '^GSPC' },
      { ref: { market: 'US', assetClass: 'INDEX', symbol: '^IXIC' } as import('@opptrix/shared').InstrumentRef, outCode: 'IXIC', displayName: '纳斯达克', chartSymbol: '^IXIC' },
      { ref: { market: 'US', assetClass: 'INDEX', symbol: '^DJI' } as import('@opptrix/shared').InstrumentRef, outCode: 'DJI', displayName: '道琼斯', chartSymbol: '^DJI' },
    ]
    const ASIA_CORE_INDICES = [
      { ref: { market: 'JP', assetClass: 'INDEX', symbol: '^N225' } as import('@opptrix/shared').InstrumentRef, outCode: 'N225', displayName: '日经225', chartSymbol: '^N225', location: '日本' },
      { ref: { market: 'KR', assetClass: 'INDEX', symbol: '^KS11' } as import('@opptrix/shared').InstrumentRef, outCode: 'KOSPI', displayName: '韩国综合', chartSymbol: '^KS11', location: '韩国' },
    ]
    const EU_INDEX_META: Record<string, { location: string; chartSymbol: string }> = {
      FTSE: { location: '英国', chartSymbol: '^FTSE' },
      GDAXI: { location: '德国', chartSymbol: '^GDAXI' },
      FCHI: { location: '法国', chartSymbol: '^FCHI' },
    }

    const [
      usItems,
      asiaItems,
      globalR,
    ] = await Promise.all([
      this.fetchGlobalIndexProxyItems(
        US_CORE_INDICES.map(row => ({
          ref: row.ref,
          outCode: row.outCode,
          displayName: row.displayName,
          location: '美国',
        })),
      ).then(items => items.map((item, idx) => ({
        ...item,
        chart_symbol: US_CORE_INDICES[idx]?.chartSymbol ?? item.code,
      }))),
      this.fetchGlobalIndexProxyItems(
        ASIA_CORE_INDICES.map(row => ({
          ref: row.ref,
          outCode: row.outCode,
          displayName: row.displayName,
          location: row.location,
          chartSymbol: row.chartSymbol,
        })),
      ).then(items => items.map((item, idx) => ({
        ...item,
        chart_symbol: ASIA_CORE_INDICES[idx]?.chartSymbol ?? item.code,
      }))),
      this.de.queryMarketCapability<GlobalIndex>(Capability.GLOBAL_INDEX, ['']),
    ])

    const euItems = (globalR.success && Array.isArray(globalR.data) ? globalR.data : [])
      .filter(row => row.code === 'FTSE' || row.code === 'GDAXI' || row.code === 'FCHI')
      .map(row => {
        const meta = EU_INDEX_META[row.code] ?? { location: row.market ?? '', chartSymbol: row.code }
        return {
          code: row.code,
          name: row.name,
          price: row.price ?? null,
          change_pct: row.changePct ?? null,
          change_amt: null as number | null,
          market: row.market ?? 'UK',
          location: meta.location,
          chart_symbol: meta.chartSymbol,
        }
      })

    const usSectors: Array<{
      code: string
      name: string
      price: number | null
      change_pct: number | null
      change_amt: number | null
      market: 'US'
      location: string
      chart_symbol: string
      sector_tag: string
    }> = []

    const emptyUsMovers: Array<{
      code: string
      name: string
      price: number | null
      change_pct: number | null
      change_amt: number | null
    }> = []
    const usGainers = emptyUsMovers
    const usLosers = emptyUsMovers
    const usTrending = emptyUsMovers
    const usTrendingJp = emptyUsMovers

    const allIndices = [...usItems, ...asiaItems, ...euItems]

    const sections = allIndices.length ? [{
      id: 'us_major',
      title: '全球主要指数',
      hint: '美股、亚太与欧非宽基指数实时报价',
      items: allIndices,
    }] : []

    if (usSectors.length) {
      sections.push({
        id: 'us_sectors',
        title: '美股板块',
        hint: '行业 ETF 代表板块涨跌',
        items: usSectors,
      })
    }

    if (usGainers.length) {
      sections.push({
        id: 'us_gainers',
        title: '美股涨幅榜',
        hint: '当日涨幅领先个股',
        items: usGainers.map(row => ({
          ...row,
          market: 'US',
          location: '美国',
          chart_symbol: row.code,
        })),
      })
    }

    if (usLosers.length) {
      sections.push({
        id: 'us_losers',
        title: '美股跌幅榜',
        hint: '当日跌幅靠前个股',
        items: usLosers.map(row => ({
          ...row,
          market: 'US',
          location: '美国',
          chart_symbol: row.code,
        })),
      })
    }

    if (usTrending.length) {
      sections.push({
        id: 'us_trending',
        title: '美股热门',
        hint: '当前讨论与关注度较高的标的',
        items: usTrending.map(row => ({
          ...row,
          market: 'US',
          location: '美国',
          chart_symbol: row.code,
        })),
      })
    }

    if (usTrendingJp.length) {
      sections.push({
        id: 'us_trending_jp',
        title: '日本热门',
        hint: '日本市场当前热门标的',
        items: usTrendingJp.map(row => ({
          ...row,
          market: 'JP',
          location: '日本',
          chart_symbol: row.code,
        })),
      })
    }

    return ok({
      market: 'us' as const,
      refreshed_at: new Date().toISOString(),
      sections,
      us_indices: allIndices,
      us_gainers: usGainers,
      us_losers: usLosers,
      us_trending: usTrending,
      us_trending_jp: usTrendingJp,
    }, '美股市场动态', t0)
  }

  private async marketDynamicsCn(t0: number) {
    const CN_MAJOR_CN = [
      { code: '000001', name: '上证指数' },
      { code: '399001', name: '深证成指' },
      { code: '000300', name: '沪深300' },
      { code: '000016', name: '上证50' },
      { code: '000905', name: '中证500' },
      { code: '399006', name: '创业板指' },
      { code: '000688', name: '科创50' },
    ]
    const HK_HSI_PROXY = {
      ref: { market: 'HK', assetClass: 'INDEX', symbol: '^HSI' } as import('@opptrix/shared').InstrumentRef,
      outCode: 'HSI',
      displayName: '恒生指数',
      location: '香港',
      chartSymbol: '^HSI',
    }

    const fetchCnLimitUpdownPack = async () => {
      try {
        const r = await this.de.queryMarketCapability<LimitUpDown>(Capability.LIMIT_UPDOWN, [])
        if (!r.success || !Array.isArray(r.data)) {
          return { gainers: [] as Array<{ code: string; name: string; price: number | null; change_pct: number | null; change_amt: number | null }>, losers: [] as Array<{ code: string; name: string; price: number | null; change_pct: number | null; change_amt: number | null }>, limitUp: [] as ReturnType<typeof mapCnLimitUpItems> }
        }
        const mapMover = (row: { code: string; name: string; changePct?: number | null; type: string }) => ({
          code: row.code,
          name: row.name,
          price: null as number | null,
          change_pct: row.changePct ?? null,
          change_amt: null as number | null,
        })
        return {
          gainers: r.data.filter(row => row.type === 'limit_up').slice(0, 30).map(mapMover),
          losers: r.data.filter(row => row.type === 'limit_down').slice(0, 30).map(mapMover),
          limitUp: mapCnLimitUpItems(r.data),
        }
      } catch {
        return { gainers: [], losers: [], limitUp: [] }
      }
    }

    const fetchEmotionSkyrocket = async () => {
      try {
        const r = await this.de.queryMarketCapability(Capability.SKYROCKET_LIST, ['day'])
        if (!r.success) return []
        return mapCnSkyrocketItems(r.data)
      } catch {
        return []
      }
    }

    const fetchEmotionLadder = async () => {
      try {
        const r = await this.de.queryMarketCapability(Capability.LIMIT_UP_LADDER, [])
        if (!r.success) return null
        return parseCnLimitLadder(r.data)
      } catch {
        return null
      }
    }

    const fetchLimitBreak = async () => {
      try {
        const r = await this.de.queryMarketCapability(Capability.LIMIT_BREAK_POOL, [])
        if (!r.success) return []
        return mapCnLimitBreakItems(r.data)
      } catch {
        return []
      }
    }

    const fetchHotStocks = async () => {
      try {
        const r = await this.de.queryMarketCapability(Capability.HOT_STOCK_LIST, ['day'])
        if (!r.success) return []
        return mapCnHotStockItems(r.data)
      } catch {
        return []
      }
    }

    const [
      cnMajorCn,
      cnMajorHk,
      cnSectorPack,
      cnLimitUpdownPack,
      dragonR,
      cnSkyrocket,
      cnLimitLadder,
      cnLimitBreak,
      cnHotStocks,
    ] = await Promise.all([
      this.fetchCnIndexMarketItems(CN_MAJOR_CN),
      this.fetchGlobalIndexProxyItems([HK_HSI_PROXY]),
      this.fetchCnThsSectorIndexItems(),
      fetchCnLimitUpdownPack(),
      this.de.queryMarketCapability(Capability.DRAGON_TIGER, []),
      fetchEmotionSkyrocket(),
      fetchEmotionLadder(),
      fetchLimitBreak(),
      fetchHotStocks(),
    ])

    const cnMovers = { gainers: cnLimitUpdownPack.gainers, losers: cnLimitUpdownPack.losers }
    const cnLimitUp = cnLimitUpdownPack.limitUp

    const cnMajor = [...cnMajorCn, ...cnMajorHk]
    const cnSectors = cnSectorPack.items

    const mapDragonTigerItems = (resp: { success: boolean; data?: unknown }) => {
      if (!resp.success || !Array.isArray(resp.data)) return []
      return resp.data.map(row => {
        const item = row as Record<string, unknown>
        return {
          code: String(item.code ?? '').trim(),
          name: String(item.name ?? item.code ?? '').trim(),
          date: String(item.date ?? '').slice(0, 10),
          reason: item.reason ? String(item.reason).trim() : undefined,
          buy_amount: typeof item.buyAmount === 'number' ? item.buyAmount : null,
          sell_amount: typeof item.sellAmount === 'number' ? item.sellAmount : null,
          net_amount: typeof item.netAmount === 'number' ? item.netAmount : null,
          change_pct: typeof item.changePct === 'number' ? item.changePct : null,
        }
      }).filter(item => item.code)
    }

    const cnDragonTiger = mapDragonTigerItems(dragonR)

    const quoteCodes = [
      ...cnMovers.gainers,
      ...cnMovers.losers,
      ...cnLimitUp,
      ...cnLimitBreak,
      ...cnDragonTiger,
      ...cnSkyrocket,
      ...cnHotStocks,
      ...(cnLimitLadder?.boards.flatMap(board => board.items) ?? []),
    ].map(item => item.code)
    const cnStockQuoteMap = await this.fetchCnStockQuoteMap(quoteCodes)

    const cnGainers = cnMovers.gainers.map(item => this.applyCnStockQuote(item, cnStockQuoteMap))
    const cnLosers = cnMovers.losers.map(item => this.applyCnStockQuote(item, cnStockQuoteMap))
    const cnLimitUpQuoted = cnLimitUp.map(item => this.applyCnStockQuote(item, cnStockQuoteMap))
    const cnLimitBreakQuoted = cnLimitBreak.map(item => this.applyCnStockQuote(item, cnStockQuoteMap))
    const cnDragonTigerQuoted = cnDragonTiger.map(item => this.applyCnStockQuote(item, cnStockQuoteMap))
    const cnSkyrocketQuoted = cnSkyrocket.map(item => this.applyCnStockQuote(item, cnStockQuoteMap))
    const cnHotStocksQuoted = cnHotStocks.map(item => this.applyCnStockQuote(item, cnStockQuoteMap))
    const cnLimitLadderQuoted = cnLimitLadder
      ? {
          ...cnLimitLadder,
          boards: cnLimitLadder.boards.map(board => ({
            ...board,
            items: board.items.map(item => this.applyCnStockQuote(item, cnStockQuoteMap)),
          })),
        }
      : null

    const sections: Array<{
      id: string
      title: string
      hint?: string
      items: Array<{
        code: string
        name: string
        price: number | null
        change_pct: number | null
        change_amt?: number | null
        market?: string
        location?: string
        index_thscode?: string
        sector_tag?: string
      }>
    }> = cnMajor.length ? [{
      id: 'cn_major',
      title: 'A 股主要指数',
      hint: '沪深宽基与恒生参考',
      items: cnMajor,
    }] : []

    if (cnSectors.length) {
      sections.push({
        id: 'cn_sectors',
        title: '板块指数',
        hint: '同花顺概念、行业与特色指数',
        items: cnSectors.map(item => ({
          ...item,
          change_amt: item.change_amt ?? null,
          market: 'CN',
        })),
      })
    }

    const hasEmotionData = cnLimitUpQuoted.length > 0
      || cnSkyrocketQuoted.length > 0
      || cnLimitBreakQuoted.length > 0
      || cnHotStocksQuoted.length > 0
      || (cnLimitLadderQuoted?.boards.length ?? 0) > 0

    return ok({
      market: 'cn' as const,
      refreshed_at: new Date().toISOString(),
      sections,
      cn_gainers: cnGainers,
      cn_losers: cnLosers,
      cn_dragon_tiger: cnDragonTigerQuoted,
      cn_dragon_tiger_date: cnDragonTigerQuoted[0]?.date ?? null,
      cn_limit_up: cnLimitUpQuoted.length ? cnLimitUpQuoted : undefined,
      cn_limit_break: cnLimitBreakQuoted.length ? cnLimitBreakQuoted : undefined,
      cn_skyrocket: cnSkyrocketQuoted.length ? cnSkyrocketQuoted : undefined,
      cn_hot_stocks: cnHotStocksQuoted.length ? cnHotStocksQuoted : undefined,
      cn_limit_ladder: cnLimitLadderQuoted,
      cn_emotion_source: hasEmotionData ? 'tonghuashun' as const : null,
      cn_sector_status: cnSectorPack.status,
      cn_sector_hint: cnSectorPack.hint,
    }, 'A股市场动态', t0)
  }

  private async marketRegime(params: Record<string, unknown>, t0: number) {
    const scope = String(params.profile_scope ?? 'cn').toLowerCase() as MarketRegimeScope
    if (scope === 'us') {
      return this.marketRegimeUs(t0)
    }
    return this.marketRegimeCn(t0)
  }

  private async marketRegimeCn(t0: number) {
    const indexKl = await this.queryCnKline('000300', { count: 280 })
    const klines = instrumentQueryData<StockKline[]>(indexKl) ?? []
    const klineBars = klines.map((k: StockKline) => ({ close: k.close, amount: k.amount }))

    let indexM6m: number | null = null
    let indexM1m: number | null = null
    if (klines.length >= 21) {
      const last = klines[klines.length - 1]?.close
      const m1Base = klines[Math.max(0, klines.length - 21)]?.close
      if (last != null && m1Base != null && m1Base > 0) {
        indexM1m = Math.round((last / m1Base - 1) * 1000) / 10
      }
    }
    if (klines.length >= 121) {
      const last = klines[klines.length - 1]?.close
      const m6Base = klines[klines.length - 121]?.close
      if (last != null && m6Base != null && m6Base > 0) {
        indexM6m = Math.round((last / m6Base - 1) * 1000) / 10
      }
    }

    let indexPe: number | null = null
    try {
      const idxR = await this.de.queryInstrumentData(
        { market: 'CN', assetClass: 'INDEX', symbol: '000300', exchange: 'SH' },
        'realtime',
      )
      const pe = instrumentQueryData<import('@opptrix/shared').StockRealtime[]>(idxR)?.[0]?.pe ?? null
      if (pe != null && pe > 0) indexPe = Math.round(pe * 100) / 100
    } catch { /* offline fallback */ }

    let advancePct: number | null = null
    let limitUp: number | null = null
    let limitDown: number | null = null
    let northboundNetYi: number | null = null
    try {
      const [breadthR, limitR, northR] = await Promise.all([
        // PENDING_PROVIDER：market_breadth 全仓无 provider 实现（白名单 PENDING），迁移即死路由，待同花顺补齐
        this.de.marketBreadth(),
        this.de.queryMarketCapability<LimitUpDown>(Capability.LIMIT_UPDOWN, []),
        // PENDING_PROVIDER：market_money_flow 全仓无 provider 实现（白名单 PENDING），迁移即死路由，待同花顺补齐
        this.de.marketMoneyFlow('north'),
      ])
      if (breadthR.success && breadthR.data?.[0]) {
        const b = breadthR.data[0] as {
          up?: number; down?: number; flat?: number; total?: number; advancePct?: number
        }
        if (b.advancePct != null) {
          advancePct = b.advancePct
        } else if (b.total != null && b.total > 0 && b.up != null) {
          advancePct = Math.round((b.up / b.total) * 1000) / 10
        }
      }
      if (limitR.success && limitR.data) {
        limitUp = limitR.data.filter(l => l.type === 'limit_up').length
        limitDown = limitR.data.filter(l => l.type === 'limit_down').length
      }
      if (northR.success && northR.data?.[0]?.netAmount != null) {
        northboundNetYi = Math.round(northR.data[0].netAmount / 1e8 * 100) / 100
      }
    } catch { /* live sentiment optional */ }

    const snapshot = computeMarketRegime({
      index_m6m: indexM6m,
      index_m1m: indexM1m,
      index_pe: indexPe,
      ma125_position_pct: computeMaPositionPct(klineBars, 125),
      advance_pct: advancePct,
      turnover_vs_20d: computeTurnoverVs20d(klineBars),
      hv20_pct: computeHv20Pct(klineBars),
      limit_up: limitUp,
      limit_down: limitDown,
      northbound_net_yi: northboundNetYi,
      price_percentile_250d: computePricePercentile(klineBars, 250),
    })

    const suggestedByProfile = {
      cn_equity: resolveRegimeStrategyIds('cn_equity', snapshot.regime, snapshot.suggested_strategy_ids),
      cn_etf: resolveRegimeStrategyIds('cn_etf', snapshot.regime, snapshot.suggested_strategy_ids),
    } satisfies Partial<Record<DiscoverStrategyProfile, string[]>>

    return ok({
      scope: 'cn' as const,
      ...snapshot,
      suggested_by_profile: suggestedByProfile,
      etf_regime_detail: ETF_REGIME_DETAIL[snapshot.regime],
      timestamp: new Date().toISOString(),
    }, snapshot.headline, t0)
  }

  /** 美股市况 stub — 基于 SPY 动量/波动，不含 A 股广度/北向 */
  private async marketRegimeUs(t0: number) {
    let klines: Array<{ close: number; amount?: number | null }> = []
    try {
      const kl = await this.de.queryInstrumentData(
        { market: 'US', assetClass: 'EQUITY', symbol: 'SPY' },
        'kline',
        { count: 280 },
      )
      const rows = instrumentQueryData<Array<{ close: number; amount?: number | null }>>(kl)
      if (rows?.length) {
        klines = rows.map(k => ({
          close: k.close,
          amount: k.amount,
        }))
      }
    } catch { /* offline */ }

    const inputs = klines.length >= 21
      ? momentumRegimeInputsFromKlines(klines)
      : { index_m6m: null, index_m1m: null }
    const snapshot = computeMarketRegime(inputs)
    const usSuggested = resolveRegimeStrategyIds('us_equity', snapshot.regime, snapshot.suggested_strategy_ids)

    return ok({
      scope: 'us' as const,
      ...snapshot,
      detail: snapshot.detail,
      suggested_by_profile: { us_equity: usSuggested },
      regime_note: '基于 SPY 动量与波动率代理；不含 A 股广度、涨跌停与北向等指标。',
      timestamp: new Date().toISOString(),
    }, snapshot.headline, t0)
  }

  private resolveStockName(
    code: string,
    exchangeOrName?: string | null,
    ...rest: Array<string | null | undefined>
  ): string {
    let exchange: string | null | undefined
    let candidates: Array<string | null | undefined>
    if (exchangeOrName === 'SH' || exchangeOrName === 'SZ' || exchangeOrName === 'BJ') {
      exchange = exchangeOrName
      candidates = rest
    } else {
      candidates = [exchangeOrName, ...rest]
    }
    const normalized = normalizeCode(code)
    const cacheKey = exchange ? `${exchange}:${normalized}` : normalized
    const cached = this.stockNameCache.get(cacheKey)
    if (cached && cached !== normalized) return cached
    for (const c of candidates) {
      if (c && c.trim() && c.trim() !== normalized) {
        this.stockNameCache.set(cacheKey, c.trim())
        return c.trim()
      }
    }
    return normalized
  }

  private async stockQuotes(refs: (string | InstrumentRef)[] | undefined, t0: number) {
    const normalizedRefs = [...new Map(
      (refs ?? []).map(item => {
        const ref = resolveCnInstrumentRef(item)
        return [instrumentRefKey(ref), ref] as const
      }),
    ).values()]
    if (!normalizedRefs.length) return ok({ quotes: [] }, '暂无关注', t0)
    const batch = await this.stockBatchRealtime(normalizedRefs)
    // Sparse list: failed refs omitted. Callers (routeInstrumentQuotes) must match by code, not index.
    const quotes: Array<NonNullable<ReturnType<ResearchHub['mergeQuoteWithLocal']>> & {
      instrument?: InstrumentRef
    }> = []
    const failed: { code: string; reason: QuoteFailedReason }[] = []
    let firstError = ''
    normalizedRefs.forEach((ref, i) => {
      const errorText = batch.errors?.[i] ?? ''
      const quote = this.resolveStockQuoteWithStaleFallback(ref, batch.data?.[i] ?? null)
      if (quote) {
        quotes.push({
          ...quote,
          exchange: quote.exchange ?? ref.exchange,
        })
        return
      }
      if (!firstError && errorText) firstError = errorText
      // 稀疏批缺席 → empty；有上游文案再归类（not_found / no_provider / error）
      const reason: QuoteFailedReason = !errorText || errorText === 'empty'
        ? 'empty'
        : classifyQuoteFailureMessage(errorText)
      failed.push({ code: instrumentDisplayCode(ref), reason })
    })
    if (!quotes.length) {
      // 全失败时把首个失败原因带进 message，供 routeInstrumentQuotes 归类（如 not_found）
      return fail(`行情获取失败: ${firstError || '未知原因'}`, t0)
    }
    const data: {
      quotes: NonNullable<ReturnType<ResearchHub['mergeQuoteWithLocal']>>[]
      failed?: { code: string; reason: QuoteFailedReason }[]
    } = { quotes }
    if (failed.length) data.failed = failed
    return ok(data, `更新 ${quotes.length} 只`, t0)
  }

  /**
   * CN 基金 / REIT 净值行情 — 经 Engine fund_quote（扶摇等同花顺源）。
   * OpptrixQuant 仅负责标的搜索，不参与净值/行情。
   */
  private async fundQuotes(refs: InstrumentRef[], t0: number) {
    const unique = [...new Map(refs.map(r => [instrumentRefKey(r), r] as const)).values()]
    if (!unique.length) return ok({ quotes: [] }, '暂无关注', t0)

    const quotes: Array<Record<string, unknown> & { instrument: InstrumentRef }> = []
    const failed: { code: string; reason: QuoteFailedReason }[] = []
    let firstError = ''

    const concurrency = 5
    for (let i = 0; i < unique.length; i += concurrency) {
      const chunk = unique.slice(i, i + concurrency)
      await Promise.all(chunk.map(async ref => {
        const r = await this.de.queryInstrumentData(ref, 'fund_quote').catch((e: unknown) => ({
          success: false as const,
          error: e instanceof Error ? e.message : String(e),
        }))
        if (r.success) {
          const rows = instrumentQueryData<Record<string, unknown>[]>(r)
          const raw = Array.isArray(rows) ? rows[0] : null
          const resolved = raw && typeof raw === 'object'
            ? this.resolveFundQuoteRowWithStaleFallback(ref, raw)
            : this.resolveFundQuoteRowWithStaleFallback(ref, null)
          if (resolved) {
            quotes.push(resolved)
            return
          }
          failed.push({ code: instrumentDisplayCode(ref), reason: 'empty' })
          return
        }
        const msg = instrumentQueryError(r, '基金行情获取失败')
        if (!firstError && msg.trim()) firstError = msg.trim()
        const stale = this.resolveFundQuoteRowWithStaleFallback(ref, null)
        if (stale) {
          quotes.push(stale)
          return
        }
        failed.push({
          code: instrumentDisplayCode(ref),
          reason: classifyQuoteFailureMessage(msg),
        })
      }))
    }

    if (!quotes.length) {
      return fail(`行情获取失败: ${firstError || '未知原因'}`, t0)
    }
    return ok(
      { quotes, failed: failed.length ? failed : undefined },
      `更新 ${quotes.length} 只`,
      t0,
    )
  }

  private async cnInstrumentRealtime(ref: InstrumentRef, t0: number) {
    const r = await this.de.queryInstrumentData(ref, 'realtime')
    if (!r.success) return fail(instrumentQueryError(r, '行情获取失败'), t0)
    const rows = instrumentQueryData<Record<string, unknown>[]>(r)
    const raw = Array.isArray(rows) ? rows[0] : null
    if (!raw) return fail('暂时无行情数据', t0)
    const coerced = coerceInstrumentQuoteRow({ ...raw })
    const price = resolveInstrumentQuotePrice(coerced)
    return ok(
      {
        ...coerced,
        ...(price != null ? { price } : {}),
        code: instrumentDisplayCode(ref),
        instrument: ref,
      },
      `${ref.symbol} 行情`,
      t0,
    )
  }

  /** 单标的场外基金净值 — fundQuotes 缺省时 router 有界并发回退 */
  private async fundRealtime(ref: InstrumentRef, t0: number) {
    const r = await this.de.queryInstrumentData(ref, 'fund_quote')
    if (!r.success) return fail(instrumentQueryError(r, '基金行情获取失败'), t0)
    const rows = instrumentQueryData<Record<string, unknown>[]>(r)
    const raw = Array.isArray(rows) ? rows[0] : null
    if (!raw) return fail('基金行情为空', t0)
    const coerced = coerceInstrumentQuoteRow({ ...raw })
    const price = resolveInstrumentQuotePrice(coerced)
    return ok(
      {
        ...coerced,
        ...(price != null ? { price } : {}),
        code: String(raw.code ?? instrumentHubCode(ref)),
        instrument: ref,
      },
      `${ref.symbol} 基金行情`,
      t0,
    )
  }

  /** Lightweight batch insights for watchlist rows — prefers local market DB, then SnapshotStore. */
  private async watchlistRadar(codes: string[] | undefined, t0: number) {
    const sourceCodes = codes?.length ? codes : this.de.watchlist.codes()
    const refs = [...new Map(
      instrumentRefsFromList(sourceCodes, 'CN')
        .filter(r => r.market === 'CN')
        .map(ref => [instrumentRefKey(ref), ref] as const),
    ).values()]
    if (!refs.length) return ok({ items: [] as WatchlistRadarItem[] }, '暂无 A 股关注', t0)

    const quoteByKey = new Map<string, { name?: string; pe?: number | null; pb?: number | null }>()
    try {
      const batch = await this.stockBatchRealtime(refs)
      refs.forEach((ref, i) => {
        const q = batch.data?.[i]
        if (q) quoteByKey.set(instrumentRefKey(ref), q)
      })
    } catch {
      // fallback per-ref inside buildWatchlistRadarItem
    }

    const items = await Promise.all(
      refs.map(ref => this.buildWatchlistRadarItem(ref, undefined, quoteByKey.get(instrumentRefKey(ref)))),
    )
    return ok({ items }, `雷达 ${items.length} 只`, t0)
  }

  private async buildWatchlistRadarItem(
    input: string | InstrumentRef,
    local?: {
      name: string
      pe: number | null
      pb: number | null
    },
    cachedQuote?: { name?: string; pe?: number | null; pb?: number | null },
  ): Promise<WatchlistRadarItem> {
    const ref = resolveCnInstrumentRef(input)
    const symbol = normalizeCode(ref.symbol)
    const ns = instrumentHubCode(ref)
    try {
      const quoteR = cachedQuote
        ? { success: true, data: [cachedQuote] }
        : await this.stockRealtime(ref)
      const flow = null as MoneyFlow | null
      const quote = instrumentQueryData<import('@opptrix/shared').StockRealtime[]>(quoteR)?.[0]
      return {
        code: ns,
        name: this.resolveStockName(symbol, ref.exchange ?? null, quote?.name, local?.name),
        pe: quote?.pe ?? local?.pe ?? null,
        pb: quote?.pb ?? local?.pb ?? null,
        main_net: flow?.mainNet ?? null,
        flow_date: flow?.date ?? null,
      }
    } catch {
      return {
        code: ns,
        name: this.resolveStockName(symbol, undefined, local?.name),
        pe: local?.pe ?? null,
        pb: local?.pb ?? null,
        main_net: null,
        flow_date: null,
      }
    }
  }

  private async stockKline(input: string | InstrumentRef, count: number, t0: number) {
    const cnRef = resolveCnInstrumentRef(input)
    const code = instrumentHubCode(cnRef)
    const safeCount = Math.max(20, Math.min(count, 240))
    const result = await this.de.queryInstrumentData(cnRef, 'kline', { count: safeCount })
    if (!result.success) return fail(instrumentQueryError(result, 'K线获取失败'), t0)
    const klines = instrumentQueryData<import('@opptrix/shared').StockKline[]>(result) ?? []
    return ok({ code, klines }, `${code} K线 ${klines.length} 根`, t0)
  }

  private async stockCyq(ref: InstrumentRef, t0: number) {
    const cnRef = resolveCnInstrumentRef(ref)
    const normalized = cnRef.symbol
    const klineR = await this.de.queryInstrumentData(cnRef, 'kline', { count: 320 })
    const klines = instrumentQueryData<import('@opptrix/shared').StockKline[]>(klineR) ?? []
    if (!klines.length) {
      return fail('K线不足，无法计算筹码分布', t0)
    }
    const rows = computeChipDistribution(normalized, klines, 90)
    if (!rows.length) return fail('筹码分布计算失败', t0)
    const latest = rows[rows.length - 1]!
    return ok({
      code: instrumentHubCode(cnRef),
      rows,
      latest,
    }, `${normalized} 筹码 ${rows.length} 日`, t0)
  }

  private mapCyqRow(row: {
    date: string
    benefitPart: number
    avgCost: number
    cost90Low: number
    cost90High: number
    cost90Con: number
    cost70Low: number
    cost70High: number
    cost70Con: number
  }) {
    return {
      date: row.date,
      benefitPart: row.benefitPart,
      avgCost: row.avgCost,
      cost90Low: row.cost90Low,
      cost90High: row.cost90High,
      cost90Con: row.cost90Con,
      cost70Low: row.cost70Low,
      cost70High: row.cost70High,
      cost70Con: row.cost70Con,
    }
  }

  /** 详情页次要字段（财务/新闻/分红等）超时后降级为空，避免慢源阻塞整页 */
  private stockDetailOptional<T>(
    promise: Promise<{ success: boolean; data?: T[] | null }>,
    timeoutMs = 20000,
  ): Promise<{ success: boolean; data?: T[] | null }> {
    return Promise.race([
      promise,
      new Promise<{ success: false }>(resolve => {
        setTimeout(() => resolve({ success: false }), timeoutMs)
      }),
    ])
  }

  private async stockDetailNotices(_ref: InstrumentRef): Promise<NewsItem[]> {
    // 公告数据源已随在线版升级移除；在此回归前返回空列表
    return []
  }

  private async stockDetailShareholders(ref: InstrumentRef) {
    const cnRef = resolveCnInstrumentRef(ref)
    const engineR = await this.de.queryInstrumentData(cnRef, 'shareholders')
    const engineRows = instrumentQueryData<Record<string, unknown>[]>(engineR)
    if (engineRows?.length) {
      const normalized = normalizeShareholderPayload(cnRef.symbol, engineRows)
      if (normalized) return [normalized]
    }
    const normalized = normalizeShareholderPayload(cnRef.symbol, engineRows ?? null)
    return normalized ? [normalized] : null
  }

  private async stockDetailHolderHistory(ref: InstrumentRef) {
    const cnRef = resolveCnInstrumentRef(ref)
    const r = await this.de.queryMarketCapability(Capability.SHAREHOLDER_NUM, [cnRef.symbol], { ref: cnRef })
    const rows = instrumentQueryData<Record<string, unknown>[]>(r)
    return holderHistoryFromRows(rows)
  }

  /** 详情页行情：标准 realtime + 覆盖层缓存 / 内存报价回退；指数可 K 线合成 */
  private async stockDetailQuote(ref: InstrumentRef) {
    const cnRef = resolveCnInstrumentRef(ref)
    const realtimeR = await this.de.queryInstrumentData(cnRef, 'realtime')
    const liveRaw = instrumentQueryData<import('@opptrix/shared').StockRealtime[]>(realtimeR)?.[0] ?? null
    const resolved = this.resolveStockQuoteWithStaleFallback(cnRef, liveRaw)
    if (resolved) {
      return normalizePreOpenRealtimeQuote(resolved as unknown as import('@opptrix/shared').StockRealtime)
    }
    if (cnRef.assetClass === 'INDEX') {
      return this.stockDetailQuoteFromKlines(cnRef)
    }
    return null
  }

  private async stockDetailQuoteFromKlines(ref: InstrumentRef) {
    const klineR = await this.de.queryInstrumentData(ref, 'kline', { count: 5 })
    const klines = instrumentQueryData<unknown[]>(klineR)
    const synthesized = quoteFromRecentKlines(klines)
    if (!synthesized) return null
    const merged = this.mergeQuoteWithLocal(
      ref.symbol,
      synthesized as unknown as NonNullable<Awaited<ReturnType<MarketDataEngine['realtime']>>['data']>[0],
    )
    if (!merged) return null
    return normalizePreOpenRealtimeQuote(merged as unknown as import('@opptrix/shared').StockRealtime)
  }

  /** 详情页公司资料：仅 queryInstrumentData profile */
  private async stockDetailProfile(ref: InstrumentRef): Promise<Record<string, unknown> | null> {
    const cnRef = resolveCnInstrumentRef(ref)
    const code = cnRef.symbol
    const engineProfileR = await this.de.queryInstrumentData(cnRef, 'profile')
    const engineRow = instrumentQueryData<Array<Record<string, unknown>>>(engineProfileR)?.[0] ?? null
    const rows: Record<string, unknown>[] = engineRow ? [engineRow] : []
    return mergeStockProfileRows(code, rows)
  }

  private async stockDetail(ref: InstrumentRef, t0: number) {
    const cnRef = resolveCnInstrumentRef(ref)
    const code = cnRef.symbol
    const quoteR = await this.stockDetailQuote(cnRef)
    const quote = quoteR ? this.enrichQuote(quoteR) : null

    const name = this.resolveStockName(
      code,
      cnRef.exchange ?? null,
      quote?.name,
    )

    return ok({
      code: instrumentHubCode(cnRef),
      name: name || code,
      quote,
      profile: null,
      financial: null,
      financialHistory: [],
      news: [],
      dividends: [],
      moneyFlow: [],
      shareholders: null,
    }, `${name || code}(${code})${quote ? ' 行情' : ''}`, t0)
  }

  private mergeQuoteWithLocal(
    code: string,
    quoteRaw: NonNullable<Awaited<ReturnType<MarketDataEngine['realtime']>>['data']>[0] | null,
  ) {
    if (!quoteRaw) return null
    const row = coerceInstrumentQuoteRow({ ...quoteRaw } as unknown as Record<string, unknown>)
    const coerced = {
      ...quoteRaw,
      ...(row.price != null ? { price: row.price as number } : {}),
      ...(row.preClose != null ? { preClose: row.preClose as number } : {}),
    }
    const normalized = normalizePreOpenRealtimeQuote(coerced)
    if (!normalized) return null
    return this.enrichQuote(normalized)
  }

  private rememberInstrumentQuote(ref: InstrumentRef, row: Record<string, unknown>): void {
    const coerced = coerceInstrumentQuoteRow({ ...row })
    const price = resolveInstrumentQuotePrice(coerced)
    if (price == null || !(price > 0)) return
    this.lastInstrumentQuotes.set(instrumentRefKey(ref), {
      ...row,
      price,
      instrument: ref,
    })
  }

  private recallInstrumentQuoteRaw(ref: InstrumentRef): Record<string, unknown> | null {
    return this.lastInstrumentQuotes.get(instrumentRefKey(ref)) ?? null
  }

  private resolveStockQuoteWithStaleFallback(
    ref: InstrumentRef,
    liveRaw: NonNullable<Awaited<ReturnType<MarketDataEngine['realtime']>>['data']>[0] | null,
  ): (NonNullable<ReturnType<ResearchHub['mergeQuoteWithLocal']>> & {
    instrument: InstrumentRef
    quoteSource?: string
  }) | null {
    const live = this.mergeQuoteWithLocal(ref.symbol, liveRaw)
    if (live) {
      const row = {
        ...live,
        code: instrumentHubCode(ref),
        instrument: ref,
        quoteSource: 'live' as const,
      }
      this.rememberInstrumentQuote(ref, row)
      return row
    }
    const cached = this.de.peekInstrumentQuoteCache(ref)
    if (cached) {
      const fromCache = this.mergeQuoteWithLocal(ref.symbol, cached)
      if (fromCache) {
        return {
          ...fromCache,
          code: instrumentHubCode(ref),
          instrument: ref,
          quoteSource: 'cache',
        }
      }
    }
    const recalled = this.recallInstrumentQuoteRaw(ref)
    if (recalled) {
      const fromMemory = this.mergeQuoteWithLocal(
        ref.symbol,
        recalled as unknown as NonNullable<Awaited<ReturnType<MarketDataEngine['realtime']>>['data']>[0],
      )
      if (fromMemory) {
        return {
          ...fromMemory,
          code: instrumentHubCode(ref),
          instrument: ref,
          quoteSource: 'memory',
        }
      }
    }
    return null
  }

  private resolveFundQuoteRowWithStaleFallback(
    ref: InstrumentRef,
    liveRaw: Record<string, unknown> | null,
  ): (Record<string, unknown> & { instrument: InstrumentRef; quoteSource?: string }) | null {
    const build = (raw: Record<string, unknown>, quoteSource: string) => {
      const coerced = coerceInstrumentQuoteRow({ ...raw })
      const price = resolveInstrumentQuotePrice(coerced)
      if (price == null || !(price > 0)) return null
      return {
        ...coerced,
        ...(price != null ? { price } : {}),
        code: String(raw.code ?? instrumentHubCode(ref)),
        instrument: ref,
        quoteSource,
      }
    }
    if (liveRaw) {
      const live = build(liveRaw, 'live')
      if (live) {
        this.rememberInstrumentQuote(ref, live)
        return live
      }
    }
    const cached = this.de.peekInstrumentQuoteCache(ref)
    if (cached) {
      const fromCache = build(cached as unknown as Record<string, unknown>, 'cache')
      if (fromCache) return fromCache
    }
    const recalled = this.recallInstrumentQuoteRaw(ref)
    if (recalled) {
      const fromMemory = build(recalled, 'memory')
      if (fromMemory) return fromMemory
    }
    return null
  }

  private resolveCrossMarketQuoteWithStaleFallback(
    ref: InstrumentRef,
    liveRaw: Record<string, unknown> | null,
  ): (Record<string, unknown> & { instrument: InstrumentRef; quoteSource?: string }) | null {
    const build = (raw: Record<string, unknown>, quoteSource: string) => {
      const coerced = coerceInstrumentQuoteRow(raw)
      const price = resolveInstrumentQuotePrice(coerced)
      if (price == null || !(price > 0)) return null
      return {
        ...raw,
        ...coerced,
        ...(price != null ? { price } : {}),
        code: String(raw.code ?? instrumentHubCode(ref)),
        instrument: ref,
        quoteSource,
      }
    }
    if (liveRaw) {
      const live = build(liveRaw, 'live')
      if (live) {
        this.rememberInstrumentQuote(ref, live)
        return live
      }
    }
    const cached = this.de.peekInstrumentQuoteCache(ref)
    if (cached) {
      const fromCache = build(cached as unknown as Record<string, unknown>, 'cache')
      if (fromCache) return fromCache
    }
    const recalled = this.recallInstrumentQuoteRaw(ref)
    if (recalled) {
      const fromMemory = build(recalled, 'memory')
      if (fromMemory) return fromMemory
    }
    return null
  }

  private enrichQuote(quote: NonNullable<Awaited<ReturnType<MarketDataEngine['realtime']>>['data']>[0]) {
    const row = coerceInstrumentQuoteRow({ ...quote } as unknown as Record<string, unknown>)
    const price = resolveInstrumentQuotePrice(row) ?? quote.price
    const preClose = resolveInstrumentQuotePreClose(row) ?? quote.preClose
    const derivedChange = price != null && preClose != null ? price - preClose : null
    const change = derivedChange ?? quote.change
    const rawPct = quote.changePct
    const changePct = rawPct != null && Number.isFinite(rawPct)
      ? rawPct
      : (price != null && preClose != null && preClose > 0
        ? ((price - preClose) / preClose) * 100
        : quote.changePct)
    const amplitude = quote.amplitude ?? (
      quote.high != null && quote.low != null && preClose
        ? ((quote.high - quote.low) / preClose) * 100
        : null
    )
    return { ...quote, price, preClose, change, changePct, amplitude }
  }

  private isCnTradingDayCandidate(): boolean {
    const cn = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))
    const day = cn.getDay()
    return day >= 1 && day <= 5
  }

  private resolveStockMarket(
    code: string,
    explicitMarket?: string | null,
    ref?: InstrumentRef | null,
  ): StockMarket {
    const normalized = normalizeCode(code)
    const parsed = parseStockMarket(explicitMarket ?? ref?.exchange)
    if (parsed) return parsed
    if (ref?.assetClass === 'INDEX') {
      if (ref.exchange === 'TI' || normalized.startsWith('88')) return 'SH'
      return ref.exchange === 'SZ' || normalized.startsWith('399') ? 'SZ' : 'SH'
    }
    if (inferCnAssetClassFromSymbol(normalized, ref?.exchange) === 'INDEX') {
      return normalized.startsWith('399') ? 'SZ' : 'SH'
    }
    return resolveStockMarketCode(normalized)
  }

  private resolveStockMarkets(codes: string[]): Map<string, StockMarket> {
    const normalized = [...new Set(codes.map(c => normalizeCode(String(c))).filter(Boolean))]
    const out = new Map<string, StockMarket>()
    for (const code of normalized) {
      out.set(code, resolveStockMarketCode(code))
    }
    return out
  }

  private async stockRealtime(input: string | InstrumentRef, explicitMarket?: string | null) {
    const ref = resolveCnInstrumentRef(input)
    const exchange = explicitMarket ?? ref.exchange
    const finalRef = exchange && exchange !== ref.exchange
      ? normalizeInstrumentRef({ ...ref, exchange })
      : ref
    return this.de.queryInstrumentData(finalRef, 'realtime')
  }

  private async stockBatchRealtime(refs: (string | InstrumentRef)[]) {
    type Rt = import('@opptrix/shared').StockRealtime
    const normalizedRefs = refs.map(r => resolveCnInstrumentRef(r))
    if (!normalizedRefs.length) {
      return { success: false as const, data: [] as Array<Rt | null>, errors: [] as string[] }
    }

    const codes = normalizedRefs.map(r => normalizeCode(r.symbol))
    const markets: Record<string, StockMarket | undefined> = {}
    for (const ref of normalizedRefs) {
      const code = normalizeCode(ref.symbol)
      markets[code] = this.resolveStockMarket(code, ref.exchange, ref)
    }

    // Provider 真批（Tickflow / 同花顺等）；Engine 对 >100 自动分片并隔离片失败。
    // 稀疏结果按 code+exchange 对齐槽位；禁止因整包 fail 丢掉已成功片。
    const assetClasses: Record<string, import('@opptrix/shared').AssetClass> = {}
    for (const ref of normalizedRefs) {
      const code = normalizeCode(ref.symbol)
      assetClasses[code] = ref.assetClass
    }

    // v3.5：CN 批量实时经标准市场级能力 REALTIME_BATCH（引擎 CN 聚合分支）
    const batch = await this.de.queryMarketCapability(
      Capability.REALTIME_BATCH,
      [{ market: 'CN', symbols: codes, markets, assetClasses }],
    )
    const batchError = instrumentQueryError(batch, '')
    const returned = batch.success
      ? (instrumentQueryData<Rt[]>(batch) ?? [])
      : []

    const data: Array<Rt | null> = []
    const errors: string[] = []
    for (const ref of normalizedRefs) {
      const code = normalizeCode(ref.symbol)
      const wantEx = markets[code] ?? parseStockMarket(ref.exchange)
      const hit = returned.find(row => {
        if (normalizeCode(String(row.code ?? '')) !== code) return false
        const rowEx = parseStockMarket(row.exchange)
        if (!wantEx || !rowEx) return true
        return rowEx === wantEx
      }) ?? null
      data.push(hit)
      // 部分缺席：该槽 null + 文案；不因稀疏结果让整批 success=false
      errors.push(hit ? '' : (batchError || 'empty'))
    }

    return {
      success: data.some(row => row != null),
      data,
      errors,
    }
  }

  private async resolveIntradaySessionPreClose(
    code: string,
    session: IntradayTrendSession,
    apiPreClose: number | null,
    isLatestSession: boolean,
  ): Promise<number | null> {
    if (session.preClose != null && session.preClose > 0) return session.preClose
    if (isLatestSession && apiPreClose != null && apiPreClose > 0) return apiPreClose

    const r = await this.queryCnKline(code, {
      period: 'daily',
      count: 12,
      endDate: session.sessionDate,
    })
    const rows = (instrumentQueryData<import('@opptrix/shared').StockKline[]>(r) ?? [])
      .filter(row => row.date.slice(0, 10) <= session.sessionDate)
      .sort((a, b) => a.date.localeCompare(b.date))
    const idx = rows.findIndex(row => row.date.slice(0, 10) === session.sessionDate)
    if (idx > 0) {
      const prevClose = rows[idx - 1].close
      if (prevClose != null && prevClose > 0) return prevClose
    }
    return apiPreClose != null && apiPreClose > 0 ? apiPreClose : null
  }

  private defaultChartCount(period: string): number {
    switch (period) {
      case 'intraday': return 240
      case '1m': return 480
      case '5m': return 480
      case '15m': return 320
      case '30m': return 240
      case '60m': return 240
      case '5day': return crossMarketFiveDayMinuteCount(2000)
      case 'weekly': return 160
      case 'monthly': return 120
      case 'quarterly': return 80
      case 'yearly': return 40
      case 'year1': return 260
      case 'year3': return 780
      case 'year5': return 1300
      default: return 320
    }
  }

  private crossMarketMaxBars(period: string): number {
    switch (period) {
      case 'year5': return 1300
      case 'year3': return 780
      case 'year1': return 260
      case 'quarterly': return 120
      case 'yearly': return 60
      case '5day': return crossMarketFiveDayMinuteCount(2000)
      default: return 800
    }
  }

  private isCrossMarketOhlcPeriod(period: string): boolean {
    return period !== 'intraday' && period !== '5day'
  }

  private async queryCrossMarketKline(
    market: 'US' | 'HK',
    symbol: string,
    period: string,
    opts: { count?: number; startDate?: string; endDate?: string },
  ) {
    const ref = { market, assetClass: 'EQUITY' as const, symbol }
    const resolved = resolveCrossMarketKlineEngineQuery(period, opts.count ?? 120)
    return this.de.queryInstrumentData(ref, 'kline', {
      count: resolved.count,
      period: resolved.enginePeriod,
      startDate: opts.startDate,
      endDate: opts.endDate,
    })
  }

  private async fetchCrossMarketChartKlines(
    market: 'US' | 'HK',
    symbol: string,
    period: string,
    safeCount: number,
    before: string,
    tail: number,
  ): Promise<{ klines: StockKline[]; hasMore: boolean } | null> {
    if (!this.isCrossMarketOhlcPeriod(period)) return null

    const step = 200
    const cap = this.crossMarketMaxBars(period)

    if (before) {
      const beforeDay = before.slice(0, 10)
      const endDay = this.dayBefore(beforeDay)
      let olderR = await this.queryCrossMarketKline(market, symbol, period, {
        count: step,
        endDate: endDay,
      })
      let older = (instrumentQueryData<StockKline[]>(olderR) ?? []).filter(b => b.date.slice(0, 10) < beforeDay)
      if (!older.length) {
        olderR = await this.queryCrossMarketKline(market, symbol, period, {
          count: step,
          endDate: beforeDay,
        })
        older = (instrumentQueryData<StockKline[]>(olderR) ?? []).filter(b => b.date.slice(0, 10) < beforeDay)
      }
      const recentCount = Math.max(tail, safeCount, 240)
      const recentR = await this.queryCrossMarketKline(market, symbol, period, { count: recentCount })
      const recentData = instrumentQueryData<StockKline[]>(recentR)
      if (recentR.success && recentData?.length) {
        const merged = this.mergeKlineByTime(older, recentData, beforeDay)
        return {
          klines: merged.slice(-Math.min(cap, 800)),
          hasMore: older.length >= step,
        }
      }
      return null
    }

    const r = await this.queryCrossMarketKline(market, symbol, period, { count: safeCount })
    const data = instrumentQueryData<StockKline[]>(r)
    if (r.success && data?.length) {
      const mergeCap = Math.min(cap, 800)
      return {
        klines: data,
        hasMore: data.length >= Math.min(step, safeCount) && safeCount < mergeCap,
      }
    }
    if (period === 'quarterly' || period === 'yearly') {
      return await this.fetchCrossMarketQuarterlyYearlyResampleFallback(market, symbol, period, safeCount)
    }
    return null
  }

  private sortChartBars<T extends { time: string }>(rows: T[]): T[] {
    return [...rows].sort((a, b) => a.time.localeCompare(b.time))
  }

  private isMinutePeriod(period: string): boolean {
    return ['1m', '5m', '15m', '30m', '60m'].includes(period)
  }

  private dayBefore(timeStr: string): string {
    const day = timeStr.slice(0, 10)
    const [y, m, d] = day.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() - 1)
    const y2 = dt.getUTCFullYear()
    const m2 = String(dt.getUTCMonth() + 1).padStart(2, '0')
    const d2 = String(dt.getUTCDate()).padStart(2, '0')
    return `${y2}-${m2}-${d2}`
  }

  private mergeKlineByTime<T extends { date: string }>(older: T[], recent: T[], before: string): T[] {
    const map = new Map<string, T>()
    for (const row of older) map.set(row.date, row)
    for (const row of recent) {
      if (!before || row.date >= before) map.set(row.date, row)
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
  }

  private minuteMaxBars(period: string): number {
    switch (period) {
      case '1m': return 2400
      case '5m': return 1600
      case '15m': return 1200
      case '30m':
      case '60m': return 800
      default: return 800
    }
  }

  private async fetchMinuteChartKlines(
    code: string,
    period: string,
    safeCount: number,
    before: string,
    tail: number,
    stockMarket: StockMarket,
  ): Promise<{ klines: import('@opptrix/shared').StockKline[]; hasMore: boolean } | null> {
    const step = 200
    const cap = this.minuteMaxBars(period)

    if (tail > 0) {
      // PENDING_COMPOSITE：分钟线分页（tail/step）暂无市场级/标的级标准能力承载，
      // 保留引擎 minuteKline 直连；kline 分页能力待 Wave C 决策后迁移。
      const olderR = await this.de.minuteKline(code, period, step, tail, stockMarket)
      const recentR = await this.de.minuteKline(code, period, Math.min(tail, 800), 0, stockMarket)
      if (!recentR.success || !recentR.data?.length) return null
      const older = olderR.success ? (olderR.data ?? []) : []
      const anchor = before || recentR.data[0].date
      const merged = this.mergeKlineByTime(older, recentR.data, anchor).slice(-cap)
      return {
        klines: merged,
        hasMore: older.length >= step && merged.length < cap,
      }
    }

    // PENDING_COMPOSITE：同上，分钟线分页能力待 Wave C 决策后迁移。
    const r = await this.de.minuteKline(code, period, Math.min(safeCount, 800), 0, stockMarket)
    if (!r.success || !r.data?.length) return null
    const klines = r.data.slice(-cap)
    const got = klines.length
    return {
      klines,
      hasMore: got < cap && (got >= safeCount * 0.9 || got >= 120),
    }
  }

  private async fetchCnQuarterlyYearlyResampleFallback(
    code: string,
    period: 'quarterly' | 'yearly',
    safeCount: number,
    exchange: StockMarket,
  ): Promise<{ klines: import('@opptrix/shared').StockKline[]; hasMore: boolean } | null> {
    const factor = period === 'quarterly' ? 3 : 12
    const monthlyCount = Math.min(Math.max(safeCount * factor, 80), 800)
    let monthlyR = await this.queryCnKline(code, {
      period: 'monthly',
      count: monthlyCount,
      exchange,
    })
    let monthly = instrumentQueryData<import('@opptrix/shared').StockKline[]>(monthlyR) ?? []
    if (!monthly.length && inferCnAssetClassFromSymbol(normalizeCode(code), exchange) === 'INDEX') {
      monthlyR = await this.queryCnKline(code, {
        period: 'monthly',
        count: Math.max(monthlyCount, 120),
        exchange,
      })
      monthly = instrumentQueryData<import('@opptrix/shared').StockKline[]>(monthlyR) ?? []
    }
    if (!monthlyR.success || !monthly.length) return null
    const resampled = resampleOhlcKlines(monthly, period)
    const klines = resampled.slice(-Math.min(safeCount, 800))
    if (!klines.length) return null
    return {
      klines,
      hasMore: resampled.length >= safeCount && monthlyCount < 800,
    }
  }

  private async fetchCrossMarketQuarterlyYearlyResampleFallback(
    market: 'US' | 'HK',
    symbol: string,
    period: 'quarterly' | 'yearly',
    safeCount: number,
  ): Promise<{ klines: StockKline[]; hasMore: boolean } | null> {
    const factor = period === 'quarterly' ? 3 : 12
    const monthlyCount = Math.min(Math.max(safeCount * factor, 80), 800)
    const monthlyR = await this.queryCrossMarketKline(market, symbol, 'monthly', { count: monthlyCount })
    const monthly = instrumentQueryData<StockKline[]>(monthlyR) ?? []
    if (!monthlyR.success || !monthly.length) return null
    const resampled = resampleOhlcKlines(monthly, period)
    const klines = resampled.slice(-Math.min(safeCount, 800))
    if (!klines.length) return null
    return {
      klines,
      hasMore: resampled.length >= safeCount && monthlyCount < 800,
    }
  }

  private async fetchIndexChartKlines(
    ref: InstrumentRef,
    period: string,
    safeCount: number,
    before: string,
    tail: number,
  ): Promise<{ klines: import('@opptrix/shared').StockKline[]; hasMore: boolean } | null> {
    const klinePeriod = period === 'year1' || period === 'year3' || period === 'year5'
      ? 'daily'
      : (period === 'daily' ? 'daily' : period)
    const requestCount = klinePeriod !== 'daily'
      ? Math.max(safeCount, 80)
      : safeCount

    if (before) {
      const step = 200
      const endDay = this.dayBefore(before.slice(0, 10))
      let olderR = await this.de.queryInstrumentData(ref, 'kline', {
        period: klinePeriod,
        count: step,
        endDate: endDay,
      })
      let older = (instrumentQueryData<import('@opptrix/shared').StockKline[]>(olderR) ?? [])
        .filter(b => b.date < before)
      if (!older.length) {
        olderR = await this.de.queryInstrumentData(ref, 'kline', {
          period: klinePeriod,
          count: step,
          endDate: before.slice(0, 10),
        })
        older = (instrumentQueryData<import('@opptrix/shared').StockKline[]>(olderR) ?? [])
          .filter(b => b.date < before)
      }
      const recentCount = Math.max(tail, safeCount, 240)
      const recentR = await this.de.queryInstrumentData(ref, 'kline', {
        period: klinePeriod,
        count: Math.max(recentCount, klinePeriod !== 'daily' ? 80 : 0),
      })
      const recentData = instrumentQueryData<import('@opptrix/shared').StockKline[]>(recentR)
      if (recentR.success && recentData?.length) {
        const merged = this.mergeKlineByTime(older, recentData, before)
        return {
          klines: merged.slice(-800),
          hasMore: older.length >= step,
        }
      }
      if (period === 'quarterly' || period === 'yearly') {
        const exchange: StockMarket = parseStockMarket(ref.exchange)
          ?? (ref.symbol.startsWith('399') ? 'SZ' : 'SH')
        return await this.fetchCnQuarterlyYearlyResampleFallback(ref.symbol, period, safeCount, exchange)
      }
      return null
    }

    let klineR = await this.de.queryInstrumentData(ref, 'kline', {
      period: klinePeriod,
      count: requestCount,
    })
    let klineData = instrumentQueryData<import('@opptrix/shared').StockKline[]>(klineR)
    if ((!klineR.success || !klineData?.length) && klinePeriod !== 'daily') {
      klineR = await this.de.queryInstrumentData(ref, 'kline', {
        period: klinePeriod,
        count: Math.max(requestCount, 80),
      })
      klineData = instrumentQueryData<import('@opptrix/shared').StockKline[]>(klineR)
    }
    if (klineR.success && klineData?.length) {
      return {
        klines: klineData,
        hasMore: klineData.length >= safeCount && safeCount < 800,
      }
    }
    if (period === 'quarterly' || period === 'yearly') {
      const exchange: StockMarket = parseStockMarket(ref.exchange)
        ?? (ref.symbol.startsWith('399') ? 'SZ' : 'SH')
      return await this.fetchCnQuarterlyYearlyResampleFallback(ref.symbol, period, safeCount, exchange)
    }
    return null
  }

  private async fetchChartKlines(
    code: string,
    period: string,
    safeCount: number,
    before: string,
    tail: number,
    stockMarket: StockMarket,
    cnRef?: InstrumentRef,
  ): Promise<{ klines: import('@opptrix/shared').StockKline[]; hasMore: boolean } | null> {
    if (this.isMinutePeriod(period)) {
      return this.fetchMinuteChartKlines(code, period, safeCount, before, tail, stockMarket)
    }

    const exchange = stockMarket
    const klinePeriod = period === 'year1' || period === 'year3' || period === 'year5'
      ? 'daily'
      : (period === 'daily' ? 'daily' : period)

    const isIndex = cnRef?.assetClass === 'INDEX'
      || inferCnAssetClassFromSymbol(normalizeCode(code), exchange) === 'INDEX'
    const requestCount = isIndex && klinePeriod !== 'daily'
      ? Math.max(safeCount, 80)
      : safeCount
    if (before) {
      const step = 200
      const endDay = this.dayBefore(before.slice(0, 10))
      let olderR = await this.queryCnKline(code, {
        period: klinePeriod,
        count: step,
        endDate: endDay,
        exchange,
      })
      let older = (instrumentQueryData<import('@opptrix/shared').StockKline[]>(olderR) ?? []).filter(b => b.date < before)
      if (!older.length) {
        olderR = await this.queryCnKline(code, {
          period: klinePeriod,
          count: step,
          endDate: before.slice(0, 10),
          exchange,
        })
        older = (instrumentQueryData<import('@opptrix/shared').StockKline[]>(olderR) ?? []).filter(b => b.date < before)
      }
      const recentCount = Math.max(tail, safeCount, 240)
      const recentR = await this.queryCnKline(code, {
        period: klinePeriod,
        count: Math.max(recentCount, isIndex && klinePeriod !== 'daily' ? 80 : 0),
        exchange,
      })
      const recentData = instrumentQueryData<import('@opptrix/shared').StockKline[]>(recentR)
      if (recentR.success && recentData?.length) {
        const merged = this.mergeKlineByTime(older, recentData, before)
        return {
          klines: merged.slice(-800),
          hasMore: older.length >= step,
        }
      }
      if (isIndex) {
        if (period === 'quarterly' || period === 'yearly') {
          return await this.fetchCnQuarterlyYearlyResampleFallback(code, period, safeCount, exchange)
        }
        return null
      }
      if (period === 'quarterly' || period === 'yearly') {
        return await this.fetchCnQuarterlyYearlyResampleFallback(code, period, safeCount, exchange)
      }
      return null
    }

    let klineR = await this.queryCnKline(code, {
      period: klinePeriod,
      count: requestCount,
      exchange,
    })
    let klineData = instrumentQueryData<import('@opptrix/shared').StockKline[]>(klineR)
    if ((!klineR.success || !klineData?.length) && klinePeriod !== 'daily') {
      klineR = await this.queryCnKline(code, {
        period: klinePeriod,
        count: Math.max(requestCount, 80),
        exchange,
      })
      klineData = instrumentQueryData<import('@opptrix/shared').StockKline[]>(klineR)
    }
    if (klineR.success && klineData?.length) {
      return {
        klines: klineData,
        hasMore: klineData.length >= safeCount && safeCount < 800,
      }
    }
    if (period === 'quarterly' || period === 'yearly') {
      return await this.fetchCnQuarterlyYearlyResampleFallback(code, period, safeCount, exchange)
    }
    return null
  }

  private async stockChart(
    refInput: string | InstrumentRef,
    period: string,
    count: number,
    before: string,
    tail: number,
    t0: number,
  ) {
    const cnRef = normalizeInstrumentRef(
      typeof refInput === 'string'
        ? resolveCnInstrumentRef(refInput)
        : refInput,
    )
    if (cnRef.market !== 'CN') return fail('仅支持 A 股图表', t0)

    const normalized = normalizeCode(cnRef.symbol).padStart(6, '0')
    const isIndex = cnRef.assetClass === 'INDEX'
    const cap = this.isMinutePeriod(period) ? this.minuteMaxBars(period) : this.crossMarketMaxBars(period)
    const safeCount = Math.max(20, Math.min(count || this.defaultChartCount(period), cap))
    const stockMarket = this.resolveStockMarket(normalized, cnRef.exchange, cnRef)
    const quoteR = await this.stockRealtime(cnRef)
    let quote = instrumentQueryData<import('@opptrix/shared').StockRealtime[]>(quoteR)?.[0] ?? null
    if (quote) quote = normalizePreOpenRealtimeQuote(quote)
    const preClose = quote?.preClose ?? null
    const name = this.resolveStockName(normalized, cnRef.exchange ?? quote?.name, quote?.name)

    if (isIndex && (period === 'intraday' || period === '5day')) {
      return fail('指数暂不支持分时走势', t0)
    }

    if (period === 'intraday') {
      const trendR = await this.de.queryMarketCapability<IntradayTrendFetchResult>(
        Capability.INTRADAY_SESSIONS,
        [{ symbol: normalized, exchange: stockMarket, days: 5 }],
      )
      const trendData = trendR.success
        ? trendR.data as unknown as IntradayTrendFetchResult
        : null
      const today = cnTodayString()
      const session = pickIntradaySession(
        trendData?.sessions ?? [],
        today,
        shouldPreferTodayIntraday(),
      )

      if (!session?.bars.length) {
        return ok({
          code: normalized,
          name,
          period,
          preClose,
          sessionDate: null,
          isTradingDay: false,
          bars: [],
          indicators: [],
        }, `${name} 暂无分时数据`, t0)
      }

      const isLiveSession = session.sessionDate === today && shouldPreferTodayIntraday()
      const latestSessionDate = trendData?.sessions.at(-1)?.sessionDate
      const chartPreClose = await this.resolveIntradaySessionPreClose(
        normalized,
        session,
        trendData?.apiPreClose ?? null,
        session.sessionDate === latestSessionDate,
      ) ?? preClose

      const bars = session.bars.map(bar => ({
        time: bar.time,
        price: bar.price,
        volume: bar.volume,
        amount: bar.amount,
        avgPrice: bar.avgPrice,
      }))

      return ok({
        code: normalized,
        name,
        period,
        preClose: chartPreClose,
        sessionDate: session.sessionDate,
        isTradingDay: isLiveSession,
        hasMore: false,
        chart_time_zone: 'Asia/Shanghai',
        bars: this.sortChartBars(bars),
        indicators: [],
      }, `${name} 分时 ${session.sessionDate} ${bars.length} 点`, t0)
    }

    if (period === '5day') {
      const trendR = await this.de.queryMarketCapability<IntradayTrendFetchResult>(
        Capability.INTRADAY_SESSIONS,
        [{ symbol: normalized, exchange: stockMarket, days: 5 }],
      )
      const trendData = trendR.success
        ? trendR.data as unknown as IntradayTrendFetchResult
        : null
      const sessions = trendData?.sessions ?? []
      if (!sessions.length) {
        return ok({
          code: normalized,
          name,
          period,
          preClose,
          sessionDate: null,
          isTradingDay: false,
          bars: [],
          indicators: [],
        }, `${name} 暂无五日数据`, t0)
      }

      const today = cnTodayString()
      const latestSession = sessions.at(-1)
      const isLiveSession = latestSession?.sessionDate === today && shouldPreferTodayIntraday()
      const bars = this.sortChartBars(
        sessions.flatMap(session => session.bars.map(bar => ({
          time: bar.time,
          price: bar.price,
          volume: bar.volume,
          amount: bar.amount,
          avgPrice: bar.avgPrice,
        }))),
      )

      return ok({
        code: normalized,
        name,
        period,
        preClose,
        sessionDate: latestSession?.sessionDate ?? null,
        isTradingDay: isLiveSession,
        hasMore: false,
        chart_time_zone: 'Asia/Shanghai',
        bars,
        indicators: [],
      }, `${name} 五日 ${bars.length} 点`, t0)
    }

    const fetched = isIndex
      ? await this.fetchIndexChartKlines(cnRef, period, safeCount, before, tail)
      : await this.fetchChartKlines(normalized, period, safeCount, before, tail, stockMarket, cnRef)
    if (!fetched?.klines.length) {
      if (isBseCode(normalized)) {
        return ok({
          code: normalized,
          name,
          period,
          preClose,
          isTradingDay: this.isCnTradingDayCandidate(),
          hasMore: false,
          bars: [],
          indicators: [],
        }, `${name} 暂时无法获取走势，请稍后重试`, t0)
      }
      return fail('K线获取失败', t0)
    }

    const bars = this.sortChartBars(fetched.klines.map(bar => ({
      time: bar.date,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      amount: bar.amount,
      changePct: bar.changePct,
      turnoverRate: bar.turnoverRate,
    })))

    const indicators = this.sortChartBars(computeIndicators(normalized, fetched.klines).map(row => ({
      time: row.date,
      ma5: row.ma5,
      ma10: row.ma10,
      ma20: row.ma20,
      ma60: row.ma60,
      rsi6: row.rsi6,
      rsi12: row.rsi12,
      macd: row.macd,
      macdSignal: row.macdSignal,
      macdHist: row.macdHist,
    })))

    let cyqLatest: ReturnType<ResearchHub['mapCyqRow']> | null = null
    let cyqProfile: { date: string; currentPrice: number; levels: { price: number; weight: number }[] } | null = null
    if (!isIndex && (period === 'daily' || period === 'weekly' || period === 'monthly')) {
      const profileRaw = computeLatestChipProfile(normalized, fetched.klines)
      if (profileRaw) {
        cyqLatest = this.mapCyqRow(profileRaw)
        cyqProfile = {
          date: profileRaw.date,
          currentPrice: profileRaw.currentPrice,
          levels: profileRaw.levels.map(level => ({ price: level.price, weight: level.weight })),
        }
      }
    }

    return ok({
      code: normalized,
      name,
      period,
      preClose,
      isTradingDay: this.isCnTradingDayCandidate(),
      hasMore: fetched.hasMore,
      chart_time_zone: 'Asia/Shanghai',
      bars,
      indicators,
      cyqLatest,
      cyqProfile,
    }, `${name} ${period} ${bars.length} 根`, t0)
  }

  private tushareConfigSave(params: Record<string, unknown>, t0: number) {
    const current = loadTushareConfig()
    const tokenRaw = params.token
    const saved = this.de.providerCatalog.saveTushareLegacy({
      enabled: params.enabled === true,
      token: tokenRaw === undefined || tokenRaw === null
        ? current.token
        : String(tokenRaw).trim(),
    })
    this.de.clearCache()
    return ok(saved, 'Tushare 配置已保存', t0)
  }

  private async tushareTest(params: Record<string, unknown>, t0: number) {
    const cfg = loadTushareConfig()
    const token = params.token != null ? String(params.token).trim() : cfg.token
    const httpUrl = params.httpUrl != null ? String(params.httpUrl).trim() : cfg.httpUrl
    const result = await this.de.providerCatalog.testConnection('tushare', { token, httpUrl })
    return ok(result, result.ok ? result.message : `连接失败: ${result.message}`, t0)
  }

  private providerConfig(params: Record<string, unknown>, t0: number) {
    const id = String(params.provider_id ?? '')
    const pub = this.de.getProviderConfig(id)
    if (!pub) return fail(`未知数据源: ${id}`, t0)
    return ok(pub, '数据源配置', t0)
  }

  private providerConfigSave(params: Record<string, unknown>, t0: number) {
    const id = String(params.provider_id ?? '')
    try {
      const saved = this.de.saveProviderConfig(id, {
        enabled: params.enabled === undefined ? undefined : params.enabled === true,
        extra: (params.extra as Record<string, unknown> | undefined)
          ?? (params.token !== undefined ? { token: String(params.token).trim() } : undefined),
        priorityMode: params.priority_mode === 'custom' || params.priority_mode === 'manifest'
          ? params.priority_mode
          : undefined,
        priority: params.priority === undefined
          ? undefined
          : (params.priority == null ? null : Number(params.priority)),
        sortOrder: params.sort_order === undefined
          ? undefined
          : (params.sort_order == null ? null : Number(params.sort_order)),
      })
      return ok(saved, '已保存', t0)
    } catch (e) {
      return fail(String(e), t0)
    }
  }

  private providerOrderSave(params: Record<string, unknown>, t0: number) {
    const providerIds = Array.isArray(params.provider_ids)
      ? params.provider_ids.map(id => String(id))
      : []
    try {
      const catalog = this.de.saveProviderOrder(providerIds)
      return ok(catalog, '顺序已保存', t0)
    } catch (e) {
      return fail(String(e), t0)
    }
  }

  private async providerTest(params: Record<string, unknown>, t0: number) {
    const id = String(params.provider_id ?? '')
    try {
      const result = await this.de.testProviderConnection(id, params as Record<string, unknown>)
      if (result.ok && id) {
        // 测通后清掉该源进程内熔断，避免「连接正常但行情仍全失败」
        this.de.resetProviderHealth(id)
      }
      return ok(result, result.ok ? result.message : `连接失败: ${result.message}`, t0)
    } catch (e) {
      return fail(String(e), t0)
    }
  }

  private providerBindingOverrides(params: Record<string, unknown>, t0: number) {
    const id = String(params.provider_id ?? '')
    if (!id) return fail('provider_id 必填', t0)
    const items = this.de.listProviderBindingOverrides(id)
    return ok({ providerId: id, items }, `绑定 override ${items.length} 条`, t0)
  }

  private providerBindingOverrideSave(params: Record<string, unknown>, t0: number) {
    const id = String(params.provider_id ?? '')
    const market = String(params.market ?? '')
    const assetClass = String(params.asset_class ?? params.assetClass ?? '')
    const capability = String(params.capability ?? '')
    if (!id || !market || !assetClass || !capability) {
      return fail('provider_id / market / asset_class / capability 必填', t0)
    }
    try {
      const items = this.de.saveProviderBindingOverride(id, market, assetClass, capability, {
        enabled: params.enabled === undefined
          ? undefined
          : params.enabled === null
            ? null
            : params.enabled === true || params.enabled === 1 || params.enabled === 'true',
        priority: params.priority !== undefined
          ? (params.priority === null || params.priority === '' ? null : Number(params.priority))
          : undefined,
      })
      return ok({ providerId: id, items }, '已保存能力级优先级', t0)
    } catch (e) {
      return fail(String(e), t0)
    }
  }

  private async providerRescan(t0: number) {
    try {
      const providers = await this.de.rescanProviders()
      return ok(
        { providers, providersDir: resolveProvidersDir() },
        providers.length ? `已发现 ${providers.length} 个扩展数据源` : '未发现扩展数据源',
        t0,
      )
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e), t0)
    }
  }

  private async providerUninstall(params: Record<string, unknown>, t0: number) {
    const id = String(params.provider_id ?? params.id ?? '').trim()
    if (!id) return fail('provider_id 必填', t0)
    try {
      const removed = this.de.providerLoader.uninstall(id)
      if (!removed) return fail(`未找到扩展数据源：${id}`, t0)
      this.de.clearCacheForProvider(id)
      return ok({ providerId: id }, '已移除扩展数据源', t0)
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e), t0)
    }
  }

  private async providerReload(params: Record<string, unknown>, t0: number) {
    const id = String(params.provider_id ?? params.id ?? '').trim()
    if (!id) return fail('provider_id 必填', t0)
    try {
      const record = await this.de.reloadProvider(id)
      if (!record) return fail(`无法重新加载数据源：${id}`, t0)
      return ok(record, '已重新加载', t0)
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e), t0)
    }
  }

  private providerInstalledList(t0: number) {
    const items = this.de.listInstalledProviders().map(record => ({
      providerId: record.providerId,
      version: record.version,
      title: record.title,
      installedAt: record.installedAt,
      loaded: record.loaded,
      marketGroup: record.marketGroup,
    }))
    return ok(
      { providers: items, providersDir: resolveProvidersDir() },
      items.length ? `已发现 ${items.length} 个扩展数据源` : '可将插件放入扩展目录后重新扫描',
      t0,
    )
  }

  private cnInstrumentRef(input: string | InstrumentRef): InstrumentRef {
    return resolveCnInstrumentRef(input)
  }

  /** @deprecated Use cnInstrumentRef */
  private cnEquityRef(input: string | InstrumentRef): InstrumentRef {
    return this.cnInstrumentRef(input)
  }

  private async queryFundInstrumentData(
    params: Record<string, unknown>,
    capability: 'fund_nav' | 'fund_holdings' | 'fund_snapshot' | 'fund_profile',
    t0: number,
  ) {
    const ref = resolveInstrumentFromParams(params)
    if (!ref) return fail('instrument 或 code 必填', t0)
    if (!isCnPublicFundRef(ref)) {
      return fail('当前标的不是公募基金，请重新搜索并选择基金', t0)
    }
    const labels = {
      fund_nav: '基金净值',
      fund_holdings: '基金持仓',
      fund_snapshot: '基金快照',
      fund_profile: '基金档案',
    } as const
    const r = await this.de.queryInstrumentData(ref, capability)
    if (!r.success) return fail(instrumentQueryError(r, `${labels[capability]}获取失败`), t0)
    const data = instrumentQueryData(r)
    if (capability === 'fund_snapshot') return ok(data, labels[capability], t0)
    if (capability === 'fund_profile') {
      const row = Array.isArray(data) ? (data[0] ?? null) : data ?? null
      return ok(
        { instrument: ref, profile: row, source: 'queryInstrumentData' },
        labels.fund_profile,
        t0,
      )
    }
    const rows = Array.isArray(data) ? data : []
    return ok(
      {
        code: instrumentHubCode(ref),
        items: rows,
        source: 'queryInstrumentData',
      },
      `${labels[capability]} ${rows.length} 条`,
      t0,
    )
  }

  private async fundList(params: Record<string, unknown>, t0: number) {
    const code = params.code != null ? String(params.code) : ''
    const ref = code
      ? normalizeInstrumentRef({
        market: 'CN',
        assetClass: 'FUND',
        symbol: code.replace(/\D/g, '').padStart(6, '0').slice(-6),
        exchange: 'PF',
      })
      : normalizeInstrumentRef({
        market: 'CN',
        assetClass: 'FUND',
        symbol: '000001',
        exchange: 'PF',
      })
    const r = await this.de.queryInstrumentData(ref, 'fund_list', code ? { keyword: code } : {})
    if (!r.success) return fail(instrumentQueryError(r, '公募基金列表获取失败'), t0)
    const data = instrumentQueryData<unknown[]>(r) ?? []
    return ok(data, `公募基金列表 ${data.length} 条`, t0)
  }

  private async localFundList(params: Record<string, unknown>, t0: number) {
    return this.fundList(params, t0)
  }

  private async localFundNav(code: string, params: Record<string, unknown>, t0: number) {
    return this.queryFundInstrumentData({ ...params, code }, 'fund_nav', t0)
  }

  private async localFundHoldings(code: string, params: Record<string, unknown>, t0: number) {
    return this.queryFundInstrumentData({ ...params, code }, 'fund_holdings', t0)
  }

  private async queryEtfInstrumentData(
    params: Record<string, unknown>,
    capability: 'etf_nav' | 'etf_holdings' | 'etf_snapshot' | 'etf_profile',
    t0: number,
  ) {
    const ref = resolveInstrumentFromParams(params)
    if (!ref) return fail('instrument 或 code 必填', t0)
    const labels = {
      etf_nav: 'ETF 净值',
      etf_holdings: 'ETF 持仓',
      etf_snapshot: 'ETF 快照',
      etf_profile: 'ETF 档案',
    } as const
    const r = await this.de.queryInstrumentData(ref, capability)
    if (!r.success) return fail(instrumentQueryError(r, `${labels[capability]}获取失败`), t0)
    const data = instrumentQueryData(r)
    if (capability === 'etf_snapshot') return ok(data, labels[capability], t0)
    if (capability === 'etf_profile') {
      const row = Array.isArray(data) ? (data[0] ?? null) : data ?? null
      return ok(
        { instrument: ref, profile: row, source: 'queryInstrumentData' },
        labels.etf_profile,
        t0,
      )
    }
    const rows = Array.isArray(data) ? data : []
    return ok(
      {
        code: instrumentHubCode(ref),
        items: rows,
        source: 'queryInstrumentData',
      },
      `${labels[capability]} ${rows.length} 条`,
      t0,
    )
  }

  /** 板块或行业成分股 — 标准 stock_list + boardKey / industryCode */
  private async sectorConstituents(params: Record<string, unknown>, t0: number) {
    const marketRaw = String(params.market ?? 'CN').toUpperCase()
    const market = (['CN', 'US', 'HK'].includes(marketRaw) ? marketRaw : 'CN') as 'CN' | 'US' | 'HK'
    const boardKey = params.board_key != null ? String(params.board_key).trim() : ''
    const industryCode = params.industry_code != null ? String(params.industry_code).trim() : ''
    if (!boardKey && !industryCode) {
      return fail('board_key 或 industry_code 必填其一（可先经 MCP 问数或同花顺概念目录获取）', t0)
    }
    const page = params.page != null ? Math.max(1, Number(params.page)) : 1
    const pageSize = params.page_size != null
      ? Math.min(100, Math.max(1, Number(params.page_size)))
      : 50
    const ref = { market, assetClass: 'EQUITY' as const, symbol: market === 'US' ? 'AAPL' : market === 'HK' ? '00700' : '000001' }
    const r = await this.de.queryInstrumentData(ref, 'stock_list', {
      page,
      pageSize,
      boardKey: boardKey || undefined,
      industryCode: industryCode || undefined,
    })
    if (!r.success) return fail(instrumentQueryError(r, '板块/行业成分获取失败'), t0)
    const items = instrumentQueryData<unknown[]>(r) ?? []
    return ok(
      {
        market,
        board_key: boardKey || null,
        industry_code: industryCode || null,
        items,
        count: items.length,
        page,
        page_size: pageSize,
        source: 'queryInstrumentData',
      },
      `成分股 ${items.length} 条`,
      t0,
    )
  }

  /**
   * 轻量交易时段状态 — 常规时段 + 工作日判断，非完整节假日日历。
   * 厚日历请走 provider_ext（如同花顺 tradingDays）。
   */
  private marketSession(params: Record<string, unknown>, t0: number) {
    const marketRaw = String(params.market ?? 'CN').toUpperCase()
    const market = (['CN', 'US', 'HK'].includes(marketRaw) ? marketRaw : 'CN') as 'CN' | 'US' | 'HK'
    const now = new Date()
    const disclaimer =
      '仅常规交易时段与工作日启发式判断，不含完整法定节假日/调休；精确日历请用系统交易日历能力（trade_calendar）查询'

    if (market === 'CN') {
      const local = cnMarketNow()
      const weekday = isCnTradingWeekday(local)
      const open = isCnMarketOpen(local)
      let session_label = '休市'
      if (!weekday) session_label = '周末休市'
      else if (isCnBeforeMarketOpen(local)) session_label = '盘前'
      else if (open) session_label = '盘中'
      else if (isCnAfterMarketClose(local)) session_label = '盘后'
      return ok(
        {
          market: 'CN',
          timezone: 'Asia/Shanghai',
          local_date: cnTodayString(local),
          weekday,
          in_regular_session: open,
          session_label,
          regular_hours: '09:15–11:30, 13:00–15:05（含集合竞价约计）',
          disclaimer,
        },
        session_label,
        t0,
      )
    }

    if (market === 'US') {
      const local = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
      const day = local.getDay()
      const weekday = day >= 1 && day <= 5
      const mins = local.getHours() * 60 + local.getMinutes()
      const y = local.getFullYear()
      const m = String(local.getMonth() + 1).padStart(2, '0')
      const d = String(local.getDate()).padStart(2, '0')
      const localDate = `${y}-${m}-${d}`
      const tradingDay = weekday && isCrossMarketTradingDay('US', localDate)
      const open = tradingDay && mins >= 9 * 60 + 30 && mins < 16 * 60
      let session_label = 'closed'
      if (!tradingDay) session_label = 'closed'
      else if (mins < 9 * 60 + 30) session_label = 'pre'
      else if (open) session_label = 'regular'
      else session_label = 'post'
      return ok(
        {
          market: 'US',
          timezone: 'America/New_York',
          local_date: localDate,
          weekday: tradingDay,
          in_regular_session: open,
          session_label,
          regular_hours: '09:30–16:00 ET',
          disclaimer,
        },
        session_label,
        t0,
      )
    }

    // HK
    const local = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }))
    const day = local.getDay()
    const weekday = day >= 1 && day <= 5
    const mins = local.getHours() * 60 + local.getMinutes()
    const y = local.getFullYear()
    const m = String(local.getMonth() + 1).padStart(2, '0')
    const d = String(local.getDate()).padStart(2, '0')
    const localDate = `${y}-${m}-${d}`
    const tradingDay = weekday && isCrossMarketTradingDay('HK', localDate)
    const morning = mins >= 9 * 60 + 30 && mins <= 12 * 60
    const afternoon = mins >= 13 * 60 && mins <= 16 * 60
    const open = tradingDay && (morning || afternoon)
    let session_label = '休市'
    if (!tradingDay) session_label = '休市'
    else if (mins < 9 * 60 + 30) session_label = '盘前'
    else if (open) session_label = '盘中'
    else if (mins > 12 * 60 && mins < 13 * 60) session_label = '午休'
    else session_label = '盘后'
    return ok(
      {
        market: 'HK',
        timezone: 'Asia/Hong_Kong',
        local_date: localDate,
        weekday: tradingDay,
        in_regular_session: open,
        session_label,
        regular_hours: '09:30–12:00, 13:00–16:00 HKT',
        disclaimer,
      },
      session_label,
      t0,
    )
  }

  /**
   * 个股机构持仓 — 一览经 inst_holding / instHolding；明细与报告期走 Agent MCP。
   * scope: overview（默认）| detail | dates
   */
  private async instrumentInstitutionHoldings(params: Record<string, unknown>, t0: number) {
    const scope = String(params.scope ?? 'overview').trim().toLowerCase() || 'overview'
    const orgType = String(params.org_type ?? params.orgType ?? params.kind ?? 'fund').trim()
    const reportDate = String(params.report_date ?? params.reportDate ?? '').trim()

    if (scope === 'dates' || scope === 'report_dates') {
      return fail(
        '机构持仓报告期列表需通过 Agent MCP 机构工具查询，Hub 仅提供持仓一览',
        t0,
      )
    }

    const ref = resolveInstrumentFromParams(params)
    if (!ref) return fail('instrument 或 market+symbol 必填', t0)
    if (ref.market !== 'CN') return fail('机构持仓目前仅支持 A 股（CN）', t0)
    const code = ref.symbol

    if (scope === 'detail' || scope === 'tab') {
      return fail(
        `机构持仓明细（${orgType || 'fund'}）需通过 Agent MCP 机构工具查询；可换 scope=overview 查看汇总`,
        t0,
      )
    }

    const engineR = await this.de.queryInstrumentData(ref, 'inst_holding')
    const engineRows = instrumentQueryData<Record<string, unknown>[]>(engineR)
    if (engineR.success && engineRows?.length) {
      return ok(
        {
          instrument: ref,
          scope: 'overview',
          report_date: (engineRows[0]?.reportDate as string | undefined) ?? (reportDate || null),
          items: engineRows,
          count: engineRows.length,
          source: 'inst_holding',
          hint: '分类明细与报告期列表请使用 Agent MCP 机构工具',
        },
        `机构持仓一览 ${engineRows.length} 条`,
        t0,
      )
    }

    const r = await this.de.queryMarketCapability(Capability.INST_HOLDING, [code])
    if (!r.success || !Array.isArray(r.data) || !r.data.length) {
      const engineErr = 'error' in engineR && engineR.error ? String(engineR.error) : undefined
      return fail(r.error ?? engineErr ?? '机构持仓暂不可用', t0)
    }
    return ok(
      {
        instrument: ref,
        scope: 'overview',
        items: r.data,
        count: r.data.length,
        source: r.source ?? 'instHolding',
        hint: '分类明细与报告期列表请使用 Agent MCP 机构工具',
      },
      `机构持仓一览 ${r.data.length} 条`,
      t0,
    )
  }

  /**
   * 标准事实表能力 — profile / financials / 三表 / shareholders / dividend。
   * 一律经 queryInstrumentData，禁止 Hub 直连 Provider。
   */
  private async queryInstrumentStandardData(
    params: Record<string, unknown>,
    capability:
      | 'profile'
      | 'financials'
      | 'balance_sheet'
      | 'cash_flow'
      | 'income_statement'
      | 'shareholders'
      | 'dividend',
    t0: number,
  ) {
    const ref = resolveInstrumentFromParams(params)
    if (!ref) return fail('instrument 或 market+symbol 必填', t0)

    const labels = {
      profile: '公司概况',
      financials: '财务摘要',
      balance_sheet: '资产负债表',
      cash_flow: '现金流量表',
      income_statement: '利润表',
      shareholders: '股东结构',
      dividend: '分红历史',
    } as const

    const opts: {
      reportDate?: string
      reportType?: string
      page?: number
      pageSize?: number
    } = {}
    if (capability === 'financials') {
      opts.reportDate = params.report_date != null ? String(params.report_date) : ''
      opts.reportType = params.report_type != null ? String(params.report_type) : 'all'
    }
    if (
      capability === 'balance_sheet'
      || capability === 'cash_flow'
      || capability === 'income_statement'
    ) {
      opts.reportDate = params.report_date != null ? String(params.report_date) : ''
    }
    if (capability === 'shareholders' && params.report_date != null) {
      opts.reportDate = String(params.report_date)
    }
    if (capability === 'dividend') {
      if (params.page != null) opts.page = Number(params.page)
      if (params.page_size != null) opts.pageSize = Number(params.page_size)
    }

    const r = await this.de.queryInstrumentData(ref, capability, opts)
    if (!r.success) return fail(instrumentQueryError(r, `${labels[capability]}获取失败`), t0)
    const data = instrumentQueryData(r)

    if (capability === 'profile') {
      const row = Array.isArray(data) ? (data[0] ?? null) : data ?? null
      return ok(
        {
          instrument: ref,
          profile: row,
          source: 'queryInstrumentData',
        },
        labels.profile,
        t0,
      )
    }

    const rows = Array.isArray(data) ? data : data != null ? [data] : []
    return ok(
      {
        instrument: ref,
        items: rows,
        count: rows.length,
        source: 'queryInstrumentData',
      },
      `${labels[capability]} ${rows.length} 条`,
      t0,
    )
  }

  /** 同花顺财务指标树（growth/profitability…）— Engine custom */
  private async instrumentFinancialIndicators(params: Record<string, unknown>, t0: number) {
    const ref = resolveInstrumentFromParams(params)
    if (!ref) return fail('instrument 或 market+symbol 必填', t0)
    const report = String(params.report ?? params.report_period ?? '').trim()
    if (!report) return fail('report 必填（如 2024Q3 / 2024）', t0)
    const r = await this.de.queryMarketCapability(Capability.FINANCIAL_INDICATORS, [
      ref.symbol,
      report,
    ])
    if (!r.success) {
      return fail(
        r.error ?? '财务指标获取失败（须启用同花顺富耀）',
        t0,
      )
    }
    const raw = r.data
    const rows = Array.isArray(raw) ? raw : raw != null ? [raw] : []
    return ok(
      {
        instrument: ref,
        report,
        items: rows,
        count: rows.length,
        source: 'tonghuashun',
        provider_method: 'financial_indicators',
      },
      `财务指标 ${rows.length} 条`,
      t0,
    )
  }

  private async tradeCalendar(params: Record<string, unknown>, t0: number) {
    const year = params.year != null ? Number(params.year) : new Date().getFullYear()
    if (!Number.isFinite(year) || year < 1990 || year > 2100) {
      return fail('year 须为合理年份', t0)
    }
    const r = await this.de.queryMarketCapability(Capability.TRADE_CALENDAR, [year])
    if (!r.success) return fail(r.error ?? '交易日历获取失败', t0)
    const rows = Array.isArray(r.data) ? r.data : []
    return ok(
      {
        year,
        items: rows,
        count: rows.length,
        source: r.source ?? 'tradeCalendar',
        hint: 'isTradeDay/isOpen 为 true 表示交易日；精确休市勿用 get_market_session 代替',
      },
      `${year} 年交易日 ${rows.length} 条`,
      t0,
    )
  }

  private async enrichConstituentRowsWithQuotes(
    rows: Record<string, unknown>[],
    quoteLimit: number,
  ): Promise<{ rows: Record<string, unknown>[]; quotedCount: number }> {
    const limit = Math.min(Math.max(Math.floor(quoteLimit), 1), 500)
    const indexed = rows
      .map(row => ({ row, code: parseConstituentStockCode(row) }))
      .filter(entry => entry.code)
    const toQuote = indexed.slice(0, limit)
    const quoteByCode = new Map<string, {
      price: number | null
      change_pct: number | null
      change_amt: number | null
    }>()

    const CHUNK = 100
    for (let i = 0; i < toQuote.length; i += CHUNK) {
      const chunk = toQuote.slice(i, i + CHUNK)
      const batch = await this.stockBatchRealtime(chunk.map(entry => entry.code))
      chunk.forEach((entry, j) => {
        const raw = batch.data?.[j] ?? null
        if (!raw) return
        const merged = this.mergeQuoteWithLocal(entry.code, raw)
        if (!merged) return
        quoteByCode.set(entry.code, {
          price: merged.price ?? null,
          change_pct: merged.changePct ?? null,
          change_amt: this.quoteChangeAmt(merged, merged.price ?? null, merged.changePct ?? null),
        })
      })
    }

    const enriched = rows.map(row => {
      const code = parseConstituentStockCode(row)
      return mergeConstituentQuoteRow(row, code ? quoteByCode.get(code) : undefined)
    })
    return { rows: sortConstituentRowsByChangePct(enriched), quotedCount: quoteByCode.size }
  }

  private async indexConstituents(params: Record<string, unknown>, t0: number) {
    const indexCode = String(params.index_code ?? params.code ?? params.symbol ?? '').trim()
    if (!indexCode) return fail('index_code 或 code 必填（如 000300、885338.TI）', t0)

    const withQuotes = params.with_quotes !== false && params.with_quotes !== 'false'
    const quoteLimitRaw = Number(params.quote_limit)
    const quoteLimit = Number.isFinite(quoteLimitRaw) && quoteLimitRaw > 0
      ? Math.min(500, Math.floor(quoteLimitRaw))
      : 400

    const r = await this.de.queryMarketCapability<Record<string, unknown>>(
      Capability.INDEX_CONST,
      [indexCode],
      { market: 'CN', assetClass: 'INDEX' },
    )
    let rows: Record<string, unknown>[] = []
    let source = 'indexConstituents'
    let providerMethod: string | undefined

    if (r.success && Array.isArray(r.data) && r.data.length) {
      rows = r.data.filter((row): row is Record<string, unknown> => row != null && typeof row === 'object')
      source = r.source ?? source
    } else {
      const fallback = await this.de.queryMarketCapability(Capability.INDEX_CONSTITUENTS_RAW, [indexCode], { assetClass: 'INDEX' })
      if (!fallback.success) {
        return fail(r.error ?? fallback.error ?? '指数成分获取失败', t0)
      }
      const raw = fallback.data
      rows = (Array.isArray(raw) ? raw : raw != null ? [raw] : [])
        .filter((row): row is Record<string, unknown> => row != null && typeof row === 'object')
      source = 'tonghuashun'
      providerMethod = 'index_constituents_raw'
    }

    if (!rows.length) {
      return fail('暂无成份股数据', t0)
    }

    let quotedCount = 0
    let finalRows = rows
    if (withQuotes) {
      const enriched = await this.enrichConstituentRowsWithQuotes(rows, quoteLimit)
      finalRows = enriched.rows
      quotedCount = enriched.quotedCount
    }

    const payload: Record<string, unknown> = {
      index_code: indexCode,
      items: finalRows,
      count: finalRows.length,
      source,
    }
    if (providerMethod) payload.provider_method = providerMethod
    if (withQuotes) {
      payload.quoted_count = quotedCount
      payload.quote_limit = quoteLimit
    }

    const quoteHint = withQuotes && quotedCount < finalRows.length
      ? `，行情 ${quotedCount}/${finalRows.length}`
      : withQuotes
        ? `，行情 ${quotedCount} 只`
        : ''
    return ok(payload, `指数成分 ${finalRows.length} 条${quoteHint}`, t0)
  }

  private async queryCnKline(
    code: string,
    opts: {
      period?: string
      count?: number
      startDate?: string
      endDate?: string
      exchange?: string
    },
  ) {
    const normalized = normalizeCode(code)
    const ref = resolveCnInstrumentRef(
      opts.exchange
        ? {
          market: 'CN',
          assetClass: inferCnAssetClassFromSymbol(normalized, opts.exchange),
          symbol: normalized,
          exchange: opts.exchange,
        }
        : normalized,
    )
    return this.de.queryInstrumentData(ref, 'kline', {
      count: opts.count ?? 120,
      period: opts.period ?? 'daily',
      startDate: opts.startDate,
      endDate: opts.endDate,
    })
  }

  private async etfList(params: Record<string, unknown>, t0: number) {
    const code = params.code != null ? String(params.code) : ''
    const r = await this.de.queryInstrumentData(
      resolveCnInstrumentRef(code || '510300'),
      'etf_list',
      code ? { keyword: code } : {},
    )
    if (!r.success) return fail(instrumentQueryError(r, 'ETF 列表获取失败'), t0)
    const data = instrumentQueryData<unknown[]>(r) ?? []
    return ok(data, `ETF 列表 ${data.length} 条`, t0)
  }

  private async etfSnapshot(ref: InstrumentRef, t0: number) {
    return this.queryEtfInstrumentData({ instrument: ref }, 'etf_snapshot', t0)
  }

  private async fundSnapshot(ref: InstrumentRef, t0: number) {
    return this.queryFundInstrumentData({ instrument: ref }, 'fund_snapshot', t0)
  }

  private async fundDetail(params: Record<string, unknown>, t0: number) {
    const ref = resolveInstrumentFromParams(params)
    if (!ref) return fail('instrument 或 code 必填', t0)
    if (!isCnPublicFundRef(ref)) {
      return fail('当前标的不是公募基金，请重新搜索并选择基金', t0)
    }
    const settle = (cap: 'fund_snapshot' | 'fund_holdings' | 'fund_allocation') =>
      this.de.queryInstrumentData(ref, cap).catch((e: unknown) => ({
        success: false as const,
        error: e instanceof Error ? e.message : String(e),
      }))
    const [
      snapshotPart,
      holdingsPart,
      allocationPart,
    ] = await Promise.all([
      settle('fund_snapshot'),
      settle('fund_holdings'),
      settle('fund_allocation'),
    ])
    const merged = mergeFundDetailParts(instrumentHubCode(ref), {
      snapshot: snapshotPart,
      holdings: holdingsPart,
      allocation: allocationPart,
    })
    if (!merged.success || !merged.data) return fail(merged.message, t0)
    return ok(merged.data, merged.message, t0)
  }

  private async searchInstrumentsUnifiedHandler(
    keyword: string,
    limit: number,
    markets?: string[],
    t0 = Date.now(),
  ) {
    const m = markets as import('@opptrix/shared').Market[] | undefined
    try {
      const { items: rawItems, sources } = await searchInstrumentsUnified(this.de, {
        keyword,
        limit,
        markets: m,
      })
      const sourceLabel = sources.length ? sources.join('+') : 'online'
      const items = rawItems.map(h => ({
        code: h.code,
        name: h.name,
        market: h.market,
        assetClass: h.asset_class,
        exchange: h.exchange,
        instrument: h.instrument,
        refLabel: h.ref_label,
        source: h.source,
      }))
      return ok(
        {
          items,
          count: items.length,
          source: sourceLabel,
        },
        `标的搜索 ${items.length} 条`,
        t0,
      )
    } catch (err) {
      const { toInstrumentSearchError } = await import('@opptrix/a-stock-layer')
      return fail(toInstrumentSearchError(err).message, t0)
    }
  }

  private instrumentRouteHandlers(t0: number): InstrumentRouteHandlers {
    return {
      stockDetail: ref => this.stockDetail(ref, t0),
      etfSnapshot: ref => this.etfSnapshot(ref, t0),
      fundSnapshot: ref => this.fundSnapshot(ref, t0),
      usSnapshot: symbol => this.usSnapshot(symbol, t0),
      regionalSnapshot: (market, symbol) => this.regionalSnapshot(market, symbol, t0),
      cryptoSnapshot: pair => this.cryptoSnapshot(pair, t0),
      stockQuotes: refs => this.stockQuotes(refs, t0),
      cnInstrumentRealtime: ref => this.cnInstrumentRealtime(ref, t0),
      fundQuotes: refs => this.fundQuotes(refs, t0),
      fundRealtime: ref => this.fundRealtime(ref, t0),
      usRealtime: symbol => this.usRealtime(symbol, t0),
      regionalRealtime: (market, symbol) => this.regionalRealtime(market, symbol, t0),
      cryptoRealtime: pair => this.cryptoRealtime(pair, t0),
      usQuotes: refs => this.crossMarketBatchQuotes('US', refs, t0),
      regionalQuotes: (market, refs) => this.crossMarketBatchQuotes(market, refs, t0),
      cryptoQuotes: refs => this.crossMarketBatchQuotes('CRYPTO', refs, t0),
      stockChart: (ref, period, count, before, tail) =>
        this.stockChart(ref, period, count, before, tail, t0),
      usKline: (symbol, period, count, before, tail) =>
        this.usKline(symbol, { count, period, before, tail }, t0),
      regionalKline: (market, symbol, period, count, before, tail) =>
        this.regionalKline(market, symbol, { count, period, before, tail }, t0),
      cryptoKline: (pair, period, count) => this.cryptoKline(pair, { count, period }, t0),
      stockCyq: ref => this.stockCyq(ref, t0),
      institutionRating: (ref, groups) => this.institutionRating(ref, groups, t0),
      institutionReport: (params, groups) => this.institutionReport(params, groups, t0),
      searchInstruments: (keyword, limit, markets) =>
        this.searchInstrumentsUnifiedHandler(keyword, limit, markets, t0),
    }
  }

  private async instrumentSnapshot(params: Record<string, unknown>, t0: number) {
    const ref = resolveInstrumentFromParams(params)
    if (ref && params.fresh === true) {
      this.de.invalidateInstrumentQuoteCache(ref)
    }
    return routeInstrumentSnapshot(params, this.instrumentRouteHandlers(t0))
  }

  private async instrumentQuotes(params: Record<string, unknown>, t0: number) {
    const force = params.fresh === true || params.refresh === true || params.force === true
    const refs = resolveQuoteRefs(params)

    if (!force && refs.length) {
      const { quotes, newestMs } = this.diskCache.readInstrumentQuotesCache(refs)
      if (quotes.length) {
        const payload = ok(
          { quotes, failed: [], from_cache: true },
          `缓存 ${quotes.length} 只`,
          t0,
        )

        const stale = !newestMs || Date.now() - newestMs >= UI_CACHE_TTL_MS.watchlistQuotes
        const inflightKey = instrumentQuotesInflightKey(refs)
        if (stale && !this.instrumentQuotesRefreshInflight.has(inflightKey)) {
          const inflight = routeInstrumentQuotes(params, this.instrumentRouteHandlers(Date.now()), Date.now())
            .then(result => {
              if (result.success) this.diskCache.writeInstrumentQuotesFromResult(result)
              return result
            })
            .finally(() => {
              this.instrumentQuotesRefreshInflight.delete(inflightKey)
            })
          this.instrumentQuotesRefreshInflight.set(inflightKey, inflight)
          void inflight
        }
        return payload
      }
    }

    const result = await routeInstrumentQuotes(params, this.instrumentRouteHandlers(t0), t0)
    if (result.success) this.diskCache.writeInstrumentQuotesFromResult(result)
    return result
  }

  private async instrumentQuote(params: Record<string, unknown>, t0: number) {
    const ref = resolveInstrumentFromParams(params)
    if (!ref) return fail('instrument 必填', t0)
    const fresh = params.fresh !== false
    if (fresh) this.de.invalidateInstrumentQuoteCache(ref)
    return routeInstrumentQuote(params, this.instrumentRouteHandlers(t0), t0)
  }

  private async instrumentChart(params: Record<string, unknown>, t0: number) {
    return routeInstrumentChart(params, this.instrumentRouteHandlers(t0))
  }

  private async instrumentSearch(params: Record<string, unknown>, t0: number) {
    return routeInstrumentSearch(params, this.instrumentRouteHandlers(t0))
  }

  private async instrumentResolveNames(params: Record<string, unknown>, t0: number) {
    const rawList = params.instruments ?? params.refs
    if (!Array.isArray(rawList) || !rawList.length) {
      return fail('instruments 必填', t0)
    }
    const refs = instrumentRefsFromList(rawList)
    if (!refs.length) return fail('instruments 无效', t0)
    try {
      const { resolveInstrumentNamesViaStockIndex } = await import('@opptrix/a-stock-layer')
      const hits = await resolveInstrumentNamesViaStockIndex(refs)
      const items = hits.map(h => ({
        instrument: h.instrument,
        name: h.name,
        code: instrumentDisplayCode(h.instrument),
      }))
      return ok({ items, count: items.length }, `解析 ${items.length} 个标的名称`, t0)
    } catch (err) {
      const { toInstrumentSearchError } = await import('@opptrix/a-stock-layer')
      return fail(toInstrumentSearchError(err).message, t0)
    }
  }

  private instrumentCapabilities(params: Record<string, unknown>, t0: number) {
    return routeInstrumentCapabilities(params)
  }


  private async localUsScreen(params: Record<string, unknown>, t0: number) {
    return this.onlineListScreen('US', params, t0)
  }


  private async localCryptoScreen(params: Record<string, unknown>, t0: number) {
    const listResp = await this.cryptoList(params, t0)
    if (!listResp.success || !listResp.data) return listResp
    const rawItems = (listResp.data as { items?: Array<Record<string, unknown>> }).items ?? []
    const keyword = params.keyword != null ? String(params.keyword).trim().toLowerCase() : ''
    const quote = params.quote != null ? String(params.quote).trim().toUpperCase() : ''
    const baseContains = params.base_contains != null ? String(params.base_contains).trim().toLowerCase() : ''
    const topN = params.top_n != null ? Number(params.top_n) : 50

    const items = rawItems.filter(row => {
      const code = String(row.code ?? '').toLowerCase()
      const name = String(row.name ?? '').toLowerCase()
      const base = String(row.base ?? code.split('/')[0] ?? '').toLowerCase()
      const rowQuote = String(row.quote ?? code.split('/')[1] ?? '').toUpperCase()
      if (keyword && !code.includes(keyword) && !name.includes(keyword)) return false
      if (quote && rowQuote !== quote) return false
      if (baseContains && !base.includes(baseContains)) return false
      return true
    }).slice(0, Math.min(Math.max(topN, 1), 200))

    return ok({
      source: 'online',
      total_universe: rawItems.length,
      passed: items.length,
      available_quotes: [...new Set(items.map(i => String(i.quote ?? 'USDT')))],
      items,
    }, `Crypto 筛选 ${rawItems.length} 对，命中 ${items.length} 对`, t0)
  }

  private async onlineListScreen(
    market: 'US' | 'HK' | 'CN',
    params: Record<string, unknown>,
    t0: number,
  ) {
    try {
      const { listInstrumentsOnline } = await import('@opptrix/a-stock-layer')
      const data = await listInstrumentsOnline(this.de, market, {
        keyword: params.keyword as string | undefined,
        topN: params.top_n != null ? Number(params.top_n) : undefined,
      })
      return ok({
        source: 'stock_index',
        total_universe: data.total_universe,
        passed: data.passed,
        items: data.items.map(item => ({
          code: item.code,
          name: item.name,
          market: item.market,
          exchange: item.exchange,
        })),
      }, `${market} 列表筛选 ${data.total_universe} 只，命中 ${data.passed} 只`, t0)
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e), t0)
    }
  }

  private localRegionalScreen(
    market: 'JP' | 'KR' | 'HK',
    label: string,
    params: Record<string, unknown>,
    t0: number,
  ) {
    if (market === 'HK') {
      return this.onlineListScreen('HK', params, t0)
    }
    return fail(`${label}暂不支持在线名录筛选，请直接指定代码或使用 instrument_search`, t0)
  }


  private async localJpScreen(params: Record<string, unknown>, t0: number) {
    return this.localRegionalScreen('JP', '日股', params, t0)
  }


  private async localKrScreen(params: Record<string, unknown>, t0: number) {
    return this.localRegionalScreen('KR', '韩股', params, t0)
  }


  private async localHkScreen(params: Record<string, unknown>, t0: number) {
    return this.localRegionalScreen('HK', '港股', params, t0)
  }

  private async searchEtfs(params: Record<string, unknown>, t0: number) {
    const keyword = String(params.keyword ?? params.q ?? '').trim()
    if (keyword.length < 1) return fail('keyword 必填', t0)
    const limit = params.limit != null ? Number(params.limit) : 30
    const r = await this.de.queryInstrumentData(
      resolveCnInstrumentRef('510300'),
      'etf_list',
      { keyword },
    )
    if (!r.success) return fail(instrumentQueryError(r, 'ETF 搜索失败'), t0)
    const rows = instrumentQueryData<unknown[]>(r) ?? []
    const items = rows.map(row => {
      const it = row as Record<string, unknown>
      return { code: String(it.code ?? ''), name: String(it.name ?? '') }
    })
    return ok({ items, count: items.length, source: 'online' }, `ETF 搜索 ${items.length} 条`, t0)
  }


  /**
   * US/HK/CRYPTO 批量行情：经引擎复合能力 REALTIME_BATCH（Tickflow 等一次 HTTP），
   * 整批失败再回退逐标的 realtime（有界并发）。
   */
  private async crossMarketBatchQuotes(
    market: 'US' | 'HK' | 'CRYPTO',
    refs: InstrumentRef[],
    t0: number,
  ) {
    const unique = [...new Map(refs.map(r => [instrumentRefKey(r), r] as const)).values()]
    if (!unique.length) return ok({ quotes: [] }, '暂无', t0)

    const symbols = unique.map(r => (
      market === 'CRYPTO' ? instrumentDisplayCode(r) : r.symbol
    ))
    const batch = await this.de.queryMarketCapability<Record<string, unknown>>(
      Capability.REALTIME_BATCH,
      [{ market, symbols }],
    )
    if (batch.success && batch.data?.length) {
      const quotes: Record<string, unknown>[] = []
      const failed: { code: string; reason: QuoteFailedReason }[] = []
      for (const ref of unique) {
        const row = (batch.data as Record<string, unknown>[]).find(item => {
          const code = String(item.code ?? item.symbol ?? '')
          if (!code) return false
          if (code === ref.symbol) return true
          const upper = code.toUpperCase()
          const sym = ref.symbol.toUpperCase()
          return upper === sym || upper.endsWith(sym) || sym.endsWith(upper)
        })
        if (row) {
          const resolved = this.resolveCrossMarketQuoteWithStaleFallback(ref, row)
          if (resolved) {
            quotes.push(resolved)
          } else {
            failed.push({ code: instrumentDisplayCode(ref), reason: 'empty' })
          }
        } else {
          const stale = this.resolveCrossMarketQuoteWithStaleFallback(ref, null)
          if (stale) {
            quotes.push(stale)
          } else {
            failed.push({ code: instrumentDisplayCode(ref), reason: 'empty' })
          }
        }
      }
      if (quotes.length) {
        return ok(
          { quotes, failed: failed.length ? failed : undefined },
          `更新 ${quotes.length} 只`,
          t0,
        )
      }
    }

    // 无 batch 或整批空：有界并发逐标的（注释标明无法批时的降级）
    const quotes: Record<string, unknown>[] = []
    const failed: { code: string; reason: QuoteFailedReason }[] = []
    const concurrency = 5
    for (let i = 0; i < unique.length; i += concurrency) {
      const chunk = unique.slice(i, i + concurrency)
      await Promise.all(chunk.map(async ref => {
        const resp = market === 'US'
          ? await this.usRealtime(ref.symbol, t0)
          : market === 'HK'
            ? await this.regionalRealtime('HK', ref.symbol, t0)
            : await this.cryptoRealtime(instrumentDisplayCode(ref), t0)
        if (resp.success && resp.data && typeof resp.data === 'object') {
          const resolved = this.resolveCrossMarketQuoteWithStaleFallback(
            ref,
            resp.data as Record<string, unknown>,
          )
          if (resolved) {
            quotes.push(resolved)
            return
          }
        }
        const stale = this.resolveCrossMarketQuoteWithStaleFallback(ref, null)
        if (stale) {
          quotes.push(stale)
          return
        }
        failed.push({
          code: instrumentDisplayCode(ref),
          reason: classifyQuoteFailureMessage(String(resp.message ?? '')),
        })
      }))
    }
    if (!quotes.length) {
      return fail(
        batch.success === false
          ? (batch.error || `${market} 行情获取失败`)
          : `${market} 行情获取失败`,
        t0,
      )
    }
    return ok(
      { quotes, failed: failed.length ? failed : undefined },
      `更新 ${quotes.length} 只`,
      t0,
    )
  }

  private async usRealtime(symbol: string, t0: number) {
    const r = await this.de.queryInstrumentData(
      { market: 'US', assetClass: 'EQUITY', symbol },
      'realtime',
    )
    if (!r.success) return fail(instrumentQueryError(r, '美股行情获取失败'), t0)
    return ok(instrumentQueryData<unknown[]>(r)?.[0] ?? null, `${symbol} 美股行情`, t0)
  }

  private async regionalRealtime(market: 'HK', symbol: string, t0: number) {
    const r = await this.de.queryInstrumentData(
      { market, assetClass: 'EQUITY', symbol },
      'realtime',
    )
    if (!r.success) return fail(instrumentQueryError(r, `${market} 行情获取失败`), t0)
    return ok(instrumentQueryData<unknown[]>(r)?.[0] ?? null, `${symbol} ${market} 行情`, t0)
  }

  private mapCrossMarketKlineItems(
    items: Record<string, unknown>[],
    symbol: string,
  ): StockKline[] {
    return items.map(row => ({
      code: String(row.code ?? symbol),
      date: String(row.date ?? row.time ?? ''),
      open: Number(row.open ?? row.close ?? row.price ?? 0),
      close: Number(row.close ?? row.price ?? row.open ?? 0),
      high: Number(row.high ?? row.close ?? row.price ?? 0),
      low: Number(row.low ?? row.close ?? row.price ?? 0),
      volume: Number(row.volume ?? 0),
      amount: Number(row.amount ?? 0),
      changePct: row.changePct != null
        ? Number(row.changePct)
        : row.change_pct != null
          ? Number(row.change_pct)
          : null,
      turnoverRate: row.turnoverRate != null
        ? Number(row.turnoverRate)
        : row.turnover_rate != null
          ? Number(row.turnover_rate)
          : null,
    })).filter(row => row.date)
  }

  private mapCrossMarketChartIndicators(code: string, klines: StockKline[]) {
    return this.sortChartBars(computeIndicators(code, klines).map(row => ({
      time: row.date,
      ma5: row.ma5,
      ma10: row.ma10,
      ma20: row.ma20,
      ma60: row.ma60,
      rsi6: row.rsi6,
      rsi12: row.rsi12,
      macd: row.macd,
      macdSignal: row.macdSignal,
      macdHist: row.macdHist,
    })))
  }

  private async crossMarketKlineChart(
    market: 'US' | 'HK',
    symbol: string,
    period: string,
    count: number,
    before: string,
    tail: number,
    t0: number,
  ) {
    const ref = { market, assetClass: 'EQUITY' as const, symbol }
    const cap = this.crossMarketMaxBars(period)
    const safeCount = Math.max(20, Math.min(count || this.defaultChartCount(period), cap))
    const preClose: number | null = null
    const chartTimeZone = crossMarketChartTimeZone(market)
    const marketLabel = market === 'US' ? '美股' : '港股'

    // 美港右侧不展示分时/五日：产品只提供日周月季年 K
    const p = period.trim().toLowerCase()
    if (p === 'intraday' || p === '5day' || p === 'fdays' || p === 'five') {
      return fail(`${marketLabel}暂不支持该周期，请查看日K及更长周期`, t0)
    }

    const fetched = await this.fetchCrossMarketChartKlines(
      market,
      symbol,
      period,
      safeCount,
      before,
      tail,
    )
    if (!fetched?.klines.length) {
      return fail(`${marketLabel} K 线获取失败`, t0)
    }

    const items = fetched.klines.map(row => ({
      code: row.code,
      date: row.date,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
      amount: row.amount,
      changePct: row.changePct,
      turnoverRate: row.turnoverRate,
    }))
    const indicators = this.mapCrossMarketChartIndicators(symbol, fetched.klines)
    return ok(
      {
        symbol,
        period,
        items,
        indicators,
        count: items.length,
        preClose,
        pre_close: preClose,
        hasMore: fetched.hasMore,
        chart_time_zone: chartTimeZone,
      },
      `K 线 ${items.length} 根`,
      t0,
    )
  }

  private async regionalKline(
    market: 'HK',
    symbol: string,
    params: Record<string, unknown>,
    t0: number,
  ) {
    const count = params.count != null ? Number(params.count) : 180
    const period = String(params.period ?? 'daily')
    const before = String(params.before ?? '')
    const tail = params.tail != null ? Number(params.tail) : 0
    return this.crossMarketKlineChart('HK', symbol, period, count, before, tail, t0)
  }

  private async regionalSnapshot(market: 'HK', symbol: string, t0: number) {
    return this.crossMarketStockDetail(market, symbol, t0)
  }

  private async usKline(symbol: string, params: Record<string, unknown>, t0: number) {
    const count = params.count != null ? Number(params.count) : 180
    const period = String(params.period ?? 'daily')
    const before = String(params.before ?? '')
    const tail = params.tail != null ? Number(params.tail) : 0
    return this.crossMarketKlineChart('US', symbol, period, count, before, tail, t0)
  }

  private async usProfile(symbol: string, t0: number) {
    const r = await this.de.queryInstrumentData(
      { market: 'US', assetClass: 'EQUITY', symbol },
      'profile',
    )
    if (!r.success) return fail(instrumentQueryError(r, '美股概况获取失败'), t0)
    return ok(instrumentQueryData<unknown[]>(r)?.[0] ?? null, `${symbol} 概况`, t0)
  }

  private async usFinancials(symbol: string, params: Record<string, unknown>, t0: number) {
    const reportType = params.report_type != null ? String(params.report_type) : 'annual'
    const r = await this.de.queryInstrumentData(
      { market: 'US', assetClass: 'EQUITY', symbol },
      'financials',
      { reportDate: String(params.report_date ?? ''), reportType },
    )
    if (!r.success) return fail(instrumentQueryError(r, '美股财报获取失败'), t0)
    const items = instrumentQueryData<unknown[]>(r) ?? []
    return ok({ symbol, items, count: items.length }, `财报 ${items.length} 期`, t0)
  }

  private async crossMarketStockDetail(market: 'US' | 'HK', symbol: string, t0: number) {
    const ref = normalizeInstrumentRef({ market, assetClass: 'EQUITY', symbol })
    const snapshotR = await this.de.queryInstrumentData(ref, 'snapshot')
    const snap = instrumentQueryData<Record<string, unknown>>(snapshotR)

    const quoteR = await this.stockDetailOptional(
      (async () => {
        const engineR = await this.de.queryInstrumentData(ref, 'realtime')
        const row = instrumentQueryData<import('@opptrix/shared').StockRealtime[]>(engineR)?.[0]
        if (row) return { success: true as const, data: [row as unknown as Record<string, unknown>] }
        return { success: false as const, data: null as Record<string, unknown>[] | null }
      })(),
    )

    const snapProfile = snap?.profile as Record<string, unknown> | null
    let profile = snapProfile
      ? normalizeCrossMarketProfile(market, ref.symbol, snapProfile)
      : null
    if (!profile) {
      const profileR = await this.de.queryInstrumentData(ref, 'profile')
      const row = instrumentQueryData<unknown[]>(profileR)?.[0]
      if (row && typeof row === 'object') {
        profile = normalizeCrossMarketProfile(market, ref.symbol, row as Record<string, unknown>)
      }
    }

    const liveRow = quoteR.data?.[0] ?? null
    const resolvedLive = this.resolveCrossMarketQuoteWithStaleFallback(
      ref,
      liveRow as Record<string, unknown> | null,
    )
    let quote = mergeCrossMarketQuote(
      (snap?.quote ?? null) as Record<string, unknown> | null,
      resolvedLive,
    )
    if (!quote) {
      quote = mergeCrossMarketQuote(
        null,
        this.resolveCrossMarketQuoteWithStaleFallback(ref, null),
      )
    }
    if (!quote) {
      quote = quoteFromRecentKlines(snap?.recentKlines as unknown[] | undefined)
    }

    const payload = buildCrossMarketDetailPayload(market, ref.symbol, snap ?? null, {
      profile,
      quote,
      notices: [],
      articles: [],
      financialHistory: [],
      dividends: [],
      shareholders: null,
      reviewProspect: null,
      relatedStocks: [],
      seniorTrades: [],
      tradingDistribution: null,
    })

    if (!payload.quote && !(payload.recentKlines as unknown[])?.length) {
      return fail(`${market === 'US' ? '美股' : '港股'}详情获取失败`, t0)
    }

    return ok(payload, `${market === 'US' ? '美股' : '港股'}行情`, t0)
  }

  private async usSnapshot(symbol: string, t0: number) {
    return this.crossMarketStockDetail('US', symbol, t0)
  }

  private async usStockList(params: Record<string, unknown>, t0: number) {
    const { listInstrumentsOnline } = await import('@opptrix/a-stock-layer')
    const limit = params.limit != null ? Number(params.limit) : 5000
    const data = await listInstrumentsOnline(this.de, 'US', {
      keyword: params.keyword != null ? String(params.keyword) : undefined,
      topN: Math.min(limit, 200),
    })
    const items = data.items.map(hit => ({
      code: hit.code,
      name: hit.name ?? hit.code,
      market: hit.market,
    }))
    return ok({ items, count: items.length, source: 'stock_index' }, `美股列表 ${items.length} 条`, t0)
  }

  private async localUsList(params: Record<string, unknown>, t0: number) {
    return this.usStockList(params, t0)
  }

  private async searchUsStocks(params: Record<string, unknown>, t0: number) {
    const keyword = String(params.keyword ?? params.q ?? '').trim()
    if (keyword.length < 1) return fail('keyword 必填', t0)
    const limit = params.limit != null ? Number(params.limit) : 30
    try {
      const { searchInstrumentsOnline } = await import('@opptrix/a-stock-layer')
      const hits = await searchInstrumentsOnline(this.de, keyword, limit, ['US'])
      const items = hits.map(hit => ({
        code: hit.code,
        name: hit.name ?? hit.code,
        market: hit.market,
      }))
      const source = hits[0]?.source ?? 'stock_index'
      return ok({ items, count: items.length, source }, `美股搜索 ${items.length} 条`, t0)
    } catch (err) {
      const { toInstrumentSearchError } = await import('@opptrix/a-stock-layer')
      return fail(toInstrumentSearchError(err).message, t0)
    }
  }

  private async cryptoRealtime(pair: string, t0: number) {
    const r = await this.de.queryInstrumentData(cryptoRefFromPair(pair), 'realtime')
    if (!r.success) return fail(instrumentQueryError(r, 'Crypto 行情获取失败'), t0)
    return ok(instrumentQueryData<unknown[]>(r)?.[0] ?? null, `${pair} 行情`, t0)
  }

  private async cryptoKline(pair: string, params: Record<string, unknown>, t0: number) {
    const count = params.count != null ? Number(params.count) : 180
    const period = String(params.period ?? 'daily')
    const r = await this.de.queryInstrumentData(cryptoRefFromPair(pair), 'kline', { count, period })
    if (!r.success) return fail(instrumentQueryError(r, 'Crypto K 线获取失败'), t0)
    const items = instrumentQueryData<unknown[]>(r) ?? []
    return ok({ pair, items, count: items.length }, `K 线 ${items.length} 根`, t0)
  }

  private async cryptoSnapshot(pair: string, t0: number) {
    const r = await this.de.queryInstrumentData(cryptoRefFromPair(pair), 'snapshot')
    if (!r.success) return fail('Crypto 快照获取失败', t0)
    return ok(instrumentQueryData(r), 'Crypto 快照', t0)
  }

  private async cryptoList(params: Record<string, unknown>, t0: number) {
    const keyword = params.keyword != null ? String(params.keyword) : ''
    const r = await this.de.queryInstrumentData(
      { market: 'CRYPTO', assetClass: 'CRYPTO_SPOT', symbol: 'BTC', quote: 'USDT' },
      'stock_list',
      { keyword },
    )
    if (!r.success) return fail(instrumentQueryError(r, 'Crypto 列表获取失败'), t0)
    const items = instrumentQueryData<unknown[]>(r) ?? []
    return ok({ items, count: items.length }, `Crypto 列表 ${items.length} 条`, t0)
  }

  private async localCryptoList(params: Record<string, unknown>, t0: number) {
    return this.cryptoList(params, t0)
  }

  private async searchCryptoPairs(params: Record<string, unknown>, t0: number) {
    const keyword = String(params.keyword ?? params.q ?? '').trim()
    if (keyword.length < 1) return fail('keyword 必填', t0)
    const r = await this.de.queryInstrumentData(
      { market: 'CRYPTO', assetClass: 'CRYPTO_SPOT', symbol: 'BTC', quote: 'USDT' },
      'stock_list',
      { keyword },
    )
    if (!r.success) return fail(instrumentQueryError(r, 'Crypto 搜索失败'), t0)
    const items = (instrumentQueryData<unknown[]>(r) ?? []).map(raw => {
      const row = raw as { code?: string; name?: string; market?: string }
      return {
        code: String(row.code ?? ''),
        name: String(row.name ?? row.code ?? ''),
        market: row.market ?? 'CRYPTO',
      }
    })
    return ok({ items, count: items.length, source: 'online' }, `Crypto 搜索 ${items.length} 条`, t0)
  }

  private async portfolioTrades(code: string, market: string | undefined, t0: number) {
    const trades = this.de.portfolio.trades(code, market as import('@opptrix/shared').Market | undefined)
    return ok({ trades, count: trades.length }, `交易记录 ${trades.length} 条`, t0)
  }

  private async portfolioHoldings(t0: number) {
    const holdings = await this.de.portfolio.holdings(true)
    return ok({ holdings, count: holdings.length }, `当前持仓 ${holdings.length} 只`, t0)
  }

  private async portfolioSummary(t0: number, params: Record<string, unknown> = {}) {
    const force = params.force === true || params.refresh === true

    if (!force) {
      const mem = this.portfolioSummaryMemCache
      if (mem && Date.now() - mem.at < UI_CACHE_TTL_MS.portfolioSummary) {
        return mem.payload
      }

      const disk = this.diskCache.readPortfolioSummaryCache()
      if (disk?.data) {
        const payload = ok(
          { ...disk.data, from_cache: true },
          disk.message,
          t0,
        )
        this.portfolioSummaryMemCache = { at: disk.cached_at_ms, payload }

        const stale = Date.now() - disk.cached_at_ms >= UI_CACHE_TTL_MS.portfolioSummary
        if (stale && !this.portfolioSummaryRefreshInflight) {
          const inflight = this.fetchPortfolioSummary(Date.now())
            .then(result => {
              if (result.success) {
                this.diskCache.writePortfolioSummaryCache(result)
                this.portfolioSummaryMemCache = { at: Date.now(), payload: result }
              }
              return result
            })
            .finally(() => {
              this.portfolioSummaryRefreshInflight = null
            })
          this.portfolioSummaryRefreshInflight = inflight
          void inflight
        }
        return payload
      }
    }

    const result = await this.fetchPortfolioSummary(t0)
    if (result.success) {
      this.diskCache.writePortfolioSummaryCache(result)
      this.portfolioSummaryMemCache = { at: Date.now(), payload: result }
    }
    return result
  }

  private async fetchPortfolioSummary(t0: number) {
    const summary = await this.de.portfolio.summary(true)
    return ok(summary, `持仓 ${summary.holdingsCount} 只`, t0)
  }

  private portfolioFeeGlobal(t0: number) {
    return ok({ globalFees: this.de.portfolio.getGlobalFees() }, '全局费率', t0)
  }

  private portfolioFeeGlobalSave(params: Record<string, unknown>, t0: number) {
    const globalFees = params.globalFees ?? params.global_fees
    if (!globalFees || typeof globalFees !== 'object') return fail('globalFees 必填', t0)
    const result = this.de.portfolio.setGlobalFees(globalFees as import('@opptrix/shared').PortfolioGlobalFees)
    return ok(
      { globalFees: result.globalFees, recalculatedTrades: result.recalculatedTrades },
      result.recalculatedTrades > 0
        ? `全局费率已保存，已重算 ${result.recalculatedTrades} 笔交易费用`
        : '全局费率已保存',
      t0,
    )
  }

  private portfolioFeeInstrument(code: string, market: string | undefined, t0: number) {
    if (!code.trim()) return fail('code 必填', t0)
    // 裸码 / Opptrix 均可；getInstrumentFees 内部升格 + 双读旧键
    const data = this.de.portfolio.getInstrumentFees(code, market as import('@opptrix/shared').Market | undefined)
    return ok(data, '标的费率', t0)
  }

  private portfolioFeeInstrumentSave(params: Record<string, unknown>, t0: number) {
    const code = String(params.code ?? '').trim()
    if (!code) return fail('code 必填', t0)
    const market = params.market != null ? String(params.market) : undefined
    const assetClassRaw = params.assetClass ?? params.asset_class
    const assetClass = assetClassRaw != null
      ? String(assetClassRaw) as import('@opptrix/shared').AssetClass
      : undefined
    const overrides = params.overrides ?? params.instrument_fees
    if (!overrides || typeof overrides !== 'object') return fail('overrides 必填', t0)
    const result = this.de.portfolio.setInstrumentFees(
      code,
      overrides as import('@opptrix/shared').InstrumentFeeOverrides,
      market as import('@opptrix/shared').Market | undefined,
      assetClass,
    )
    const snapshot = this.de.portfolio.getInstrumentFees(
      code,
      market as import('@opptrix/shared').Market | undefined,
      assetClass,
    )
    return ok(
      {
        ledgerKind: snapshot.ledgerKind,
        overrides: result.overrides,
        globalFees: snapshot.globalFees,
        recalculatedTrades: result.recalculatedTrades,
      },
      result.recalculatedTrades > 0
        ? `标的费率已保存，已重算 ${result.recalculatedTrades} 笔交易费用`
        : '标的费率已保存',
      t0,
    )
  }

  private watchlistList(t0: number) {
    // 在线版：关注列表存于引擎（user-store 侧持久化）；未消歧项后台走 Tickflow 在线补强
    const items = this.de.watchlist.list()
    void runWatchlistOnlineDisambiguationPass(items).then(online => {
      if (online.resolved <= 0) return
      this.de.watchlist.replace(online.items)
      this.de.watchlist.flush()
    }).catch(err => {
      console.warn(
        '[research-hub] watchlist online disambiguation failed:',
        err instanceof Error ? err.message : String(err),
      )
    })
    const groupsDoc = this.de.watchlist.groups.get()
    return ok(
      {
        items,
        count: items.length,
        groups: groupsDoc.groups,
        membership: groupsDoc.membership,
        disambiguation_candidates: {},
      },
      `关注列表 ${items.length} 只`,
      t0,
    )
  }

  private watchlistSave(params: Record<string, unknown>, t0: number) {
    const items = Array.isArray(params.items) ? params.items as import('@opptrix/a-stock-layer').WatchlistItem[] : []
    const prevItems = this.de.watchlist.list()
    const saved = this.de.watchlist.replace(items)
    // Durable across process restart: debounce merges rapid in-process replaces,
    // but HTTP save must flush before the response returns.
    this.de.watchlist.flush()
    const nextKeys = new Set(saved.map(item => watchlistItemKey(item)))
    const removed = prevItems.filter(item => !nextKeys.has(watchlistItemKey(item)))
    for (const item of removed) {
      const ref = instrumentRefFromWatchlistItem(item)
      if (ref) this.de.invalidateInstrumentQuoteCache(ref)
    }
    return ok({ items: saved, count: saved.length }, `已保存关注 ${saved.length} 只`, t0)
  }

  private watchlistGroupsGet(t0: number) {
    const doc = this.de.watchlist.groups.get()
    return ok(doc, `关注分组 ${doc.groups.length} 个`, t0)
  }

  private watchlistGroupsSave(params: Record<string, unknown>, t0: number) {
    const doc = this.de.watchlist.groups.replace({
      groups: Array.isArray(params.groups)
        ? params.groups as import('@opptrix/a-stock-layer').WatchlistGroup[]
        : [],
      membership: params.membership && typeof params.membership === 'object' && !Array.isArray(params.membership)
        ? params.membership as Record<string, string[]>
        : {},
    })
    return ok(doc, `已保存关注分组 ${doc.groups.length} 个`, t0)
  }
}

export { ResearchHub as default }
