import { Capability } from '../../core/capabilities.js'
import { type ProviderManifestSpec } from '../common/types.js'
import { providerManifestEntry } from '../common/manifest.js'
import { cnEquityBindings } from '../common/bindings.js'
import {
  AKSHARE_DISPLAY_SUBTITLE,
  AKSHARE_DISPLAY_TITLE,
  AKSHARE_SETTINGS,
} from './settings.js'

export const AKSHARE_CAPS = [
  Capability.FINANCIAL_SUMMARY,
  Capability.STOCK_KLINE,
]

export const AKSHARE_SPEC: ProviderManifestSpec = {
  id: 'akshare',
  title: AKSHARE_DISPLAY_TITLE,
  subtitle: AKSHARE_DISPLAY_SUBTITLE,
  marketGroup: 'CN',
  defaultPriority: 85,
  maxConcurrent: 2,
  capabilities: AKSHARE_CAPS,
  bindingsFor: (p, maxConcurrent) => cnEquityBindings(AKSHARE_CAPS, p, maxConcurrent),
  settings: AKSHARE_SETTINGS,
  supportsTest: true,
}

export const AKSHARE_MANIFEST = providerManifestEntry(
  'akshare',
  AKSHARE_DISPLAY_TITLE,
  AKSHARE_DISPLAY_SUBTITLE,
  'CN',
  85,
  AKSHARE_SETTINGS,
)
