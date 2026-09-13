import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  isResearchBoardSnapshotId,
  sanitizeResearchBoardSnapshotPayload,
  type ResearchBoardSnapshotPayload,
} from '@opptrix/shared/research-board-snapshot'

export const RESEARCH_BOARD_SNAPSHOTS_MIGRATION_KEY = 'research_board_snapshots_v1'

export interface ResearchBoardSnapshotRecord {
  id: string
  sessionId: string
  title: string
  payload: ResearchBoardSnapshotPayload
  createdAt: string
}

export function initResearchBoardSnapshotsSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS research_board_snapshots (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      title TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_research_board_snapshots_session
      ON research_board_snapshots(session_id, created_at DESC);
  `)
}

export class ResearchBoardSnapshotsRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: {
    sessionId: string
    title: string
    payload: ResearchBoardSnapshotPayload
  }): ResearchBoardSnapshotRecord {
    const sessionId = input.sessionId.trim()
    if (!sessionId) throw new Error('session_id required')
    const payload = sanitizeResearchBoardSnapshotPayload(input.payload)
    if (!payload) throw new Error('invalid snapshot payload')
    const id = randomUUID()
    const createdAt = new Date().toISOString()
    const title = payload.title
    this.db.prepare(`
      INSERT INTO research_board_snapshots (id, session_id, title, payload_json, created_at)
      VALUES (@id, @sessionId, @title, @payloadJson, @createdAt)
    `).run({
      id,
      sessionId,
      title,
      payloadJson: JSON.stringify(payload),
      createdAt,
    })
    return { id, sessionId, title, payload, createdAt }
  }

  getById(id: string): ResearchBoardSnapshotRecord | null {
    if (!isResearchBoardSnapshotId(id)) return null
    const row = this.db.prepare(`
      SELECT id, session_id, title, payload_json, created_at
      FROM research_board_snapshots
      WHERE id = ?
    `).get(id.trim()) as {
      id: string
      session_id: string
      title: string
      payload_json: string
      created_at: string
    } | undefined
    if (!row) return null
    let parsed: unknown
    try {
      parsed = JSON.parse(row.payload_json)
    } catch {
      return null
    }
    const payload = sanitizeResearchBoardSnapshotPayload({
      ...(typeof parsed === 'object' && parsed ? parsed as Record<string, unknown> : {}),
      title: row.title,
    })
    if (!payload) return null
    return {
      id: row.id,
      sessionId: row.session_id,
      title: row.title,
      payload,
      createdAt: row.created_at,
    }
  }
}
