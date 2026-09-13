/**
 * 投研用户路径：聚合均值 → 预览 → 预览阶段改色（无需 Adopt）
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateDatasetByGroups } from '../packages/shared/dist/research-dataset-aggregate.js'
import {
  buildResearchCanvasTools,
  extractResearchCanvasEvent,
} from '../packages/agent/dist/research-canvas-tools.js'
import { runInToolSession } from '../packages/agent/dist/mcp/tool-session-context.js'
import {
  beginResearchCanvasTurn,
  endResearchCanvasTurn,
  getTurnCanvasProposals,
} from '../packages/agent/dist/research-canvas-turn-state.js'

const SESSION = 'rc-preview-style-test'

const PARENT_DATASET = {
  id: 'research-ds-11111111-1111-4111-8111-111111111111',
  title: '八家毛利率',
  metric: 'gross_margin',
  unit: '%',
  entities: [
    { id: 'e-catl', name: '宁德时代', ticker: '300750.SZ', market: 'CN', type: 'equity' },
    { id: 'e-eve', name: '亿纬锂能', ticker: '300014.SZ', market: 'CN', type: 'equity' },
    { id: 'e-byd', name: '比亚迪', ticker: '002594.SZ', market: 'CN', type: 'equity' },
    { id: 'e-seres', name: '赛力斯', ticker: '601127.SH', market: 'CN', type: 'equity' },
  ],
  periods: ['2024', '2025'],
  data: [
    { entityId: 'e-catl', period: '2024', value: 20.3 },
    { entityId: 'e-eve', period: '2024', value: 17.1 },
    { entityId: 'e-byd', period: '2024', value: 16.6 },
    { entityId: 'e-seres', period: '2024', value: 28.0 },
    { entityId: 'e-catl', period: '2025', value: 18.1 },
    { entityId: 'e-eve', period: '2025', value: 17.9 },
    { entityId: 'e-byd', period: '2025', value: 15.3 },
    { entityId: 'e-seres', period: '2025', value: 29.0 },
  ],
  sources: [],
}

function toolsByName() {
  const map = new Map(buildResearchCanvasTools(null).map(tool => [tool.name, tool]))
  return {
    refine: map.get('refine_dataset'),
    propose: map.get('propose_widget'),
    updateProposal: map.get('update_proposal'),
    updateWidget: map.get('update_widget'),
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

test('投研路径：分组均值预览后 update_proposal 改色，无需 update_widget', async () => {
  const { refine, propose, updateProposal, updateWidget } = toolsByName()
  assert.ok(refine && propose && updateProposal && updateWidget)

  const aggregated = aggregateDatasetByGroups(PARENT_DATASET, [
    {
      id: 'group-22222222-2222-4222-8222-222222222222',
      name: '电池链条',
      memberIds: ['e-catl', 'e-eve'],
    },
    {
      id: 'group-33333333-3333-4333-8333-333333333333',
      name: '整车链条',
      memberIds: ['e-byd', 'e-seres'],
    },
  ], 'arithmetic_mean')
  assert.ok(!('error' in aggregated))

  const derivedDataset = {
    ...aggregated,
    id: 'research-ds-44444444-4444-4444-8444-444444444444',
    parentDatasetId: PARENT_DATASET.id,
    transform: {
      type: 'aggregate_groups',
      method: 'arithmetic_mean',
      groups: [
        { id: 'group-22222222-2222-4222-8222-222222222222', name: '电池链条', memberIds: ['e-catl', 'e-eve'] },
        { id: 'group-33333333-3333-4333-8333-333333333333', name: '整车链条', memberIds: ['e-byd', 'e-seres'] },
      ],
    },
    createdAt: '2026-09-12T00:00:00.000Z',
  }

  const batteryId = derivedDataset.entities[0]?.id ?? ''
  const vehicleId = derivedDataset.entities[1]?.id ?? ''

  await withTurn({
    widgets: [],
    datasetRecords: [PARENT_DATASET, derivedDataset],
    datasets: [],
  }, async () => {
    const proposed = await runInToolSession(SESSION, () => propose.handler({
      intent: 'compare',
      type: 'line_chart',
      title: '电池链条 vs 整车链条 毛利率均值',
      datasetId: derivedDataset.id,
    }), 'call_propose_chain_margin')
    assert.equal(proposed.ok, true)
    assert.equal(proposed.proposalId, 'call_propose_chain_margin')

    const styled = await updateProposal.handler({
      style: {
        legend: { position: 'right' },
        yAxis: { zero: true },
        series: {
          [batteryId]: { color: '#2563EB', label: '电池链条' },
          [vehicleId]: { color: '#EA580C', label: '整车链条' },
        },
      },
    })
    assert.equal(styled.ok, true)
    assert.equal(styled.style?.legend?.position, 'right')
    assert.equal(styled.style?.series?.[batteryId]?.color, '#2563EB')
    assert.equal(styled.style?.series?.[vehicleId]?.color, '#EA580C')

    const event = extractResearchCanvasEvent(styled)
    assert.equal(event?.type, 'widget_proposed')
    assert.equal(event.proposal.style?.series?.[vehicleId]?.label, '整车链条')

    const proposals = getTurnCanvasProposals(SESSION)
    assert.equal(proposals?.length, 1)
    assert.equal(proposals?.[0]?.style?.series?.[batteryId]?.color, '#2563EB')

    const widgetUpdate = await updateWidget.handler({
      id: 'rc-not-on-canvas',
      style: { legend: { show: false } },
    })
    assert.equal(widgetUpdate.error, '组件不存在')
  })
})

test('update_proposal accepts company names and named colors', async () => {
  const { propose, updateProposal } = toolsByName()
  await withTurn({
    widgets: [],
    datasetRecords: [PARENT_DATASET],
    datasets: [],
  }, async () => {
    const proposed = await runInToolSession(SESSION, () => propose.handler({
      intent: 'compare',
      type: 'line_chart',
      title: '宁德时代与比亚迪毛利率',
      datasetId: PARENT_DATASET.id,
    }), 'call_propose_named_color')
    assert.equal(proposed.ok, true)

    const styled = await updateProposal.handler({
      style: {
        series: {
          宁德时代: { color: '蓝色' },
          比亚迪: { color: '橙色' },
        },
      },
    })
    assert.equal(styled.ok, true)
    assert.equal(styled.style?.series?.['e-catl']?.color, '#2563EB')
    assert.equal(styled.style?.series?.['e-byd']?.color, '#EA580C')
    assert.equal(styled.style?.series?.['宁德时代'], undefined)
  })
})
