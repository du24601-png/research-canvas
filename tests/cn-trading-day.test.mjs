// CN 交易日日期统一口径（utils/cn-trading-day）单元断言
// 关键场景：UTC 日界附近（上海 00:00–08:00）不得因服务器时区（Docker=UTC）取错交易日。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  cnCalendarYear,
  cnCompactYmdDaysAgo,
  cnTradingDayCompactYmd,
  cnTradingDayYmd,
  cnYmdDaysAgo,
  cnYmdFromMs,
  cnYmdToMs,
} from '../packages/a-stock-layer/dist/utils/cn-trading-day.js'

test('cnTradingDayYmd: UTC 23:00 → 上海次日', () => {
  // 2024-06-05T23:00:00Z = 上海 2024-06-06 07:00（旧本地时区口径在 UTC 机器会取 06-05）
  assert.equal(cnTradingDayYmd(new Date('2024-06-05T23:00:00Z')), '2024-06-06')
})

test('cnTradingDayYmd: 上海正午 → 同日', () => {
  // 2024-06-05T04:00:00Z = 上海 2024-06-05 12:00
  assert.equal(cnTradingDayYmd(new Date('2024-06-05T04:00:00Z')), '2024-06-05')
})

test('cnTradingDayYmd: 上海 00:00–08:00 窗口归当日（旧 toISOString 口径会错归前一日）', () => {
  // 2024-06-05T16:30:00Z = 上海 2024-06-06 00:30；UTC 日期是 06-05，上海已是 06-06
  assert.equal(cnTradingDayYmd(new Date('2024-06-05T16:30:00Z')), '2024-06-06')
})

test('cnYmdToMs / cnYmdFromMs: +08:00 语义互转', () => {
  assert.equal(cnYmdToMs('2024-06-05'), Date.parse('2024-06-05T00:00:00+08:00'))
  assert.equal(cnYmdToMs('2024-06-05', true), Date.parse('2024-06-05T23:59:59+08:00'))
  // 上海 00:30 → 上海日历日仍为当日，而 UTC 日期是前一日
  assert.equal(cnYmdFromMs(Date.parse('2024-06-06T00:30:00+08:00')), '2024-06-06')
  assert.equal(cnYmdFromMs(Number.NaN), '')
  assert.equal(cnYmdToMs('not-a-date'), NaN)
})

test('cnYmdDaysAgo: 跨月/跨年回推按上海日历日', () => {
  const mar1 = new Date('2024-03-01T02:00:00Z') // 上海 2024-03-01 10:00
  assert.equal(cnYmdDaysAgo(1, mar1), '2024-02-29') // 闰年跨月
  assert.equal(cnYmdDaysAgo(366, new Date('2025-01-01T16:30:00Z')), '2024-01-02') // 上海 2025-01-02 00:30 起算，366 天前（闰年）→ 2024-01-02
})

test('紧凑形与年份：tushare YYYYMMDD 口径', () => {
  assert.equal(cnTradingDayCompactYmd(new Date('2024-06-05T23:00:00Z')), '20240606')
  assert.equal(cnCompactYmdDaysAgo(14, new Date('2024-03-01T02:00:00Z')), '20240216')
  assert.equal(cnCalendarYear(new Date('2027-01-01T00:30:00+08:00')), 2027)
})
