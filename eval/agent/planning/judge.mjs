import { normalizeCalls } from '../component/judge.mjs'
import { checkMaxDecisions, matchChain } from './match-chain.mjs'
import { checkForbidArgs, checkForbidTool, checkForbidToolUntil } from './constraints.mjs'

function checkOneConstraint(constraint, calls, events) {
  if (constraint?.type === 'forbid_tool') return checkForbidTool(constraint, calls)
  if (constraint?.type === 'forbid_args') return checkForbidArgs(constraint, calls, events)
  if (constraint?.type === 'forbid_tool_until') return checkForbidToolUntil(constraint, calls)
  return constraint?.id ? [`未知约束 ${constraint.id}`] : []
}

export function judgePlanningCase(evalCase, trace) {
  const calls = normalizeCalls(trace?.calls)
  const gold = evalCase?.gold ?? {}
  const chain = matchChain(gold.chain, calls)
  const reasons = [
    ...checkMaxDecisions(gold, calls),
    ...(evalCase?.constraints ?? []).flatMap((c) => checkOneConstraint(c, calls, trace?.events)),
    ...chain.reasons,
  ]
  const decisions = calls.length
  const goldSteps = Array.isArray(gold.chain) ? gold.chain.length : 0
  const precision = decisions === 0 ? (goldSteps === 0 ? 1 : 0) : chain.matched / decisions
  return {
    caseId: typeof evalCase?.id === 'string' ? evalCase.id : '',
    pass: reasons.length === 0,
    reasons,
    stats: {
      decisions,
      gold_steps: goldSteps,
      matched_steps: chain.matched,
      step_precision: precision,
    },
  }
}
