import type { InstrumentRef } from './market-data.js'

export type InstrumentAnalyticsMode = 'unsupported'

export type InstrumentAnalyticsCapability =
  | 'evaluation'
  | 'strategy_signal'
  | 'technical_indicators'
  | 'strategy_verify'

export interface InstrumentAnalyticsProfile {
  mode: InstrumentAnalyticsMode
  label: string
  supports: Record<InstrumentAnalyticsCapability, boolean>
  limitation?: string
}

const ALL_UNSUPPORTED: Record<InstrumentAnalyticsCapability, boolean> = {
  evaluation: false,
  strategy_signal: false,
  technical_indicators: false,
  strategy_verify: false,
}

export function resolveInstrumentAnalyticsProfile(ref: InstrumentRef): InstrumentAnalyticsProfile {
  void ref
  return {
    mode: 'unsupported',
    label: '分析能力已下线',
    supports: ALL_UNSUPPORTED,
    limitation: '请使用基本面工具或外部 MCP 问数/行情',
  }
}

export function gateInstrumentAnalytics(
  ref: InstrumentRef,
  capability: InstrumentAnalyticsCapability,
): { status: 'supported' | 'unsupported'; reason?: string } {
  const profile = resolveInstrumentAnalyticsProfile(ref)
  if (profile.supports[capability]) return { status: 'supported' }
  return {
    status: 'unsupported',
    reason: profile.limitation ?? '该标的暂不支持此分析能力',
  }
}
