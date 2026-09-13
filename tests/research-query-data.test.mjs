/**
 * Phase 4A query_data — metric/entity resolve, fail-closed schema, null !== 0.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveResearchMetric } from '../packages/shared/dist/research-metrics.js'
import { klineBarBudget, sanitizeResearchDataset } from '../packages/shared/dist/research-dataset.js'
import {
  pickCnEquityHit,
  parseCnEquityKeyword,
} from '../packages/agent/dist/research-entity-resolver.js'
import {
  buildResearchCanvasTools,
  extractResearchCanvasEvent,
  stripResearchCanvasEventField,
} from '../packages/agent/dist/research-canvas-tools.js'
import { runInToolSession } from '../packages/agent/dist/mcp/tool-session-context.js'
import {
  beginResearchCanvasTurn,
  endResearchCanvasTurn,
  getTurnCanvasDatasets,
  getTurnCanvasRecords,
} from '../packages/agent/dist/research-canvas-turn-state.js'

const SESSION = 'rc-query-test'

function confirmedQuery(input) {
  return { ...input, confirmed: true }
}

const NAMES = {
  赛轮轮胎: { symbol: '601058', exchange: 'SH' },
  玲珑轮胎: { symbol: '601966', exchange: 'SH' },
  森麒麟: { symbol: '002283', exchange: 'SZ' },
  青岛双星: { symbol: '000599', exchange: 'SZ' },
}

function financialRow(year, grossMargin) {
  return {
    code: '601058',
    reportDate: `${year}-12-31`,
    reportType: 'annual',
    revenue: 1,
    revenueYoy: 10,
    netProfit: 1,
    netProfitYoy: 8,
    eps: 1,
    roe: 12,
    grossMargin,
    netMargin: 6,
    debtRatio: 50,
    operatingCashFlow: 1,
  }
}

function makeHub({ source = 'tushare', value = 18.2, fail = false } = {}) {
  let queryCount = 0
  return {
    queryCount: () => queryCount,
    hub: {
      async dispatch(feature, params) {
        if (feature !== 'instrument_search') {
          return { success: false, message: 'unsupported', data: {} }
        }
        const keyword = String(params.keyword ?? '')
        const mapped = NAMES[keyword]
        const item = mapped
          ? {
            name: keyword,
            market: 'CN',
            assetClass: 'EQUITY',
            instrument: {
              market: 'CN',
              assetClass: 'EQUITY',
              symbol: mapped.symbol,
              exchange: mapped.exchange,
            },
          }
          : null
        return {
          success: Boolean(item),
          message: item ? 'ok' : 'empty',
          data: { items: item ? [item] : [] },
        }
      },
      de: {
        async queryInstrumentData() {
          queryCount += 1
          if (fail) return { success: false, error: 'upstream' }
          return {
            success: true,
            source,
            data: ['2021', '2022', '2023', '2024', '2025'].map(year => financialRow(year, value)),
          }
        },
      },
    },
  }
}

async function withTurn(hub, fn) {
  const tools = Object.fromEntries(buildResearchCanvasTools(hub).map(tool => [tool.name, tool]))
  beginResearchCanvasTurn(SESSION, { widgets: [], datasets: [] })
  try {
    return await runInToolSession(SESSION, () => fn(tools))
  } finally {
    endResearchCanvasTurn(SESSION)
  }
}

test('metric resolver maps aliases to canonical ids', () => {
  assert.equal(resolveResearchMetric('毛利率')?.id, 'gross_margin')
  assert.equal(resolveResearchMetric('销售毛利率')?.id, 'gross_margin')
  assert.equal(resolveResearchMetric('roe')?.id, 'roe')
  assert.equal(resolveResearchMetric('净资产收益率')?.id, 'roe')
  assert.equal(resolveResearchMetric('产能'), null)
  assert.equal(resolveResearchMetric('K线')?.id, 'kline')
  assert.equal(resolveResearchMetric('蜡烛图')?.id, 'kline')
})

test('entity resolver accepts CN ticker and unique company names', () => {
  const parsed = parseCnEquityKeyword('601058.SH')
  assert.equal(parsed?.symbol, '601058')
  const picked = pickCnEquityHit('赛轮', [
    {
      name: '赛轮轮胎',
      instrument: { market: 'CN', assetClass: 'EQUITY', symbol: '601058', exchange: 'SH' },
    },
    {
      name: '贵州茅台',
      instrument: { market: 'CN', assetClass: 'EQUITY', symbol: '600519', exchange: 'SH' },
    },
  ])
  assert.equal(picked.entity?.ticker, '601058.SH')
  const byCommonName = pickCnEquityHit('赛轮轮胎', [
    {
      name: '赛轮',
      instrument: { market: 'CN', assetClass: 'EQUITY', symbol: '601058', exchange: 'SH' },
    },
    {
      name: '贵州茅台',
      instrument: { market: 'CN', assetClass: 'EQUITY', symbol: '600519', exchange: 'SH' },
    },
  ])
  assert.equal(byCommonName.entity?.ticker, '601058.SH')
  const ambiguous = pickCnEquityHit('轮胎', [
    {
      name: '赛轮轮胎',
      instrument: { market: 'CN', assetClass: 'EQUITY', symbol: '601058', exchange: 'SH' },
    },
    {
      name: '玲珑轮胎',
      instrument: { market: 'CN', assetClass: 'EQUITY', symbol: '601966', exchange: 'SH' },
    },
  ])
  assert.match(String(ambiguous.error), /多家公司/)
})

test('query_data schema fail-closed', async () => {
  const { hub } = makeHub()
  await withTurn(hub, async (tools) => {
    const extra = await tools.query_data.handler({
      entities: ['赛轮轮胎'],
      metric: 'gross_margin',
      start: '2021',
      end: '2025',
      foo: 1,
    })
    assert.match(String(extra.error), /不支持参数/)

    const badMetric = await tools.query_data.handler({
      entities: ['赛轮轮胎'],
      metric: 'capacity',
      start: '2021',
      end: '2025',
    })
    assert.equal(badMetric.error, '不支持该指标')
    assert.equal(extractResearchCanvasEvent(badMetric), null)
  })
})

test('provider miss does not fabricate numbers and all-null fails closed', async () => {
  const failed = makeHub({ fail: true })
  await withTurn(failed.hub, async (tools) => {
    const result = await tools.query_data.handler(confirmedQuery({
      entities: ['赛轮轮胎'],
      metric: 'gross_margin',
      start: '2021',
      end: '2025',
    }))
    assert.match(String(result.error), /未能提供该指标/)
    assert.equal(extractResearchCanvasEvent(result), null)
  })

  const empty = makeHub({ value: null })
  await withTurn(empty.hub, async (tools) => {
    const result = await tools.query_data.handler(confirmedQuery({
      entities: ['赛轮轮胎'],
      metric: 'gross_margin',
      start: '2021',
      end: '2025',
    }))
    assert.match(String(result.error), /未能提供该指标/)
  })
})

test('query_data builds dataset, emits dataset_created, and strips data from the model payload', async () => {
  const { hub } = makeHub({ source: 'tushare', value: 18.2 })
  await withTurn(hub, async (tools) => {
    const result = await tools.query_data.handler(confirmedQuery({
      entities: ['赛轮轮胎', '玲珑轮胎', '森麒麟'],
      metric: 'gross_margin',
      start: '2021',
      end: '2025',
    }))
    assert.equal(result.ok, true)
    assert.match(result.datasetId, /^research-ds-/)
    assert.notEqual(result.datasetId, 'ds-tire-gross-margin-2021-2025')
    assert.equal(result.entities, 3)
    assert.equal(result.periods, 5)
    assert.equal('data' in result, false)

    const event = extractResearchCanvasEvent(result)
    assert.equal(event?.type, 'dataset_created')
    assert.equal(event.dataset.sources[0].provider, 'tushare')
    assert.equal(event.dataset.data.some(point => point.value === 0), false)
    for (const source of event.dataset.sources) {
      assert.notEqual(source.provider, 'mixed')
      assert.ok(source.period, 'each source must bind a report period')
      assert.ok(source.fieldLabel, 'each source must include a field label')
    }
    assert.equal(
      event.dataset.sources.filter(source => source.entityId && source.period).length,
      event.dataset.sources.length,
    )
    const sanitized = sanitizeResearchDataset(event.dataset)
    assert.ok(sanitized)
    assert.equal(getTurnCanvasDatasets(SESSION)?.length, 1)
    assert.equal(getTurnCanvasRecords(SESSION)?.length, 1)
    assert.equal(event.dataset.query?.metric, 'gross_margin')
    assert.ok(event.dataset.createdAt)

    const stripped = stripResearchCanvasEventField(result)
    assert.equal('canvas_event' in stripped, false)
    assert.equal(stripped.datasetId, result.datasetId)
  })
})

test('query_data auto tier fetches immediately without confirmed', async () => {
  const boxed = makeHub()
  await withTurn(boxed.hub, async (tools) => {
    const result = await tools.query_data.handler({
      entities: ['赛轮轮胎'],
      metric: 'gross_margin',
      start: '2021',
      end: '2025',
    })
    assert.equal(result.ok, true)
    assert.match(result.datasetId, /^research-ds-/)
    assert.equal(result.status, undefined)
    assert.equal(result.tier, 'auto')
    assert.match(result.statement, /赛轮轮胎/)
    assert.equal(boxed.queryCount(), 1)
    assert.equal(extractResearchCanvasEvent(result)?.type, 'dataset_created')
  })
})

test('query_data with more than three entities requires confirm before provider fetch', async () => {
  const boxed = makeHub()
  await withTurn(boxed.hub, async (tools) => {
    const preview = await tools.query_data.handler({
      entities: ['赛轮轮胎', '玲珑轮胎', '森麒麟', '青岛双星'],
      metric: 'gross_margin',
      start: '2021',
      end: '2025',
    })
    assert.equal(preview.status, 'plan_preview')
    assert.equal(preview.tier, 'must_confirm')
    assert.equal(preview.requires_user_confirm, true)
    assert.equal(boxed.queryCount(), 0)
  })
})

test('query_data keeps independent per-period sources for each company', async () => {
  const { hub } = makeHub({ source: 'tushare', value: 21.5 })
  await withTurn(hub, async (tools) => {
    const result = await tools.query_data.handler(confirmedQuery({
      entities: ['赛轮轮胎', '玲珑轮胎'],
      metric: 'roe',
      start: '2022',
      end: '2023',
    }))
    assert.equal(result.ok, true)
    const event = extractResearchCanvasEvent(result)
    assert.equal(event?.type, 'dataset_created')
    const keys = new Set(event.dataset.sources.map(source => `${source.entityId}:${source.period}`))
    assert.equal(keys.size, event.dataset.sources.length)
    assert.ok(event.dataset.sources.every(source => source.provider === 'tushare'))
    assert.ok(event.dataset.sources.every(source => source.period === '2022' || source.period === '2023'))
  })
})

test('annual window ignores quarterly rows even if reportType is stamped annual', async () => {
  const boxed = makeHub({ source: 'tushare', value: 18.2 })
  boxed.hub.de.queryInstrumentData = async () => {
    return {
      success: true,
      source: 'tushare',
      data: [
        { ...financialRow('2025', 24.6824), reportDate: '2025-12-31' },
        { ...financialRow('2025', 99), reportDate: '2025-09-30', reportType: 'annual' },
        { ...financialRow('2024', 27.583), reportDate: '2024-12-31' },
        { ...financialRow('2023', 27.6359), reportDate: '2023-12-31' },
        { ...financialRow('2022', 18.4157), reportDate: '2022-12-31' },
        { ...financialRow('2021', 18.8691), reportDate: '2021-12-31' },
        { ...financialRow('2021', 21.7784), reportDate: '2021-03-31', reportType: 'annual' },
      ],
    }
  }
  await withTurn(boxed.hub, async (tools) => {
    const result = await tools.query_data.handler(confirmedQuery({
      entities: ['赛轮轮胎'],
      metric: 'gross_margin',
      start: '2021',
      end: '2025',
    }))
    const event = extractResearchCanvasEvent(result)
    const values = Object.fromEntries(
      (event?.dataset?.data ?? []).map(point => [point.period, point.value]),
    )
    assert.equal(values['2025'], 24.6824)
    assert.equal(values['2021'], 18.8691)
    assert.equal(Object.values(values).includes(99), false)
    assert.equal(Object.values(values).includes(21.7784), false)
  })
})

test('existing dataset can create a bar view without querying again', async () => {
  const boxed = makeHub({ source: 'tickflow', value: 21 })
  await withTurn(boxed.hub, async (tools) => {
    const queried = await tools.query_data.handler(confirmedQuery({
      entities: ['赛轮轮胎'],
      metric: 'gross_margin',
      start: '2021',
      end: '2025',
    }))
    const queriesAfterData = boxed.queryCount()
    const created = await tools.create_widget.handler({
      type: 'bar_chart',
      title: '2025年毛利率排名',
      datasetId: queried.datasetId,
    })
    assert.equal(created.ok, true)
    assert.equal(created.widget.datasetId, queried.datasetId)
    assert.equal(boxed.queryCount(), queriesAfterData)

    const unknown = await tools.create_widget.handler({
      type: 'line_chart',
      title: '未知集',
      datasetId: 'research-ds-cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    })
    assert.equal(unknown.error, 'datasetId 不受支持')
  })
})

function klineRow(date, close) {
  return {
    date,
    open: close - 1,
    high: close + 1,
    low: close - 2,
    close,
    volume: 1000,
  }
}

function makeKlineHub() {
  let queryCount = 0
  let lastOpts = null
  return {
    queryCount: () => queryCount,
    lastOpts: () => lastOpts,
    hub: {
      async dispatch(feature, params) {
        if (feature !== 'instrument_search') {
          return { success: false, message: 'unsupported', data: {} }
        }
        const keyword = String(params.keyword ?? '')
        const mapped = NAMES[keyword]
        const item = mapped
          ? {
            name: keyword,
            market: 'CN',
            assetClass: 'EQUITY',
            instrument: {
              market: 'CN',
              assetClass: 'EQUITY',
              symbol: mapped.symbol,
              exchange: mapped.exchange,
            },
          }
          : null
        return {
          success: Boolean(item),
          message: item ? 'ok' : 'empty',
          data: { items: item ? [item] : [] },
        }
      },
      de: {
        async queryInstrumentData(_ref, capability, opts = {}) {
          queryCount += 1
          lastOpts = opts
          if (capability !== 'kline') return { success: false, error: 'expected kline' }
          return {
            success: true,
            source: 'tonghuashun',
            data: [
              klineRow('2024-01-02', 10),
              klineRow('20240103', 11),
            ],
          }
        },
      },
    },
  }
}

test('query_data kline builds ohlc candlestick dataset', async () => {
  const boxed = makeKlineHub()
  await withTurn(boxed.hub, async (tools) => {
    const tooMany = await tools.query_data.handler({
      entities: ['赛轮轮胎', '玲珑轮胎', '森麒麟'],
      metric: 'kline',
      start: '2024',
      end: '2024',
    })
    assert.match(String(tooMany.error), /最多比较两只/)

    const result = await tools.query_data.handler(confirmedQuery({
      entities: ['赛轮轮胎'],
      metric: 'kline',
      start: '2024',
      end: '2024',
    }))
    assert.equal(result.ok, true)
    assert.equal(result.metric, 'kline')
    const event = extractResearchCanvasEvent(result)
    assert.equal(event?.type, 'dataset_created')
    assert.equal(event.dataset.metric, 'kline')
    assert.deepEqual(event.dataset.periods, ['2024-01-02', '2024-01-03'])
    assert.equal(event.dataset.ohlc?.length, 2)
    assert.equal(event.dataset.ohlc[1].time, '2024-01-03')
    assert.equal(event.dataset.ohlc[1].close, 11)
    const sanitized = sanitizeResearchDataset(event.dataset)
    assert.ok(sanitized)
    assert.equal(sanitized.ohlc?.length, 2)

    const proposed = await tools.propose_widget.handler({
      type: 'candlestick',
      title: '赛轮日K',
      datasetId: result.datasetId,
    })
    assert.equal(proposed.ok, true)
    assert.equal(proposed.type, 'candlestick')
  })
})

test('klineBarBudget scales with year span instead of a hardcoded 800', () => {
  assert.equal(klineBarBudget('2024', '2024'), 250)
  assert.equal(klineBarBudget('2021', '2025'), 1250)
  assert.equal(klineBarBudget('2000', '2025'), 2500)
})

test('query_data kline passes year-span bar budget as count', async () => {
  const boxed = makeKlineHub()
  await withTurn(boxed.hub, async (tools) => {
    await tools.query_data.handler(confirmedQuery({
      entities: ['赛轮轮胎'],
      metric: 'kline',
      start: '2021',
      end: '2025',
    }))
    assert.equal(boxed.lastOpts()?.count, 1250)
    assert.equal(boxed.lastOpts()?.startDate, '2021-01-01')
    assert.equal(boxed.lastOpts()?.endDate, '2025-12-31')
  })
})

test('sanitizeResearchDataset accepts multi-year kline periods beyond 800', () => {
  const periods = Array.from({ length: 900 }, (_, index) => `p${String(index).padStart(4, '0')}`)
  const dataset = {
    id: 'research-ds-11111111-1111-4111-8111-111111111111',
    title: '日K',
    metric: 'kline',
    unit: '元',
    entities: [{ id: 'e1', name: '赛轮', ticker: '601058.SH', market: 'CN', type: 'equity' }],
    periods,
    data: periods.map(period => ({ entityId: 'e1', period, value: 1 })),
    sources: [{ provider: 'tushare', entityId: 'e1', metric: 'kline', fetchedAt: '2026-01-01T00:00:00.000Z' }],
    ohlc: periods.map(period => ({
      entityId: 'e1', time: period, open: 1, high: 2, low: 0.5, close: 1.5,
    })),
  }
  const sanitized = sanitizeResearchDataset(dataset)
  assert.ok(sanitized)
  assert.equal(sanitized.periods.length, 900)
  assert.equal(sanitized.ohlc?.length, 900)
})
