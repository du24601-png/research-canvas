import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { registerAllDrivers } from '../packages/a-stock-layer/dist/providers/register.js'
import { MarketDataEngine } from '../packages/a-stock-layer/dist/engine.js'
import { toAkshareEmSymbol, toSixDigitCode } from '../packages/a-stock-layer/dist/providers/akshare/codes.js'
import { mapAkshareFinancialRows } from '../packages/a-stock-layer/dist/providers/akshare/normalize/financials.js'
import { testAkshareConnection } from '../packages/a-stock-layer/dist/providers/akshare/api/client.js'

describe('akshare provider', () => {
  it('registers driver with financials and kline bindings', () => {
    const engine = new MarketDataEngine(false)
    registerAllDrivers(engine.registry)
    const driver = engine.registry.get('akshare')
    assert.ok(driver)
    const caps = driver.capabilities()
    assert.ok(caps.includes('financial_summary'))
    assert.ok(caps.includes('stock_kline'))
  })

  it('maps A-share codes for East Money symbol', () => {
    assert.equal(toAkshareEmSymbol('600519'), '600519.SH')
    assert.equal(toAkshareEmSymbol('000001.SZ'), '000001.SZ')
    assert.equal(toSixDigitCode('600519.SH'), '600519')
  })

  it('normalizes akshare financial rows', () => {
    const rows = mapAkshareFinancialRows('600519', [{
      REPORT_DATE: '2024-12-31 00:00:00',
      TOTALOPERATEREVE: 100,
      PARENTNETPROFIT: 50,
      ROEJQ: 30,
      XSMLL: 91.5,
      EPSJB: 10,
      BPS: 100,
    }])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].reportDate, '2024-12-31')
    assert.equal(rows[0].revenue, 100)
    assert.equal(rows[0].netProfit, 50)
    assert.equal(rows[0].roe, 30)
  })
})

describe('akshare live connection', () => {
  it('pings python sidecar and fetches sample financials', { timeout: 120_000 }, async () => {
    if (process.env.AKSHARE_INTEGRATION !== '1') {
      return
    }
    const result = await testAkshareConnection()
    assert.equal(result.ok, true, result.message)
  })
})
