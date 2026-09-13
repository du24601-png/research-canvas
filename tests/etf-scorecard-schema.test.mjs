/**
 * ETF 决策雷达（在线）：Hub etf_scorecard 须 await，异常应落成 ResearchResult 而非未处理 rejection。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ResearchHub } from '../packages/research-hub/dist/hub.js'

describe('etf scorecard hub await', () => {
  it('hub.dispatch etf_scorecard settles without unhandled rejection', async () => {
    const hub = new ResearchHub()
    const result = await hub.dispatch('etf_scorecard', { code: '510300' })
    assert.equal(typeof result.success, 'boolean')
    assert.equal(typeof result.message, 'string')
    assert.ok(!String(result.message).includes('no such column: amount'))
    if (result.success) {
      const data = /** @type {{ code?: string, source?: string }} */ (result.data)
      // Hub 在线路径经 instrumentHubCode 返回 Opptrix ETF ID
      assert.equal(data?.code, 'CN:ETF:510300.SH')
      assert.equal(data?.source, 'online')
    } else {
      assert.ok(result.message.length > 0)
      assert.ok(!String(result.message).includes('no such column'))
    }
  })
})
