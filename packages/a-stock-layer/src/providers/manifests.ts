import type { MarketGroup, ProviderManifest } from '@opptrix/shared'
import { getManifestRegistry } from './manifest-registry.js'

export { TUSHARE_SETTINGS } from './tushare/settings.js'
export { TICKFLOW_SETTINGS } from './tickflow/settings.js'
export { BINANCE_SETTINGS } from './binance/settings.js'
export { OKX_SETTINGS } from './okx/settings.js'
export { TONGHUASHUN_SETTINGS } from './tonghuashun/settings.js'
export { STOCKINDEX_SETTINGS } from './stockindex/settings.js'
export { AKSHARE_SETTINGS } from './akshare/settings.js'

/**
 * Static built-in manifests（名单外 provider 已于数据层 v3 移除，不再进目录）。
 * v3.5 起从 builtin-manifests.ts 单一来源派生，不再维护第二份名单。
 * 注意：不经 register.ts 派生，避免 driver → permission-denial → manifests 模块环。
 */
export { BUILTIN_MANIFESTS as BUILTIN_PROVIDER_MANIFESTS } from './builtin-manifests.js'

/** Live manifest list (built-in + installed). Prefer listProviderManifests(). */
export const PROVIDER_MANIFESTS: ProviderManifest[] = new Proxy([] as ProviderManifest[], {
  get(_target, prop, receiver) {
    const list = getManifestRegistry().list()
    const value = Reflect.get(list, prop, list)
    if (typeof value === 'function') return value.bind(list)
    return value
  },
  ownKeys() {
    return Reflect.ownKeys(getManifestRegistry().list())
  },
  getOwnPropertyDescriptor(_target, prop) {
    const list = getManifestRegistry().list()
    return Object.getOwnPropertyDescriptor(list, prop) ?? {
      enumerable: true,
      configurable: true,
    }
  },
})

export function getProviderManifest(providerId: string): ProviderManifest | undefined {
  return getManifestRegistry().get(providerId)
}

export function listProviderManifests(): ProviderManifest[] {
  return getManifestRegistry().list()
}

export const MARKET_GROUP_LABELS: Record<MarketGroup, string> = {
  CN: 'A 股',
  US: '美股',
  HK: '港股',
  JP: '日本股市',
  KR: '韩国股市',
  CRYPTO: '加密货币',
  GLOBAL: '全球 / 宏观',
}

export const MARKET_GROUP_ORDER: MarketGroup[] = ['CN', 'US', 'HK', 'JP', 'KR', 'CRYPTO', 'GLOBAL']
