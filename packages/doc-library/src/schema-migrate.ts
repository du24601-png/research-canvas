import type Database from 'better-sqlite3'
import {
  DOC_LIBRARY_SCHEMA_VERSION,
  MIGRATION_V1_SQL,
  MIGRATION_V2_SQL,
  MIGRATION_V3_SQL,
  MIGRATION_V4_SQL,
  MIGRATION_V5_SQL,
  MIGRATION_V6_SQL,
  MIGRATION_V7_SQL,
  MIGRATION_V8_SQL,
} from './schema.js'
import { DEFAULT_EMBEDDING_MODEL_ID, EMBEDDING_MODELS } from './embedding-models.js'
import { scheduleTrigramBackfill } from './fts-trigram.js'

export interface SchemaMigrationStep {
  version: number
  description: string
  isApplied: (db: Database.Database) => boolean
  up: (db: Database.Database) => void
}

export class DocLibrarySchemaMigrationError extends Error {
  readonly schemaVersion: number

  constructor(schemaVersion: number, message: string) {
    super(`doc-library schema v${schemaVersion}: ${message}`)
    this.name = 'DocLibrarySchemaMigrationError'
    this.schemaVersion = schemaVersion
  }
}

function tableExists(db: Database.Database, name: string): boolean {
  return Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).get(name))
}

function ftsTableExists(db: Database.Database): boolean {
  return Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'fts_chunks'",
  ).get())
}

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return cols.some(c => c.name === column)
}

/** schema_meta 中记录的最高版本（声明版本） */
function readDeclaredSchemaVersion(db: Database.Database): number {
  if (!tableExists(db, 'schema_meta')) return 0
  const row = db.prepare('SELECT MAX(version) AS v FROM schema_meta').get() as {
    v: number | null
  } | undefined
  return row?.v ?? 0
}

function isV1Applied(db: Database.Database): boolean {
  return tableExists(db, 'documents')
    && tableExists(db, 'parse_artifacts')
    && tableExists(db, 'chunks')
    && tableExists(db, 'session_documents')
    && ftsTableExists(db)
}

function isV2Applied(db: Database.Database): boolean {
  return isV1Applied(db) && columnExists(db, 'chunks', 'embedded_at')
}

/** v3：仅要求来源列；不再依赖关联图表（图表由 v5 DROP） */
function isV3Applied(db: Database.Database): boolean {
  return isV2Applied(db)
    && columnExists(db, 'documents', 'source_type')
    && columnExists(db, 'documents', 'external_id')
}

/**
 * v4：曾落地社区表 / llm_graph_at，或已声明 ≥4。
 * v6 去掉列后仍须判定为已应用（依赖声明版本），避免回退重建。
 */
function isV4Applied(db: Database.Database): boolean {
  if (!isV3Applied(db)) return false
  return columnExists(db, 'documents', 'llm_graph_at')
    || readDeclaredSchemaVersion(db) >= 4
    || tableExists(db, 'graph_communities')
}

function anyGraphTableExists(db: Database.Database): boolean {
  return tableExists(db, 'entities')
    || tableExists(db, 'edges')
    || tableExists(db, 'graph_jobs')
    || tableExists(db, 'graph_communities')
    || tableExists(db, 'graph_community_members')
    || tableExists(db, 'graph_community_documents')
}

/**
 * v5：关联图六表已全部移除。
 * 声明 ≥5 或（v4 已应用且无图表）均可；避免丢 meta 后因无 llm_graph_at 误判未应用。
 */
function isV5Applied(db: Database.Database): boolean {
  if (!isV3Applied(db) || anyGraphTableExists(db)) return false
  return readDeclaredSchemaVersion(db) >= 5 || isV4Applied(db)
}

/** v6：documents.llm_graph_at 已去掉 */
function isV6Applied(db: Database.Database): boolean {
  return isV5Applied(db) && !columnExists(db, 'documents', 'llm_graph_at')
}

/** v7：trigram FTS 表与回填进度表均存在 */
function isV7Applied(db: Database.Database): boolean {
  return isV6Applied(db)
    && tableExists(db, 'fts_chunks_tri')
    && tableExists(db, 'fts_tri_backfill')
}

/** 升级前生效的模型：仅 env 可选（自动选择是 v8 之后才有），否则 e5 */
function legacyEmbeddingModelId(): string {
  const wanted = process.env.DOC_LIBRARY_EMBEDDING_MODEL?.trim()
  return wanted && EMBEDDING_MODELS[wanted] ? wanted : DEFAULT_EMBEDDING_MODEL_ID
}

/** v8：chunk_embeddings（按模型的向量化进度）存在 */
function isV8Applied(db: Database.Database): boolean {
  return isV7Applied(db) && tableExists(db, 'chunk_embeddings')
}

