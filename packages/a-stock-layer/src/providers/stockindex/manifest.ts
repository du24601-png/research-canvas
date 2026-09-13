import { Capability } from '../../core/capabilities.js'
import type { ProviderBinding } from '@opptrix/shared'
import { type ProviderManifestSpec } from '../common/types.js'
import { providerManifestEntry } from '../common/manifest.js'
import { STOCKINDEX_SETTINGS, STOCKINDEX_DISPLAY_TITLE, STOCKINDEX_DISPLAY_SUBTITLE } from './settings.js'
import { STOCKINDEX_HANDLER_CAPS } from './handler.js'

/**
 * Opptrix量化 bindings：
 * - 标的搜索（INSTRUMENT_SEARCH）— CN/US/HK EQUITY 专用搜索计划通道
 * - 汇率（EXCHANGE_RATE）— 人民币中间价，走 registry 管道
 *   （GLOBAL 不在 Market 枚举内，作用域固定 CN/EQUITY，与 engine.exchangeRate 默认路由一致）
 */
function searchOnlyBindings(
  priority: number,
  maxConcurrent?: number,
): ProviderBinding[] {
  const markets = ['CN', 'US', 'HK'] as const
  const rows: ProviderBinding[] = []
  for (const market of markets) {
    rows.push({
      market,
      assetClass: 'EQUITY',
      capability: Capability.INSTRUMENT_SEARCH,
      defaultPriority: priority,
      ...(maxConcurrent !== undefined ? { maxConcurrent } : {}),
    })
  }
  rows.push({
    market: 'CN',
    assetClass: 'EQUITY',
    capability: Capability.EXCHANGE_RATE,
    defaultPriority: priority,
    ...(maxConcurrent !== undefined ? { maxConcurrent } : {}),
  })
  return rows
}

export const STOCKINDEX_CAPS = STOCKINDEX_HANDLER_CAPS

export const STOCKINDEX_SPEC: ProviderManifestSpec = {
  id: 'stockindex',
  title: STOCKINDEX_DISPLAY_TITLE,
  subtitle: STOCKINDEX_DISPLAY_SUBTITLE,
  marketGroup: 'GLOBAL',
  defaultPriority: 115,
  maxConcurrent: 4,
  capabilities: STOCKINDEX_CAPS,
  bindingsFor: (p, maxConcurrent) => searchOnlyBindings(p, maxConcurrent),
  settings: STOCKINDEX_SETTINGS,
}

export const STOCKINDEX_MANIFEST = providerManifestEntry(
  'stockindex',
  STOCKINDEX_DISPLAY_TITLE,
  STOCKINDEX_DISPLAY_SUBTITLE,
  'GLOBAL',
  115,
  STOCKINDEX_SETTINGS,
)
