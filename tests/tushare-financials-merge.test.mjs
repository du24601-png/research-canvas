/**
 * Tushare 年报：利润表金额 + 指标表比率按报告期合并；核心字段全空则视为失败。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  financialsHaveCoreValues,
  mergeIncomeAndIndicatorRows,
} from '../packages/a-stock-layer/dist/providers/tushare/normalize/index.js'

test('merge prefers income revenue and parent net profit over deducted profit', () => {
  const merged = mergeIncomeAndIndicatorRows(
    '601058',
    [{
      ts_code: '601058.SH',
      end_date: '20241231',
      total_revenue: 31802388102.78,
      n_income: 4123000000,
      n_income_attr_p: 4062674002.7,
    }],
    [{
      ts_code: '601058.SH',
      end_date: '20241231',
      profit_dedt: 3992000000,
      roe: 16.5,
      grossprofit_margin: 20.1,
      tr_yoy: 8.2,
    }],
    'annual',
  )
  assert.equal(merged.length, 1)
  assert.equal(merged[0].reportDate, '2024-12-31')
  assert.equal(merged[0].revenue, 31802388102.78)
  assert.equal(merged[0].netProfit, 4062674002.7)
  assert.equal(merged[0].roe, 16.5)
  assert.equal(merged[0].grossMargin, 20.1)
  assert.equal(merged[0].revenueYoy, 8.2)
  assert.equal(financialsHaveCoreValues(merged), true)
})

test('rows with only dates and no core values fail closed', () => {
  const merged = mergeIncomeAndIndicatorRows(
    '601058',
    [{ ts_code: '601058.SH', end_date: '20241231' }],
    [{ ts_code: '601058.SH', end_date: '20241231' }],
  )
  assert.equal(merged.length, 1)
  assert.equal(merged[0].revenue, null)
  assert.equal(merged[0].netProfit, null)
  assert.equal(merged[0].roe, null)
  assert.equal(merged[0].grossMargin, null)
  assert.equal(financialsHaveCoreValues(merged), false)
  assert.equal(financialsHaveCoreValues([]), false)
})