/** 优先 DROP COLUMN；SQLite 过旧或不支持时重建 documents 表 */
function dropLlmGraphAtColumn(db: Database.Database): void {
  if (!columnExists(db, 'documents', 'llm_graph_at')) return

  try {
    db.exec(MIGRATION_V6_SQL)
    if (!columnExists(db, 'documents', 'llm_graph_at')) return
  } catch {
    /* fall through to table rebuild */
  }

  const fkWasOn = (db.pragma('foreign_keys', { simple: true }) as number) === 1
  db.pragma('foreign_keys = OFF')
  try {
    db.exec(`
      CREATE TABLE documents__v6 (
        id TEXT NOT NULL PRIMARY KEY,
        content_sha256 TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        mime TEXT NOT NULL,
        kind TEXT NOT NULL,
        byte_size INTEGER NOT NULL,
        blob_path TEXT NOT NULL,
        source_type TEXT NOT NULL DEFAULT 'report',
        external_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO documents__v6(
        id, content_sha256, name, mime, kind, byte_size, blob_path,
        source_type, external_id, created_at, updated_at
      )
      SELECT
        id, content_sha256, name, mime, kind, byte_size, blob_path,
        COALESCE(source_type, 'report'), external_id, created_at, updated_at
      FROM documents;
      DROP TABLE documents;
      ALTER TABLE documents__v6 RENAME TO documents;
      CREATE INDEX IF NOT EXISTS idx_documents_sha ON documents(content_sha256);
    `)
  } finally {
    if (fkWasOn) db.pragma('foreign_keys = ON')
  }
}

export const MIGRATION_STEPS: SchemaMigrationStep[] = [
  {
    version: 1,
    description: 'documents / parse_artifacts / chunks / session_documents / fts_chunks',
    isApplied: isV1Applied,
    up(db) {
      db.exec(MIGRATION_V1_SQL)
    },
  },
  {
    version: 2,
    description: 'chunks.embedded_at for vector index idempotency',
    isApplied: isV2Applied,
    up(db) {
      if (!columnExists(db, 'chunks', 'embedded_at')) {
        db.exec(MIGRATION_V2_SQL)
      }
    },
  },
  {
    version: 3,
    description: 'documents.source_type / external_id',
    isApplied: isV3Applied,
    up(db) {
      if (!columnExists(db, 'documents', 'source_type')) {
        db.exec(`ALTER TABLE documents ADD COLUMN source_type TEXT NOT NULL DEFAULT 'report'`)
      }
      if (!columnExists(db, 'documents', 'external_id')) {
        db.exec(`ALTER TABLE documents ADD COLUMN external_id TEXT`)
      }
      void MIGRATION_V3_SQL
    },
  },
  {
    version: 4,
    description: 'documents.llm_graph_at (legacy; removed in v6)',
    isApplied: isV4Applied,
    up(db) {
      // 跃迁路径仍短暂添加该列，随后由 v6 去掉；已声明 ≥4 或已无列则跳过
      if (
        !columnExists(db, 'documents', 'llm_graph_at')
        && readDeclaredSchemaVersion(db) < 6
      ) {
        db.exec(`ALTER TABLE documents ADD COLUMN llm_graph_at TEXT`)
      }
      void MIGRATION_V4_SQL
    },
  },
  {
    version: 5,
    description: 'DROP association graph tables (entities/edges/jobs/communities)',
    isApplied: isV5Applied,
    up(db) {
      db.exec(MIGRATION_V5_SQL)
    },
  },
  {
    version: 6,
    description: 'DROP documents.llm_graph_at',
    isApplied: isV6Applied,
    up(db) {
      dropLlmGraphAtColumn(db)
    },
  },
  {
    version: 7,
    description: 'fts_chunks_tri (trigram, CJK keyword search) + fts_tri_backfill progress',
    isApplied: isV7Applied,
    up(db) {
      db.exec(MIGRATION_V7_SQL)
    },
  },
  {
    version: 8,
    description: 'chunk_embeddings (per-model embedding progress), backfilled from chunks.embedded_at as e5',
    isApplied: isV8Applied,
    up(db) {
      // 建表与回填同一事务：中途失败不留下「表在、数据缺」的半成品
      db.transaction(() => db.exec(MIGRATION_V8_SQL(legacyEmbeddingModelId())))()
    },
  },
]

if (MIGRATION_STEPS.length !== DOC_LIBRARY_SCHEMA_VERSION) {
  throw new Error(
    `MIGRATION_STEPS (${MIGRATION_STEPS.length}) must match DOC_LIBRARY_SCHEMA_VERSION (${DOC_LIBRARY_SCHEMA_VERSION})`,
  )
}

export function detectAppliedSchemaVersion(db: Database.Database): number {
  let applied = 0
  for (const step of MIGRATION_STEPS) {
    if (!step.isApplied(db)) break
    applied = step.version
  }
  return applied
}

export function migrateDocLibrarySchema(db: Database.Database): number {
  for (const step of MIGRATION_STEPS) {
    if (!step.isApplied(db)) {
      step.up(db)
      if (!step.isApplied(db)) {
        throw new DocLibrarySchemaMigrationError(step.version, `migration failed: ${step.description}`)
      }
    }
    db.prepare(`
      INSERT INTO schema_meta(version, applied_at) VALUES(?, ?)
      ON CONFLICT(version) DO UPDATE SET applied_at = excluded.applied_at
    `).run(step.version, new Date().toISOString())
  }
  // 既有 chunks → trigram 索引：首片同步、余下后台分批，失败写入 fts_tri_backfill.last_error
  scheduleTrigramBackfill(db)
  return detectAppliedSchemaVersion(db)
}
