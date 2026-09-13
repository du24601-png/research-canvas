/**
 * Phase A late-bound capability handlers — llm / data.query / shell / schedule.
 *
 * These require services constructed in index.ts (hub, scheduleService).
 * `bindLateBoundServices()` is called post-construction to make them available;
 * `registerLateBoundHandlers()` registers the token handlers on the host.
 *
 * Phase A scope (per ARCHITECTURE §10.1):
 *   - data.query / data.search → real (hub.dispatch; v3.5 read-only standard
 *     data features allowlist, 22 entries + market_capability_query with
 *     server-side MARKET_LEVEL_CAPABILITIES validation)
 *   - schedule.list            → real (ScheduleService.listJobs)
 *   - llm.chat                 → thin (requires agent session; Phase B wires direct provider)
 *   - shell.run                → thin (design: "A thin / B grant UI")
 */

import type { CapabilityHost, CapabilityHandler } from './capability-host.js'
import { MARKET_LEVEL_CAPABILITIES } from '@opptrix/a-stock-layer'
import { getMarketPlane } from '../../market-data-plane.js'

export type LateBoundHub = {
  dispatch: (feature: string, params: unknown) => Promise<unknown>
}

export type LateBoundSchedule = {
  listJobs: () => Array<Record<string, unknown>>
}

/** Module-level service registry — populated by bindLateBoundServices(). */
const lateBound: {
  hub?: LateBoundHub
  schedule?: LateBoundSchedule
} = {}

export type BindLateBoundOptions = {
  hub?: LateBoundHub
  schedule?: LateBoundSchedule
}

/**
 * Bind real service instances. Called from index.ts after hub + scheduleService
 * are constructed. Always overwrites (pass undefined to unbind).
 */
export function bindLateBoundServices(opts: BindLateBoundOptions): void {
  lateBound.hub = opts.hub
  lateBound.schedule = opts.schedule
}

// ── data.query / data.search ────────────────────────────────────────────────

/**
 * Allowlist of hub features callable by extensions (fail-closed).
 * v3.5 扩容（4 → 22）：只读标准数据 feature 全量收录 — 行情/搜索、能力目录发现、
 * 标的画像/财务/股东/分红、ETF/基金、市场级 regime/交易日历/交易时段。
 * 写操作与 provider 管理 feature 永远不在名单内。
 */
const EXTENSION_DATA_FEATURES: ReadonlySet<string> = new Set([
  // 实时行情 / 搜索（Phase A 原有）
  'instrument_quotes',
  'instrument_quote',
  'instrument_snapshot',
  'instrument_search',
  // 能力目录发现（instrument 级 + 三界全目录）
  'instrument_capabilities',
  'market_capabilities',
  // 标的标准数据（K线 / 画像 / 三大报表 / 财务 / 股东 / 分红 / 机构评级）
  'instrument_chart',
  'instrument_profile',
  'instrument_financials',
  'instrument_balance_sheet',
  'instrument_cash_flow',
  'instrument_income_statement',
  'instrument_shareholders',
  'instrument_dividend',
  'instrument_institution_rating',
  // ETF / 基金
  'etf_snapshot',
  'etf_nav',
  'fund_snapshot',
  'fund_nav',
  // 市场级（情绪 regime / 交易日历 / 交易时段）
  'market_regime',
  'trade_calendar',
  'market_session',
])

/**
 * Market-level capability names — imported from a-stock-layer (single source
 * of truth) so the extension gate validates `market_capability_query` params
 * server-side instead of transparently forwarding arbitrary capability names
 * to the engine.
 */
const MARKET_CAPABILITY_NAMES: ReadonlySet<string> = new Set(
  MARKET_LEVEL_CAPABILITIES.map((cap) => String(cap)),
)

const dataQueryHandler: CapabilityHandler = async (args) => {
  if (!lateBound.hub) {
    return { error: 'data service unavailable (hub not bound)', code: 'service_unavailable' }
  }
  const feature = String(args.feature ?? 'instrument_quotes')
  const params = (args.params ?? {}) as unknown
  // Parameterized passthrough: `market_capability_query` is allowed, but the
  // requested capability name must hit the engine's market-level whitelist.
  if (feature === 'market_capability_query') {
    const capability = String(
      (params as Record<string, unknown> | null)?.capability ?? '',
    ).trim()
    if (!MARKET_CAPABILITY_NAMES.has(capability)) {
      return {
        error: `market capability not allowed for extensions: ${capability || '(empty)'}`,
        code: 'unknown_capability',
      }
    }
    return await lateBound.hub.dispatch(feature, params)
  }
  if (!EXTENSION_DATA_FEATURES.has(feature)) {
    return { error: `hub feature not allowed for extensions: ${feature}`, code: 'feature_denied' }
  }
  return await lateBound.hub.dispatch(feature, params)
}

// ── schedule.list ───────────────────────────────────────────────────────────

const scheduleHandler: CapabilityHandler = async (args) => {
  if (!lateBound.schedule) {
    return { error: 'schedule service unavailable', code: 'service_unavailable' }
  }
  const op = String(args.op ?? 'list')
  if (op === 'list') {
    const jobs = lateBound.schedule.listJobs()
    // Project to a safe subset (no internal handles).
    return {
      jobs: jobs.map((j) => ({
        id: j.id,
        kind: j.kind,
        title: j.title,
        enabled: j.enabled,
      })),
    }
  }
  return { error: `unknown schedule op: ${op}`, code: 'invalid_args' }
}

// ── llm.chat (thin — Phase A) ───────────────────────────────────────────────

const llmChatHandler: CapabilityHandler = async (_args, ctx) => {
  // Phase A: LLM inference requires an agent session (model routing, tool loop,
  // usage metering). Direct provider access is Phase B (agentLoop default off).
  return {
    error:
      'llm.chat requires an agent session in Phase A. Direct provider access lands in Phase B.',
    code: 'phase_a_thin',
    pluginId: ctx.pluginId,
  }
}

// ── shell.run (thin — Phase A) ──────────────────────────────────────────────

const shellRunHandler: CapabilityHandler = async (_args, ctx) => {
  // Phase A: shell is explicitly "thin" per ARCHITECTURE §10.1 (grant UI in Phase B).
  return {
    error: 'shell.run is thin in Phase A (grant UI lands in Phase B).',
    code: 'phase_a_thin',
    pluginId: ctx.pluginId,
  }
}

/**
 * Register late-bound token handlers on the capability host.
 * Called once at host construction (platform context); services may be bound
 * later via bindLateBoundServices().
 */
export function registerLateBoundHandlers(host: CapabilityHost): void {
  host.register('data.subscribe', async (args, ctx) => {
    if (!getMarketPlane) {
      return { error: 'market plane unavailable', code: 'service_unavailable' }
    }
    const instruments = Array.isArray(args.instruments) ? args.instruments : []
    if (instruments.length === 0) {
      return { error: 'instruments required', code: 'invalid_args' }
    }
    const plane = getMarketPlane()
    const count = plane.subscribe(ctx.pluginId, instruments as never[])
    return {
      ok: true,
      subscribed: count,
      topic: 'market.quote.updated',
      note: 'listen via events.subscribe topic market.quote.* (events.subscribe permission)',
    }
  })

  host.register('data.', dataQueryHandler)
  host.register('schedule.', scheduleHandler)
  host.register('llm.', llmChatHandler)
  host.register('shell.', shellRunHandler)
}
