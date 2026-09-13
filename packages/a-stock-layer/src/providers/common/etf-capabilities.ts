import { Capability } from '../../core/capabilities.js'

/** 免费 tickflow 可提供的 CN ETF 扩展能力 */
export const FREE_CN_ETF_CAPABILITIES = [
  Capability.ETF_LIST,
  Capability.ETF_PROFILE,
  Capability.ETF_NAV,
] as const
