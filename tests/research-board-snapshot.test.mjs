/**
 * Research board publish snapshots — sanitize, persist, public read.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import {
  sanitizeResearchBoardSnapshotPayload,
} from '../packages/shared/dist/research-board-snapshot.js'
import { RESEARCH_CANVAS_WIDGET_LIMIT } from '../packages/shared/dist/research-canvas-protocol.js'
import {
  initResearchBoardSnapshotsSchema,
  ResearchBoardSnapshotsRepository,
} from '../packages/user-store/dist/research-board-snapshots.js'

function samplePayload(entityCount = 1) {
  const entities = Array.from({ length: entityCount }, (_, index) => ({
    id: `e${index + 1}`,
    name: `公司${index + 1}`,
    ticker: `60000${index + 1}.SH`,
    market: 'CN',
    type: 'equity',
  }))
  const periods = ['2023', '2024']
  const widgetIds = entities.map((_, index) => `w${index + 1}`)
  return {
    title: '测试看板',
    widgets: widgetIds.map((id, index) => ({
      id,
      type: 'line_chart',
      title: `走势 ${index + 1}`,
      datasetId: 'research-ds-11111111-1111-4111-8111-111111111111',
    })),
    layout: widgetIds.map((id, index) => ({
      i: id,
      x: (index % 2) * 6,
      y: Math.floor(index / 2) * 8,
      w: 6,
      h: 8,
    })),
    datasets: [{
      id: 'research-ds-11111111-1111-4111-8111-111111111111',
      title: 'ROE',
      metric: 'roe',
      unit: '%',
      entities,
      periods,
      data: entities.flatMap(entity => periods.map(period => ({
        entityId: entity.id,
        period,
        value: 12,
      }))),
      sources: entities.flatMap(entity => periods.map(period => ({
        provider: 'tushare',
        entityId: entity.id,
        metric: 'roe',
        period,
        fetchedAt: '2026-01-01T00:00:00.000Z',
        fieldLabel: '净资产收益率',
      }))),
      query: {
        entities: entities.map(entity => entity.ticker),
        metric: 'roe',
        start: '2023',
        end: '2024',
      },
      createdAt: '2026-01-01T00:00:00.000Z',
    }],
  }
}

test('sanitizeResearchBoardSnapshotPayload rejects empty and oversize payloads', () => {
  assert.equal(sanitizeResearchBoardSnapshotPayload(null), null)
  assert.equal(sanitizeResearchBoardSnapshotPayload({ title: 'x' }), null)
  const ok = sanitizeResearchBoardSnapshotPayload(samplePayload(2))
  assert.ok(ok)
  assert.equal(ok.widgets.length, 2)

  const tooManyWidgets = samplePayload(1)
  tooManyWidgets.widgets = Array.from({ length: RESEARCH_CANVAS_WIDGET_LIMIT + 1 }, (_, index) => ({
    id: `widget-${index}`,
    type: 'line_chart',
    title: `图 ${index}`,
    datasetId: tooManyWidgets.datasets[0].id,
  }))
  tooManyWidgets.layout = tooManyWidgets.widgets.map((widget, index) => ({
    i: widget.id,
    x: 0,
    y: index,
    w: 6,
    h: 6,
  }))
  assert.equal(sanitizeResearchBoardSnapshotPayload(tooManyWidgets), null)
})

test('ResearchBoardSnapshotsRepository creates and reads snapshots', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-snapshot-'))
  const db = new Database(path.join(dir, 'test.db'))
  initResearchBoardSnapshotsSchema(db)
  const repo = new ResearchBoardSnapshotsRepository(db)
  const payload = samplePayload(1)
  const created = repo.create({
    sessionId: 'session-1',
    title: payload.title,
    payload,
  })
  assert.match(created.id, /^[0-9a-f-]{36}$/i)
  const loaded = repo.getById(created.id)
  assert.ok(loaded)
  assert.equal(loaded.title, '测试看板')
  assert.equal(loaded.payload.widgets.length, 1)
  assert.equal(repo.getById('not-a-uuid'), null)
  assert.equal(repo.getById('11111111-1111-4111-8111-111111111111'), null)
  db.close()
})

test('ResearchBoardSnapshotsRepository rejects invalid payload', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-snapshot-'))
  const db = new Database(path.join(dir, 'test.db'))
  initResearchBoardSnapshotsSchema(db)
  const repo = new ResearchBoardSnapshotsRepository(db)
  assert.throws(() => repo.create({
    sessionId: 'session-1',
    title: 'bad',
    payload: { title: 'bad' },
  }), /invalid snapshot payload/)
  db.close()
})
