/**
 * Tushare 未开 gzip 时禁止并发；HTTP 锁须保证同一时刻只有一条请求。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resetTushareHttpLockForTests,
  withTushareHttpLock,
} from '../packages/a-stock-layer/dist/providers/tushare/api/client.js'

test('tushare http lock serializes overlapping work', async () => {
  resetTushareHttpLockForTests()
  let inflight = 0
  let peak = 0
  const jobs = Array.from({ length: 4 }, () => withTushareHttpLock(async () => {
    inflight += 1
    peak = Math.max(peak, inflight)
    await new Promise(resolve => setTimeout(resolve, 20))
    inflight -= 1
  }))
  await Promise.all(jobs)
  assert.equal(peak, 1)
  assert.equal(inflight, 0)
})
