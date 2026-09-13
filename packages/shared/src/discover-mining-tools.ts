import type { DiscoverStrategyProfile } from './discover-profile-types.js'
import { getDiscoverProfileDefinition, type DiscoverMiningToolGroup } from './discover-profile-registry.js'

/** 跨市场统一行情工具 — 挖掘阶段可用子集 */
export const UNIFIED_INSTRUMENT_MINING_TOOLS = [
  'get_instrument_capabilities',
  'get_instrument_snapshot',
  'get_instrument_quotes',
] as const

const REGIONAL_MINING_TOOLS = [
  'search_instruments',
  ...UNIFIED_INSTRUMENT_MINING_TOOLS,
] as const

/** Agent 挖掘工具组 — 与 packages/agent tool-meta 对齐 */
export const DISCOVER_MINING_TOOL_GROUPS: Record<DiscoverMiningToolGroup, readonly string[]> = {
  cn_equity_full: [],
  cn_etf: [
    'search_instruments',
    'get_etf_list',
    'get_etf_nav',
    'get_etf_holdings',
    'get_fund_list',
    'get_fund_nav',
    'get_fund_holdings',
    'get_fund_profile',
    'get_instrument_snapshot',
  ],
  us_equity: [...REGIONAL_MINING_TOOLS],
  crypto_spot: [...REGIONAL_MINING_TOOLS],
  jp_equity: [],
  kr_equity: [],
  hk_equity: [...REGIONAL_MINING_TOOLS],
  none: [],
}

export function discoverMiningToolNamesForProfile(
  profile: DiscoverStrategyProfile,
): readonly string[] {
  const group = getDiscoverProfileDefinition(profile)?.miningToolGroup ?? 'none'
  return DISCOVER_MINING_TOOL_GROUPS[group] ?? DISCOVER_MINING_TOOL_GROUPS.none
}
