import { describe, expect, it } from 'vitest'
import type { ChatDisplayMessage } from '../../types/chat'
import {
  buildResearchCanvasAgentSnapshot,
  collectSessionDatasetIds,
} from './sessionDatasetSnapshot'
import type { Dataset, PersistedCanvasState } from './types'

const PARENT_ID = 'research-ds-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const DERIVED_ID = 'research-ds-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const UNRELATED_ID = 'research-ds-ffffffff-ffff-4fff-8fff-ffffffffffff'

function dataset(id: string, title: string): Dataset {
  return {
    id,
    title,
    metric: 'gross_margin',
    unit: '%',
    entities: [{
      id: 'CN:SH.601058',
      name: '赛轮轮胎',
      ticker: '601058.SH',
      market: 'CN',
      type: 'equity',
    }],
    periods: ['2025'],
    data: [{ entityId: 'CN:SH.601058', period: '2025', value: 21 }],
    sources: [{
      provider: 'tushare',
      entityId: 'CN:SH.601058',
      metric: 'gross_margin',
      fetchedAt: '2026-09-10T00:00:00.000Z',
    }],
  }
}

describe('session dataset snapshot scope', () => {
  it('collects dataset ids from session tool steps', () => {
    const messages: ChatDisplayMessage[] = [{
      role: 'assistant',
      content: '',
      at: '2026-09-10T00:00:00.000Z',
      toolSteps: [{
        id: 'call_1',
        tool: 'query_data',
        label: '查询研究数据',
        status: 'done',
        startedAt: '2026-09-10T00:00:00.000Z',
        resultDetail: JSON.stringify({ ok: true, datasetId: PARENT_ID }),
      }],
    }]
    expect(collectSessionDatasetIds(messages)).toEqual([PARENT_ID])
  })

  it('does not send unreferenced global store datasets', () => {
    const state: PersistedCanvasState = {
      version: 2,
      widgets: [{
        id: 'rc-line',
        type: 'line_chart',
        title: '趋势',
        datasetId: PARENT_ID,
      }],
      layout: [{ i: 'rc-line', x: 0, y: 0, w: 6, h: 8 }],
      datasets: [
        dataset(PARENT_ID, '父集'),
        dataset(DERIVED_ID, '派生'),
        dataset(UNRELATED_ID, '无关会话'),
      ],
    }
    const messages: ChatDisplayMessage[] = [{
      role: 'assistant',
      content: '',
      at: '2026-09-10T00:00:00.000Z',
      toolSteps: [{
        id: 'call_2',
        tool: 'refine_dataset',
        label: '调整研究范围',
        status: 'done',
        startedAt: '2026-09-10T00:00:00.000Z',
        resultDetail: JSON.stringify({ ok: true, datasetId: DERIVED_ID }),
      }],
    }]
    const snapshot = buildResearchCanvasAgentSnapshot({
      state,
      messages,
      activeProposal: {
        proposalId: 'call_2',
        type: 'line_chart',
        title: '预览',
        datasetId: DERIVED_ID,
      },
    })
    const ids = snapshot.datasetRecords.map(item => item.id)
    expect(ids).toContain(PARENT_ID)
    expect(ids).toContain(DERIVED_ID)
    expect(ids).not.toContain(UNRELATED_ID)
    expect(snapshot.datasets.every(item => !('data' in item))).toBe(true)
    expect(snapshot.datasetRecords[0]?.id).toBe(DERIVED_ID)
  })

  it('omits activeWidget when nothing is selected', () => {
    const snapshot = buildResearchCanvasAgentSnapshot({
      state: {
        version: 2,
        widgets: [{
          id: 'rc-line',
          type: 'line_chart',
          title: '趋势',
          datasetId: PARENT_ID,
        }],
        layout: [{ i: 'rc-line', x: 0, y: 0, w: 6, h: 8 }],
        datasets: [dataset(PARENT_ID, '父集')],
      },
      messages: [],
    })
    expect(snapshot).not.toHaveProperty('activeWidget')
  })

  it('includes derived activeWidget metadata without dataset rows', () => {
    const snapshot = buildResearchCanvasAgentSnapshot({
      state: {
        version: 2,
        widgets: [{
          id: 'widget-123',
          type: 'line_chart',
          title: 'Revenue & Operating Margin',
          datasetId: PARENT_ID,
        }],
        layout: [{ i: 'widget-123', x: 0, y: 0, w: 8, h: 6 }],
        datasets: [dataset(PARENT_ID, '父集')],
      },
      messages: [],
      activeWidgetId: 'widget-123',
    })
    expect(snapshot.activeWidget).toEqual({
      widgetId: 'widget-123',
      type: 'line_chart',
      title: 'Revenue & Operating Margin',
      datasetId: PARENT_ID,
      subject: { ticker: '601058.SH', companyName: '赛轮轮胎' },
      period: { from: '2025', to: '2025' },
      metrics: ['gross_margin'],
    })
    expect(snapshot.activeWidget).not.toHaveProperty('data')
    expect(JSON.stringify(snapshot.activeWidget)).not.toContain('"value":')
  })
})
