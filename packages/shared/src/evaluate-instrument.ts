import type { InstrumentRef } from './market-data.js'
import { gateInstrumentAnalytics } from './instrument-analytics.js'

export type InstrumentEvaluationStatus = 'supported' | 'not_supported'

export interface InstrumentEvaluationGate {
  status: InstrumentEvaluationStatus
  reason?: string
}

/** 评估 facade 入口 — 量化评估已下线，统一返回 not_supported */
export function gateInstrumentEvaluation(ref: InstrumentRef): InstrumentEvaluationGate {
  const gate = gateInstrumentAnalytics(ref, 'evaluation')
  return {
    status: gate.status === 'supported' ? 'supported' : 'not_supported',
    reason: gate.reason,
  }
}
