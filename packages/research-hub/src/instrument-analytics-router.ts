import type { ResearchResult } from '@opptrix/shared'
import { fail, instrumentRefFromParams } from '@opptrix/shared'

const REMOVED_MESSAGE = '该分析能力已下线，请使用研究画布与标准行情/基本面能力继续投研'

export type InstrumentAnalyticsRouteHandlers = {
  cnFactorEvaluation: (ref: import('@opptrix/shared').InstrumentRef) => Promise<ResearchResult>
  cnEtfEvaluation: (ref: import('@opptrix/shared').InstrumentRef) => Promise<ResearchResult>
  technicalEvaluation: (ref: import('@opptrix/shared').InstrumentRef) => Promise<ResearchResult>
  strategyAssess: (ref: import('@opptrix/shared').InstrumentRef) => Promise<ResearchResult>
  buildIndicators: (ref: import('@opptrix/shared').InstrumentRef) => Promise<ResearchResult>
  strategyVerify: (
    ref: import('@opptrix/shared').InstrumentRef,
    checkpoints: number,
    forwardDays: number,
  ) => Promise<ResearchResult>
}

export async function routeInstrumentEvaluation(
  params: Record<string, unknown>,
  _handlers: InstrumentAnalyticsRouteHandlers,
): Promise<ResearchResult> {
  void _handlers
  if (!instrumentRefFromParams(params)) return fail('instrument 或 market+symbol 必填')
  return fail(REMOVED_MESSAGE)
}

export async function routeInstrumentStrategySignal(
  params: Record<string, unknown>,
  _handlers: InstrumentAnalyticsRouteHandlers,
): Promise<ResearchResult> {
  void _handlers
  if (!instrumentRefFromParams(params)) return fail('instrument 或 market+symbol 必填')
  return fail(REMOVED_MESSAGE)
}

export async function routeInstrumentIndicators(
  params: Record<string, unknown>,
  _handlers: InstrumentAnalyticsRouteHandlers,
): Promise<ResearchResult> {
  void _handlers
  if (!instrumentRefFromParams(params)) return fail('instrument 或 market+symbol 必填')
  return fail(REMOVED_MESSAGE)
}

export async function routeInstrumentStrategyVerify(
  params: Record<string, unknown>,
  _handlers: InstrumentAnalyticsRouteHandlers,
): Promise<ResearchResult> {
  void _handlers
  if (!instrumentRefFromParams(params)) return fail('instrument 或 market+symbol 必填')
  return fail(REMOVED_MESSAGE)
}
