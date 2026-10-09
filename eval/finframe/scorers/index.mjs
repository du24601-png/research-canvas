import { scoreNumbersGrounded } from './numbers-grounded.mjs'
import { scoreRefusal } from './refusal.mjs'
import { scoreSourcePeriod } from './source-period.mjs'

/** 插件式评分器：每个接收 { evalCase, calls, texts, datasets }，返回 { scorer, applicable, pass, reasons } */
export const FINFRAME_SCORERS = [scoreNumbersGrounded, scoreSourcePeriod, scoreRefusal]

export function runScorers(input, scorers = FINFRAME_SCORERS) {
  return scorers.map((fn) => fn(input))
}
