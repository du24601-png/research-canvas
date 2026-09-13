import type { MarketDataPackId } from './pack-registry.js'
import type { MarketRegimeKind } from './market-regime.js'
import {
  DISCOVER_PROFILE_REGISTRY,
  getDiscoverProfileDefinition,
  type DiscoverPrescreenMode,
} from './discover-profile-registry.js'
import {
  type DiscoverStrategyProfile,
  DISCOVER_STRATEGY_PROFILES,
  isDiscoverStrategyProfile,
} from './discover-profile-types.js'

export type { DiscoverStrategyProfile } from './discover-profile-types.js'
export { isDiscoverStrategyProfile } from './discover-profile-types.js'

export const DISCOVER_PROFILE_ORDER: DiscoverStrategyProfile[] = DISCOVER_PROFILE_REGISTRY.map(
  row => row.id,
) as DiscoverStrategyProfile[]

export const DISCOVER_PROFILE_LABELS: Record<DiscoverStrategyProfile, string> = Object.fromEntries(
  DISCOVER_PROFILE_REGISTRY.map(row => [row.id, row.label]),
) as Record<DiscoverStrategyProfile, string>

export const DISCOVER_PROFILE_DESCRIPTIONS: Record<DiscoverStrategyProfile, string> = Object.fromEntries(
  DISCOVER_PROFILE_REGISTRY.map(row => [row.id, row.description]),
) as Record<DiscoverStrategyProfile, string>

export const DISCOVER_PROFILE_REQUIRES_PACK: Record<DiscoverStrategyProfile, MarketDataPackId | null> = Object.fromEntries(
  DISCOVER_PROFILE_REGISTRY.map(row => [row.id, row.packId]),
) as Record<DiscoverStrategyProfile, MarketDataPackId | null>

export const CN_ETF_DISCOVER_FACTORS = [
  'premium_rate', 'scale_yi', 'nav',
] as const

export const US_DISCOVER_FILTERS = [
  'keyword', 'industry_contains',
] as const

export const CRYPTO_DISCOVER_FILTERS = [
  'keyword', 'quote', 'base_contains',
] as const

export const REGIONAL_EQUITY_DISCOVER_FILTERS = [
  'keyword', 'industry_contains',
] as const

export function discoverFactorsForProfile(profile: DiscoverStrategyProfile): readonly string[] {
  switch (profile) {
    case 'cn_etf':
      return CN_ETF_DISCOVER_FACTORS
    case 'us_equity':
      return US_DISCOVER_FILTERS
    case 'crypto_spot':
      return CRYPTO_DISCOVER_FILTERS
    case 'jp_equity':
    case 'kr_equity':
    case 'hk_equity':
      return REGIONAL_EQUITY_DISCOVER_FILTERS
    default:
      return []
  }
}

export function discoverPrescreenMode(profile: DiscoverStrategyProfile): DiscoverPrescreenMode {
  return getDiscoverProfileDefinition(profile)?.prescreenMode ?? 'blocked'
}

export function isDiscoverProfileMiningReady(profile: DiscoverStrategyProfile): boolean {
  return getDiscoverProfileDefinition(profile)?.miningReady ?? false
}

export interface DiscoverProfileReadinessContext {
  packs: import('./pack-registry.js').MarketDataPackConfig
  stock_count: number
  etf_count: number
  us_count: number
  crypto_count: number
  jp_count: number
  kr_count: number
  hk_count: number
  cn_is_ready: boolean
}

export interface DiscoverProfileReadiness {
  profile: DiscoverStrategyProfile
  ready: boolean
  mode: 'online' | 'offline' | 'blocked'
  message: string
}

export function listDiscoverProfileMeta(): Array<{
  id: DiscoverStrategyProfile
  label: string
  description: string
  requires_pack: MarketDataPackId | null
  factor_count: number
}> {
  return DISCOVER_PROFILE_ORDER.map(id => ({
    id,
    label: DISCOVER_PROFILE_LABELS[id],
    description: DISCOVER_PROFILE_DESCRIPTIONS[id],
    requires_pack: DISCOVER_PROFILE_REQUIRES_PACK[id],
    factor_count: discoverFactorsForProfile(id).length,
  }))
}

function packEnabled(
  ctx: DiscoverProfileReadinessContext,
  packId: MarketDataPackId | null,
): boolean {
  if (!packId) return true
  return ctx.packs[packId]?.enabled === true
}

export function assessDiscoverProfileReadiness(
  profile: DiscoverStrategyProfile,
  ctx: DiscoverProfileReadinessContext,
): DiscoverProfileReadiness {
  const def = getDiscoverProfileDefinition(profile)
  const mode = discoverPrescreenMode(profile)
  const label = DISCOVER_PROFILE_LABELS[profile]

  if (mode === 'blocked') {
    const message = profile === 'cn_equity'
      ? 'A 股自动选股策略已移除（本地因子不可用）；请改用 ETF/跨市场或指定代码研究'
      : `${label}标准行情与挖掘能力暂未接入`
    return { profile, ready: false, mode: 'blocked', message }
  }

  const packId = def?.packId ?? DISCOVER_PROFILE_REQUIRES_PACK[profile]
  if (packId && !packEnabled(ctx, packId)) {
    return {
      profile,
      ready: false,
      mode: 'blocked',
      message: `请先启用 ${label} 数据包`,
    }
  }

  if (!def?.miningReady) {
    return {
      profile,
      ready: false,
      mode: 'blocked',
      message: `${label}挖掘暂未就绪`,
    }
  }

  return {
    profile,
    ready: true,
    mode: 'online',
    message: `${label}可在线挖掘`,
  }
}

export function assessAllDiscoverProfileReadiness(
  ctx: DiscoverProfileReadinessContext,
): DiscoverProfileReadiness[] {
  return DISCOVER_PROFILE_ORDER.map(profile => assessDiscoverProfileReadiness(profile, ctx))
}

export const ETF_REGIME_DETAIL: Record<MarketRegimeKind, string> = {
  panic: '优先折溢价接近净值的宽基 ETF',
  cautious: '规模适中、折溢价温和的宽基 ETF',
  neutral: '均衡筛选宽基与大盘流动性 ETF',
  euphoria: '大盘高流动性 ETF，折溢价不宜过高',
}

export const US_REGIME_STRATEGY_IDS: Record<MarketRegimeKind, readonly string[]> = {
  panic: ['us_defensive', 'us_quality'],
  cautious: ['us_quality', 'us_momentum'],
  neutral: ['us_momentum', 'us_growth'],
  euphoria: ['us_momentum', 'us_growth'],
}

export function resolveRegimeStrategyIds(
  profile: DiscoverStrategyProfile,
  regime: MarketRegimeKind,
  suggested: readonly string[],
): string[] {
  if (profile === 'us_equity') {
    const allowed = US_REGIME_STRATEGY_IDS[regime]
    const picked = suggested.filter(id => allowed.includes(id))
    return picked.length ? [...picked] : [...allowed]
  }
  return [...suggested]
}
