/**
 * Phase 4B refine_dataset — local derive, lineage, immutability, fail-closed.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { cloneResearchDataset } from '../packages/shared/dist/research-dataset-derive.js'
import { sanitizeResearchDataset } from '../packages/shared/dist/research-dataset.js'
import {
  rankScopedDatasetIds,
  selectScopedDatasetIds,
} from '../packages/shared/dist/research-dataset-scope.js'
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
  getTurnCanvasWidgets,
} from '../packages/agent/dist/research-canvas-turn-state.js'
import { formatResearchCanvasTurnContext } from '../packages/agent/dist/research-canvas-context.js'
import { resolveToolRoutePlan } from '../packages/agent/dist/mcp/tool-route-plan.js'

const SESSION = 'rc-refine-test'
const PARENT_FETCHED = '2026-09-10T00:00:00.000Z'

const NAMES = {
  赛轮轮胎: { symbol: '601058', exchange: 'SH' },
  玲珑轮胎: { symbol: '601966', exchange: 'SH' },
  森麒麟: { symbol: '002283', exchange: 'SZ' },
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

function makeHub() {
  let queryCount = 0
  const queriedSymbols = []
  return {
    queryCount: () => queryCount,
    queriedSymbols: () => [...queriedSymbols],
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
        async queryInstrumentData(ref) {
          queryCount += 1
          queriedSymbols.push(ref?.symbol)
          return {
            success: true,
            source: 'tushare',
            data: ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025']
              .map(year => financialRow(year, 18.2)),
          }
        },
      },
    },
  }
}

const ENTITIES = [
  { id: 'CN:SH.601058', name: '赛轮轮胎', ticker: '601058.SH', market: 'CN', type: 'equity' },
  { id: 'CN:SH.601966', name: '玲珑轮胎', ticker: '601966.SH', market: 'CN', type: 'equity' },
  { id: 'CN:SZ.002283', name: '森麒麟', ticker: '002283.SZ', market: 'CN', type: 'equity' },
]

function parentDataset() {
  const periods = ['2021', '2022', '2023', '2024', '2025']
  const data = []
  const sources = []
  for (const entity of ENTITIES) {
    sources.push({
      provider: 'tushare',
      entityId: entity.id,
      metric: 'gross_margin',
      fetchedAt: PARENT_FETCHED,
    })
    for (const period of periods) {
      data.push({
        entityId: entity.id,
        period,
        value: period === '2022' && entity.id === 'CN:SH.601966' ? null : 18.2,
      })
    }
  }
  return {
    id: 'research-ds-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    title: '赛轮轮胎、玲珑轮胎、森麒麟毛利率',
    metric: 'gross_margin',
    unit: '%',
    entities: ENTITIES.map(entity => ({ ...entity })),
    periods,
    data,
    sources,
    query: {
      entities: ENTITIES.map(entity => entity.ticker),
      metric: 'gross_margin',
      start: '2021',
      end: '2025',
    },
    createdAt: PARENT_FETCHED,
  }
}

function unrelatedDataset() {
  return {
    id: 'research-ds-ffffffff-ffff-4fff-8fff-ffffffffffff',
    title: '无关数据集',
    metric: 'roe',
    unit: '%',
    entities: [ENTITIES[0]],
    periods: ['2024'],
    data: [{ entityId: ENTITIES[0].id, period: '2024', value: 10 }],
    sources: [{
      provider: 'tushare',
      entityId: ENTITIES[0].id,
      metric: 'roe',
      fetchedAt: PARENT_FETCHED,
    }],
  }
}

async function withTurn(hub, snapshot, fn, toolCallId) {
  const tools = Object.fromEntries(buildResearchCanvasTools(hub).map(tool => [tool.name, tool]))
  beginResearchCanvasTurn(SESSION, snapshot)
  try {
    return await runInToolSession(SESSION, () => fn(tools), toolCallId)
  } finally {
    endResearchCanvasTurn(SESSION)
  }
}

test('refine_dataset schema fail-closed', async () => {
  const boxed = makeHub()
  const parent = parentDataset()
  await withTurn(boxed.hub, { widgets: [], datasetRecords: [parent] }, async (tools) => {
    const extra = await tools.refine_dataset.handler({
      datasetId: parent.id,
      operation: { type: 'remove_entities', entities: ['玲珑'] },
      foo: 1,
    })
    assert.match(String(extra.error), /不支持参数/)
    assert.equal(extractResearchCanvasEvent(extra), null)

    const badOp = await tools.refine_dataset.handler({
      datasetId: parent.id,
      operation: { type: 'sort', entities: ['玲珑'] },
    })
    assert.match(String(badOp.error), /operation.type/)

    const withData = await tools.refine_dataset.handler({
      datasetId: parent.id,
      operation: { type: 'remove_entities', entities: ['玲珑'], data: [] },
    })
    assert.match(String(withData.error), /不支持参数/)
  })
})

test('unknown dataset and zero-entity result are rejected', async () => {
  const boxed = makeHub()
  const parent = parentDataset()
  await withTurn(boxed.hub, { widgets: [], datasetRecords: [parent] }, async (tools) => {
    const missing = await tools.refine_dataset.handler({
      datasetId: 'research-ds-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      operation: { type: 'remove_entities', entities: ['玲珑'] },
    })
    assert.match(String(missing.error), /不存在/)

    const all = await tools.refine_dataset.handler({
      datasetId: parent.id,
      operation: { type: 'remove_entities', entities: ['赛轮', '玲珑', '森麒麟'] },
    })
    assert.match(String(all.error), /没有可保留的公司/)
    assert.equal(extractResearchCanvasEvent(all), null)
    assert.equal(getTurnCanvasRecords(SESSION)?.length, 1)
  })
})

test('remove entity local derive keeps parent immutable and sources fetchedAt', async () => {
  const boxed = makeHub()
  const parent = parentDataset()
  const frozen = cloneResearchDataset(parent)
  await withTurn(boxed.hub, { widgets: [], datasetRecords: [parent] }, async (tools) => {
    const queriesBefore = boxed.queryCount()
    const result = await tools.refine_dataset.handler({
      datasetId: parent.id,
      operation: { type: 'remove_entities', entities: ['玲珑'] },
    })
    assert.equal(result.ok, true)
    assert.equal(boxed.queryCount(), queriesBefore)
    assert.equal(result.parentDatasetId, parent.id)
    assert.equal(result.transform, 'filter_entities')
    assert.match(result.datasetId, /^research-ds-/)
    assert.notEqual(result.datasetId, parent.id)

    const event = extractResearchCanvasEvent(result)
    assert.equal(event?.type, 'dataset_created')
    const derived = sanitizeResearchDataset(event.dataset)
    assert.ok(derived)
    assert.equal(derived.parentDatasetId, parent.id)
    assert.equal(derived.transform?.type, 'filter_entities')
    assert.deepEqual(derived.entities.map(item => item.name), ['赛轮轮胎', '森麒麟'])
    assert.equal(derived.data.some(point => point.entityId === 'CN:SH.601966'), false)
    assert.equal(derived.data.some(point => point.value === null), false)
    assert.ok(derived.sources.every(source => source.fetchedAt === PARENT_FETCHED))
    assert.notEqual(derived.entities, parent.entities)
    assert.notEqual(derived.data, parent.data)

    const liveParent = getTurnCanvasRecords(SESSION)?.find(item => item.id === parent.id)
    assert.deepEqual(liveParent, frozen)
    derived.entities.splice(0, 1)
    assert.equal(liveParent.entities.length, 3)

    const stripped = stripResearchCanvasEventField(result)
    assert.equal('canvas_event' in stripped, false)
    assert.equal('data' in stripped, false)
  })
})

test('narrow period local derive does not query provider', async () => {
  const boxed = makeHub()
  const parent = parentDataset()
  await withTurn(boxed.hub, { widgets: [], datasetRecords: [parent] }, async (tools) => {
    const queriesBefore = boxed.queryCount()
    const result = await tools.refine_dataset.handler({
      datasetId: parent.id,
      operation: { type: 'change_period', start: '2023', end: '2025' },
    })
    assert.equal(result.ok, true)
    assert.equal(boxed.queryCount(), queriesBefore)
    const derived = extractResearchCanvasEvent(result)?.dataset
    assert.deepEqual(derived.periods, ['2023', '2024', '2025'])
    assert.ok(derived.data.every(point => ['2023', '2024', '2025'].includes(point.period)))
    assert.ok(derived.sources.every(source => source.fetchedAt === PARENT_FETCHED))
    assert.equal(derived.parentDatasetId, parent.id)
    const liveParent = getTurnCanvasRecords(SESSION)?.find(item => item.id === parent.id)
    assert.deepEqual(liveParent.periods, ['2021', '2022', '2023', '2024', '2025'])
  })
})

test('period beyond parent fetches all entities and uses new fetchedAt', async () => {
  const boxed = makeHub()
  const parent = parentDataset()
  await withTurn(boxed.hub, { widgets: [], datasetRecords: [parent] }, async (tools) => {
    const result = await tools.refine_dataset.handler({
      datasetId: parent.id,
      operation: { type: 'change_period', start: '2018', end: '2025' },
    })
    assert.equal(result.ok, true)
    assert.equal(boxed.queryCount(), 3)
    const derived = extractResearchCanvasEvent(result)?.dataset
    assert.deepEqual(derived.periods[0], '2018')
    assert.ok(derived.sources.every(source => source.fetchedAt !== PARENT_FETCHED))
    const liveParent = getTurnCanvasRecords(SESSION)?.find(item => item.id === parent.id)
    assert.ok(liveParent.sources.every(source => source.fetchedAt === PARENT_FETCHED))
  })
})

test('add entity by ticker queries only the new company', async () => {
  const boxed = makeHub()
  const parent = parentDataset()
  await withTurn(boxed.hub, { widgets: [], datasetRecords: [parent] }, async (tools) => {
    const result = await tools.refine_dataset.handler({
      datasetId: parent.id,
      operation: { type: 'add_entities', entities: ['000589.SZ'] },
    })
    assert.equal(result.ok, true)
    assert.equal(boxed.queryCount(), 1)
    assert.deepEqual(boxed.queriedSymbols(), ['000589'])
    const derived = extractResearchCanvasEvent(result)?.dataset
    assert.equal(derived.entities.length, 4)
    const added = derived.entities.find(item => item.ticker === '000589.SZ')
    assert.ok(added)
    const newSource = derived.sources.find(source => source.entityId === added.id)
    const oldSource = derived.sources.find(source => source.entityId === 'CN:SH.601058')
    assert.ok(newSource.fetchedAt !== PARENT_FETCHED)
    assert.equal(oldSource.fetchedAt, PARENT_FETCHED)
    assert.equal(derived.parentDatasetId, parent.id)
  })
})

test('add entity by unresolved Chinese name is fail-closed without ticker fallback', async () => {
  const boxed = makeHub()
  const parent = parentDataset()
  await withTurn(boxed.hub, { widgets: [], datasetRecords: [parent] }, async (tools) => {
    const result = await tools.refine_dataset.handler({
      datasetId: parent.id,
      operation: { type: 'add_entities', entities: ['贵州轮胎'] },
    })
    assert.match(String(result.error), /无法确认/)
    assert.equal(boxed.queryCount(), 0)
    assert.equal(extractResearchCanvasEvent(result), null)
  })
})

test('invalid period and unknown entity are rejected', async () => {
  const boxed = makeHub()
  const parent = parentDataset()
  await withTurn(boxed.hub, { widgets: [], datasetRecords: [parent] }, async (tools) => {
    const inverted = await tools.refine_dataset.handler({
      datasetId: parent.id,
      operation: { type: 'change_period', start: '2025', end: '2021' },
    })
    assert.match(String(inverted.error), /起始年份/)

    const unknown = await tools.refine_dataset.handler({
      datasetId: parent.id,
      operation: { type: 'remove_entities', entities: ['贵州轮胎'] },
    })
    assert.match(String(unknown.error), /无法确认/)
    assert.equal(boxed.queryCount(), 0)
  })
})

test('meta-only snapshot cannot locally derive', async () => {
  const boxed = makeHub()
  const parent = parentDataset()
  await withTurn(boxed.hub, {
    widgets: [],
    datasets: [{
      id: parent.id,
      metric: 'gross_margin',
      title: parent.title,
      entityNames: ['赛轮轮胎', '玲珑轮胎', '森麒麟'],
      periodRange: '2021–2025',
    }],
  }, async (tools) => {
    const result = await tools.refine_dataset.handler({
      datasetId: parent.id,
      operation: { type: 'remove_entities', entities: ['玲珑'] },
    })
    assert.match(String(result.error), /不存在或本轮无法调整/)
  })
})

test('propose_widget from derived dataset and update_widget datasetId keep layout identity', async () => {
  const boxed = makeHub()
  const parent = parentDataset()
  const widget = {
    id: 'rc-line-1',
    type: 'line_chart',
    title: '毛利率趋势',
    datasetId: parent.id,
  }
  await withTurn(boxed.hub, {
    widgets: [widget],
    datasets: [{
      id: parent.id,
      metric: 'gross_margin',
      title: parent.title,
      entityNames: ENTITIES.map(item => item.name),
      periodRange: '2021–2025',
    }],
    datasetRecords: [parent],
  }, async (tools) => {
    const refined = await tools.refine_dataset.handler({
      datasetId: parent.id,
      operation: { type: 'remove_entities', entities: ['玲珑'] },
    })
    const proposed = await tools.propose_widget.handler({
      type: 'line_chart',
      title: '赛轮与森麒麟毛利率',
      datasetId: refined.datasetId,
    })
    assert.equal(proposed.ok, true)
    assert.equal(proposed.datasetId, refined.datasetId)
    assert.equal(getTurnCanvasWidgets(SESSION)?.[0]?.datasetId, parent.id)

    const updated = await tools.update_widget.handler({
      id: widget.id,
      datasetId: refined.datasetId,
    })
    assert.equal(updated.ok, true)
    assert.equal(updated.widget.id, widget.id)
    assert.equal(updated.widget.datasetId, refined.datasetId)
    assert.equal(updated.widget.type, 'line_chart')
    const unknown = await tools.update_widget.handler({
      id: widget.id,
      datasetId: 'research-ds-cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    })
    assert.equal(unknown.error, 'datasetId 不受支持')
  }, 'call_refine_preview')
})

test('LLM context stays metadata-only after records hydrate', async () => {
  const parent = parentDataset()
  beginResearchCanvasTurn(SESSION, {
    widgets: [],
    datasetRecords: [parent, unrelatedDataset()],
  })
  try {
    const context = formatResearchCanvasTurnContext(SESSION)
    assert.match(context, /仅元数据/)
    assert.match(context, /research-ds-aaaaaaaa/)
    assert.match(context, /系列键：/)
    assert.match(context, /赛轮轮胎=CN:SH.601058/)
    assert.equal(context.includes('"data"'), false)
    assert.equal(context.includes('18.2'), false)
    const records = getTurnCanvasRecords(SESSION)
    assert.ok(records?.some(item => item.data.length > 0))
    assert.equal(getTurnCanvasDatasets(SESSION)?.every(item => !('data' in item)), true)
  } finally {
    endResearchCanvasTurn(SESSION)
  }
})

test('scoped id rank keeps recent derived ahead of first-N truncation', () => {
  const active = 'research-ds-11111111-1111-4111-8111-111111111111'
  const widget = 'research-ds-22222222-2222-4222-8222-222222222222'
  const older = 'research-ds-33333333-3333-4333-8333-333333333333'
  const newest = 'research-ds-44444444-4444-4444-8444-444444444444'
  const ranked = rankScopedDatasetIds({
    activeProposalDatasetId: active,
    widgetDatasetIds: [widget],
    sessionDatasetIds: [older, newest],
  })
  assert.deepEqual(ranked, [active, widget, newest, older])
  const capped = selectScopedDatasetIds({
    activeProposalDatasetId: active,
    widgetDatasetIds: [widget],
    sessionDatasetIds: [older, newest],
  }, 3)
  assert.deepEqual(capped, [active, widget, newest])
  assert.equal(capped.includes(older), false)
})

test('routing: refine vs view change vs metric change', () => {
  assert.equal(resolveToolRoutePlan({ message: '去掉玲珑' }).intent, 'research_canvas_refine')
  assert.equal(resolveToolRoutePlan({ message: '去掉玲珑' }).preferredTools[0], 'refine_dataset')
  assert.equal(resolveToolRoutePlan({ message: '只看2023–2025' }).preferredTools[0], 'refine_dataset')
  assert.equal(resolveToolRoutePlan({ message: '再加贵州轮胎' }).preferredTools[0], 'refine_dataset')
  assert.equal(resolveToolRoutePlan({ message: '改成柱状图' }).preferredTools[0], 'propose_widget')
  assert.ok(resolveToolRoutePlan({ message: '改成柱状图' }).avoidTools.includes('update_widget'))
  assert.ok(!resolveToolRoutePlan({ message: '去掉玲珑' }).preferredTools.includes('update_widget'))
  assert.equal(resolveToolRoutePlan({ message: '改看ROE' }).preferredTools[0], 'query_data')
  assert.equal(resolveToolRoutePlan({ message: '把排名改成折线图' }).preferredTools[0], 'update_widget')
  assert.equal(resolveToolRoutePlan({ message: '删掉排名图' }).preferredTools[0], 'delete_widget')
})
