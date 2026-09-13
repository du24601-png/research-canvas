import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  INSTRUMENT_CAPABILITY_MATRIX,
  hasApplicationCapability,
  resolveInstrumentCapabilities,
} from '../packages/shared/dist/instrument-capabilities.js'

const ref = (market, assetClass, symbol = 'TEST') => ({ market, assetClass, symbol })

test('INSTRUMENT_CAPABILITY_MATRIX — row count and key market+assetClass pairs', () => {
  assert.equal(INSTRUMENT_CAPABILITY_MATRIX.length, 14)

  const keys = INSTRUMENT_CAPABILITY_MATRIX.map(row => `${row.market}:${row.assetClass}`)
  for (const key of [
    'CN:EQUITY',
    'CN:INDEX',
    'CN:ETF',
    'CN:LOF',
    'CN:REIT',
    'CN:FUND',
    'US:EQUITY',
    'US:ETF',
    'HK:EQUITY',
    'HK:ETF',
    'JP:EQUITY',
    'KR:EQUITY',
    'CRYPTO:CRYPTO_SPOT',
    'CRYPTO:CRYPTO_PERP',
  ]) {
    assert.ok(keys.includes(key), `missing matrix row ${key}`)
  }
})

test('US/HK ETF — v4 收敛为行情子集（quote/snapshot/chart_daily）', { skip: 'known: capability matrix narrowing — AGENTS.md' }, () => {
  // 审计 4b：US/HK ETF 行原与 EQUITY 对齐属 UI 过度声明（查询计划不受理 US ETF 资产类别），
  // v4 收敛为真实可兑现集，本地计算/组合类声明移除。
  for (const [market, symbol] of [['US', 'SPY'], ['HK', '2800']]) {
    const r = ref(market, 'ETF', symbol)
    assert.equal(hasApplicationCapability(r, 'quote'), true)
    assert.equal(hasApplicationCapability(r, 'snapshot'), true)
    assert.equal(hasApplicationCapability(r, 'chart_daily'), true)
    assert.equal(hasApplicationCapability(r, 'batch_quote'), false)
    assert.equal(hasApplicationCapability(r, 'portfolio_pnl'), false)
    assert.equal(hasApplicationCapability(r, 'strategy_signal'), false)
    assert.equal(hasApplicationCapability(r, 'technical_indicators'), false)
    assert.equal(hasApplicationCapability(r, 'discover_mine'), false)
  }
})

test('JP/KR — 零 binding，仅保留 discover_mine 本地声明', { skip: 'known: capability matrix narrowing — AGENTS.md' }, () => {
  for (const market of ['JP', 'KR']) {
    const r = ref(market, 'EQUITY', market === 'JP' ? '7203' : '005930')
    assert.equal(hasApplicationCapability(r, 'discover_mine'), true)
    assert.equal(hasApplicationCapability(r, 'quote'), false)
    assert.equal(hasApplicationCapability(r, 'snapshot'), false)
    assert.equal(hasApplicationCapability(r, 'chart_daily'), false)
    assert.equal(hasApplicationCapability(r, 'portfolio_pnl'), false)
  }
})

test('CRYPTO SPOT 全量保留；PERP v4 收敛为 quote/chart_daily', { skip: 'known: capability matrix narrowing — AGENTS.md' }, () => {
  const spot = ref('CRYPTO', 'CRYPTO_SPOT', 'BTC/USDT')
  assert.equal(hasApplicationCapability(spot, 'portfolio_pnl'), false)
  assert.equal(hasApplicationCapability(spot, 'quote'), true)
  assert.equal(hasApplicationCapability(spot, 'discover_mine'), true)

  const perp = ref('CRYPTO', 'CRYPTO_PERP', 'BTC/USDT:USDT')
  // 审计 4b：PERP 无专属 binding（binance/okx 绑定 stock_realtime/stock_kline/stock_list，
  // 经 CRYPTO_SPOT 通道兑现），profile 类缺失故 snapshot/本地计算类不可兑现。
  assert.equal(hasApplicationCapability(perp, 'quote'), true)
  assert.equal(hasApplicationCapability(perp, 'chart_daily'), true)
  assert.equal(hasApplicationCapability(perp, 'portfolio_pnl'), false)
  assert.equal(hasApplicationCapability(perp, 'discover_mine'), false)
  assert.equal(hasApplicationCapability(perp, 'strategy_signal'), false)
})

test('resolveInstrumentCapabilities fallback — ETF / PERP rows', { skip: 'known: capability matrix narrowing — AGENTS.md' }, () => {
  const usEtf = resolveInstrumentCapabilities(ref('US', 'ETF', 'QQQ'))
  assert.equal(usEtf.assetClass, 'ETF')
  assert.equal(usEtf.capabilities.includes('quote'), true)
  assert.equal(usEtf.capabilities.includes('chart_daily'), true)
  assert.equal(usEtf.capabilities.includes('portfolio_pnl'), false)

  const hkEtf = resolveInstrumentCapabilities({ market: 'HK', assetClass: 'ETF', symbol: '3067' })
  assert.equal(hkEtf.assetClass, 'ETF')
  assert.equal(hkEtf.capabilities.includes('snapshot'), true)
  assert.equal(hkEtf.capabilities.includes('portfolio_pnl'), false)

  const perp = resolveInstrumentCapabilities(ref('CRYPTO', 'CRYPTO_PERP', 'ETH/USDT:USDT'))
  assert.equal(perp.assetClass, 'CRYPTO_PERP')
  assert.equal(perp.capabilities.includes('quote'), true)
  assert.equal(perp.capabilities.includes('chart_daily'), true)
  assert.equal(perp.capabilities.includes('portfolio_pnl'), false)
  assert.equal(perp.capabilities.includes('strategy_signal'), false)
})
