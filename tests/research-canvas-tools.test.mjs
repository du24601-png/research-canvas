/**
 * Research Canvas tools — turn state, schema fail-closed, event envelope.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  RESEARCH_CANVAS_DATASET_ID,
  sanitizeResearchCanvasSnapshot,
} from '../packages/shared/dist/research-canvas-protocol.js'
import {
  buildResearchCanvasTools,
  extractResearchCanvasEvent,
  stripResearchCanvasEventField,
} from '../packages/agent/dist/research-canvas-tools.js'
import { runInToolSession } from '../packages/agent/dist/mcp/tool-session-context.js'
import {
  beginResearchCanvasTurn,
  endResearchCanvasTurn,
  getTurnCanvasProposals,
  getTurnCanvasWidgets,
} from '../packages/agent/dist/research-canvas-turn-state.js'

const SESSION = 'rc-turn-test'

function toolsByName() {
  const map = new Map(buildResearchCanvasTools().map(tool => [tool.name, tool]))
  return {
    create: map.get('create_widget'),
    update: map.get('update_widget'),
    delete: map.get('delete_widget'),
    propose: map.get('propose_widget'),
  }
}

async function withTurn(snapshot, fn, toolCallId) {
  beginResearchCanvasTurn(SESSION, snapshot)
  try {
    return await runInToolSession(SESSION, fn, toolCallId)
  } finally {
    endResearchCanvasTurn(SESSION)
  }
}

test('snapshot fail-soft drops illegal items and caps at 50', () => {
  const widgets = sanitizeResearchCanvasSnapshot({
    widgets: [
      { id: 'a', type: 'line_chart', title: '趋势', datasetId: RESEARCH_CANVAS_DATASET_ID },
      { id: 'bad', type: 'pie', title: 'x', datasetId: RESEARCH_CANVAS_DATASET_ID },
      { id: 'a', type: 'bar_chart', title: '重复', datasetId: RESEARCH_CANVAS_DATASET_ID },
      { id: 'b', type: 'table', title: '明细', datasetId: 'ds-other' },
      { extra: true },
    ],
  })
  assert.equal(widgets.length, 1)
  assert.equal(widgets[0].id, 'a')

  const overflow = sanitizeResearchCanvasSnapshot({
    widgets: Array.from({ length: 60 }, (_, i) => ({
      id: `w-${i}`,
      type: 'table',
      title: `t${i}`,
      datasetId: RESEARCH_CANVAS_DATASET_ID,
    })),
  })
  assert.equal(overflow.length, 50)
})

test('snapshot accepts extended ECharts widget types', () => {
  const widgets = sanitizeResearchCanvasSnapshot({
    widgets: [
      { id: 'p', type: 'pie_chart', title: '构成', datasetId: RESEARCH_CANVAS_DATASET_ID },
      { id: 'd', type: 'donut_chart', title: '圆环', datasetId: RESEARCH_CANVAS_DATASET_ID },
      { id: 's', type: 'stacked_bar', title: '堆积', datasetId: RESEARCH_CANVAS_DATASET_ID },
      { id: 'g', type: 'grouped_bar', title: '分组', datasetId: RESEARCH_CANVAS_DATASET_ID },
      { id: 'k', type: 'candlestick', title: '日K', datasetId: RESEARCH_CANVAS_DATASET_ID },
      { id: 'h', type: 'heatmap_table', title: '热力', datasetId: RESEARCH_CANVAS_DATASET_ID },
    ],
  })
  assert.equal(widgets.length, 6)
  assert.deepEqual(widgets.map(item => item.type), [
    'pie_chart',
    'donut_chart',
    'stacked_bar',
    'grouped_bar',
    'candlestick',
    'heatmap_table',
  ])
})

test('create/update/delete share turn state and emit canvas_event', async () => {
  const { create, update, delete: del } = toolsByName()
  assert.ok(create && update && del)

  await withTurn({ widgets: [] }, async () => {
    const created = await create.handler({
      type: 'line_chart',
      title: '毛利率趋势',
      datasetId: RESEARCH_CANVAS_DATASET_ID,
    })
    assert.equal(created.ok, true)
    assert.equal(created.widget.title, '毛利率趋势')
    assert.equal(created.widget.datasetId, RESEARCH_CANVAS_DATASET_ID)
    assert.match(created.widget.id, /^rc-/)
    const createdEvent = extractResearchCanvasEvent(created)
    assert.equal(createdEvent?.type, 'widget_created')
    assert.equal(getTurnCanvasWidgets(SESSION)?.length, 1)

    const updated = await update.handler({
      id: created.widget.id,
      type: 'bar_chart',
      title: '2025年毛利率排名',
    })
    assert.equal(updated.ok, true)
    assert.equal(updated.widget.type, 'bar_chart')
    assert.equal(extractResearchCanvasEvent(updated)?.type, 'widget_updated')
    assert.equal(getTurnCanvasWidgets(SESSION)?.[0]?.title, '2025年毛利率排名')

    const renamed = await update.handler({
      id: created.widget.id,
      title: '五年毛利率趋势',
    })
    assert.equal(renamed.widget.title, '五年毛利率趋势')

    const deleted = await del.handler({ id: created.widget.id })
    assert.equal(deleted.ok, true)
    assert.equal(extractResearchCanvasEvent(deleted)?.type, 'widget_deleted')
    assert.deepEqual(getTurnCanvasWidgets(SESSION), [])
  })
})

test('same-turn create then update does not require the request snapshot id', async () => {
  const { create, update } = toolsByName()
  await withTurn({ widgets: [] }, async () => {
    const created = await create.handler({
      type: 'bar_chart',
      title: '排名',
      datasetId: RESEARCH_CANVAS_DATASET_ID,
    })
    const updated = await update.handler({ id: created.widget.id, type: 'line_chart' })
    assert.equal(updated.ok, true)
    assert.equal(updated.widget.type, 'line_chart')
  })
})

test('tool inputs fail closed', async () => {
  const { create, update, delete: del } = toolsByName()
  const seed = {
    widgets: [{
      id: 'rc-line-gross-margin',
      type: 'line_chart',
      title: '毛利率趋势',
      datasetId: RESEARCH_CANVAS_DATASET_ID,
    }],
  }
  await withTurn(seed, async () => {
    const layout = await create.handler({
      type: 'line_chart',
      title: '趋势',
      datasetId: RESEARCH_CANVAS_DATASET_ID,
      x: 1,
    })
    assert.equal(layout.error, '禁止传入布局坐标或尺寸')
    assert.equal(extractResearchCanvasEvent(layout), null)

    const badType = await create.handler({ type: 'heatmap', title: '热力图' })
    assert.match(String(badType.error), /type/)

    const missing = await update.handler({ id: 'no-such', title: 'x' })
    assert.equal(missing.error, '组件不存在')
    assert.equal(extractResearchCanvasEvent(missing), null)

    const extra = await del.handler({ id: 'rc-line-gross-margin', foo: 1 })
    assert.match(String(extra.error), /不支持参数/)

    assert.equal(getTurnCanvasWidgets(SESSION)?.length, 1)
  })
})

test('strip canvas_event before tool_done payload', () => {
  const result = {
    ok: true,
    widget: { id: 'rc-1', type: 'table', title: '明细', datasetId: RESEARCH_CANVAS_DATASET_ID },
    canvas_event: { type: 'widget_deleted', id: 'rc-1' },
  }
  assert.equal(extractResearchCanvasEvent(result)?.type, 'widget_deleted')
  const stripped = stripResearchCanvasEventField(result)
  assert.equal(stripped.ok, true)
  assert.equal('canvas_event' in stripped, false)
})

test('turn state is destroyed after the chat lifecycle helper ends', async () => {
  const { create } = toolsByName()
  await withTurn({ widgets: [] }, async () => {
    await create.handler({
      type: 'table',
      title: '明细',
      datasetId: RESEARCH_CANVAS_DATASET_ID,
    })
    assert.ok(getTurnCanvasWidgets(SESSION)?.length)
  })
  assert.equal(getTurnCanvasWidgets(SESSION), null)
})

const REAL_DS = 'research-ds-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const REAL_SNAPSHOT = {
  widgets: [],
  datasets: [{
    id: REAL_DS,
    metric: 'gross_margin',
    title: '毛利率',
    entityNames: ['赛轮轮胎', '玲珑轮胎', '森麒麟'],
    periodRange: '2021–2025',
  }],
}

test('propose_widget emits widget_proposed bound to toolCallId and does not create canvas widgets', async () => {
  const { propose } = toolsByName()
  assert.ok(propose)
  await withTurn(REAL_SNAPSHOT, async () => {
    const result = await propose.handler({
      type: 'line_chart',
      title: '毛利率趋势',
      datasetId: REAL_DS,
    })
    assert.equal(result.ok, true)
    assert.equal(result.proposalId, 'call_abc12345')
    assert.equal(result.type, 'line_chart')
    assert.equal(result.title, '毛利率趋势')
    assert.equal(result.datasetId, REAL_DS)
    const event = extractResearchCanvasEvent(result)
    assert.equal(event?.type, 'widget_proposed')
    assert.equal(event?.proposal.id, 'call_abc12345')
    assert.equal(getTurnCanvasWidgets(SESSION)?.length, 0)
    assert.equal(getTurnCanvasProposals(SESSION)?.[0]?.id, 'call_abc12345')
    const stripped = stripResearchCanvasEventField(result)
    assert.equal('canvas_event' in stripped, false)
    assert.equal('data' in stripped, false)
  }, 'call_abc12345')
})

test('propose_widget accepts grouped_bar', async () => {
  const { propose } = toolsByName()
  await withTurn(REAL_SNAPSHOT, async () => {
    const result = await propose.handler({
      type: 'grouped_bar',
      title: '营收对照',
      datasetId: REAL_DS,
      intent: 'compare',
    })
    assert.equal(result.ok, true)
    assert.equal(result.type, 'grouped_bar')
    assert.equal(result.view?.intent, 'compare')
    assert.equal(extractResearchCanvasEvent(result)?.proposal.type, 'grouped_bar')
  }, 'call_grouped_bar')
})

test('propose_widget accepts heatmap_table and intent', async () => {
  const { propose } = toolsByName()
  await withTurn(REAL_SNAPSHOT, async () => {
    const result = await propose.handler({
      type: 'heatmap_table',
      title: '毛利率对照',
      datasetId: REAL_DS,
      intent: 'compare',
      params: { period: '2024' },
    })
    assert.equal(result.ok, true)
    assert.equal(result.type, 'heatmap_table')
    assert.equal(result.view?.intent, 'compare')
    assert.equal(result.view?.period, '2024')
    assert.equal(extractResearchCanvasEvent(result)?.proposal.type, 'heatmap_table')
  }, 'call_heat_compare')
})

test('propose_widget rejects mock dataset and layout fields', async () => {
  const { propose } = toolsByName()
  await withTurn(REAL_SNAPSHOT, async () => {
    const mock = await propose.handler({
      type: 'line_chart',
      title: '趋势',
      datasetId: RESEARCH_CANVAS_DATASET_ID,
    })
    assert.match(String(mock.error), /真实数据/)
    assert.equal(extractResearchCanvasEvent(mock), null)

    const layout = await propose.handler({
      type: 'line_chart',
      title: '趋势',
      datasetId: REAL_DS,
      x: 1,
    })
    assert.equal(layout.error, '禁止传入布局坐标或尺寸')
  }, 'call_abc12345')
})

test('activeWidget snapshot is fail-soft and injected into turn context', async () => {
  const { sanitizeResearchCanvasActiveWidget } = await import('../packages/shared/dist/research-canvas-protocol.js')
  const {
    beginResearchCanvasTurn,
    endResearchCanvasTurn,
  } = await import('../packages/agent/dist/research-canvas-turn-state.js')
  const { formatResearchCanvasTurnContext } = await import('../packages/agent/dist/research-canvas-context.js')
  const session = 'rc-active-widget'
  const widget = sanitizeResearchCanvasActiveWidget({
    widgetId: 'widget-123',
    type: 'line_chart',
    title: 'Revenue & Operating Margin',
    datasetId: REAL_DS,
    subject: { ticker: 'MSFT', companyName: 'Microsoft' },
    period: { from: '2022', to: '2026' },
    metrics: ['revenue', 'operating_margin'],
    rows: [{ secret: true }],
  })
  assert.equal(widget?.widgetId, 'widget-123')
  assert.equal('rows' in (widget ?? {}), false)
  assert.equal(sanitizeResearchCanvasActiveWidget({ title: 'x' }), null)

  beginResearchCanvasTurn(session, {
    widgets: [{
      id: 'widget-123',
      type: 'line_chart',
      title: 'Revenue & Operating Margin',
      datasetId: REAL_DS,
    }],
    datasets: REAL_SNAPSHOT.datasets,
    activeWidget: widget,
  })
  try {
    const text = formatResearchCanvasTurnContext(session)
    assert.match(text, /用户当前选中的组件/)
    assert.match(text, /Microsoft/)
    assert.match(text, /operating_margin/)
    assert.equal(text.includes('secret'), false)
  } finally {
    endResearchCanvasTurn(session)
  }
})

test('update_widget merges chart style by entity id', async () => {
  const { create, update } = toolsByName()
  await withTurn({ widgets: [] }, async () => {
    const created = await create.handler({
      type: 'line_chart',
      title: '链条对比',
      datasetId: RESEARCH_CANVAS_DATASET_ID,
    })
    const styled = await update.handler({
      id: created.widget.id,
      style: {
        legend: { position: 'right' },
        series: { 'group-a': { color: '#EA580C', label: '整车链条' } },
      },
    })
    assert.equal(styled.ok, true)
    assert.equal(styled.widget.style?.legend?.position, 'right')
    assert.equal(styled.widget.style?.series?.['group-a']?.color, '#EA580C')
    const patched = await update.handler({
      id: created.widget.id,
      style: { series: { 'group-b': { color: '#2563EB' } } },
    })
    assert.equal(patched.widget.style?.series?.['group-a']?.color, '#EA580C')
    assert.equal(patched.widget.style?.series?.['group-b']?.color, '#2563EB')
  })
})
