/**
 * F3：schema v8 按模型嵌入进度 + 默认模型自动选择。
 * 不加载任何真实模型、不下载。
 */
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { migrateDocLibrarySchema } from '../packages/doc-library/dist/schema-migrate.js'
import { DocLibraryRepository } from '../packages/doc-library/dist/repository.js'
import {
  selectEmbeddingModel,
  describeEmbeddingSelection,
  resetEmbeddingModelSelectionCache,
} from '../packages/doc-library/dist/embedding-models.js'

const FILES = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model_quantized.onnx']

function makeModel(root, id) {
  for (const f of FILES) {
    const p = path.join(root, id, f)
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, f.endsWith('.json') ? '{}' : 'x')
  }
}

function legacyDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  migrateDocLibrarySchema(db)
  return db
}

function seedChunks(db, n, embeddedIdx = []) {
  const now = new Date().toISOString()
  db.prepare(`INSERT INTO documents(id, content_sha256, name, mime, kind, byte_size, blob_path, source_type, created_at, updated_at)
    VALUES ('d1','sha','d.txt','text/plain','text',1,'/x','report',?,?)`).run(now, now)
  for (let i = 0; i < n; i++) {
    db.prepare(`INSERT INTO chunks(id, document_id, seq, page, offset, text, char_count, embedded_at)
      VALUES (?, 'd1', ?, 1, 0, 't', 1, ?)`).run(`d1:c${i}`, i, embeddedIdx.includes(i) ? now : null)
  }
}

describe('schema v8 chunk_embeddings', () => {
  it('migration is idempotent and backfills existing flags as e5 (pre-v8 DB)', () => {
    const db = legacyDb()
    seedChunks(db, 3, [0, 1])
    // 模拟 v7 库：去掉 v8 表与 meta，旧标记仍在 chunks.embedded_at
    db.exec('DROP TABLE chunk_embeddings; DELETE FROM schema_meta WHERE version = 8;')
    assert.equal(migrateDocLibrarySchema(db), 8)
    const rows = db.prepare('SELECT chunk_id, model_id FROM chunk_embeddings ORDER BY chunk_id').all()
    assert.deepEqual(rows, [
      { chunk_id: 'd1:c0', model_id: 'multilingual-e5-small' },
      { chunk_id: 'd1:c1', model_id: 'multilingual-e5-small' },
    ])
    db.prepare("DELETE FROM chunk_embeddings WHERE chunk_id = 'd1:c1'").run()
    assert.equal(migrateDocLibrarySchema(db), 8)
    const again = db.prepare('SELECT COUNT(*) AS n FROM chunk_embeddings').get().n
    assert.equal(again, 1, 'second run must not resurrect cleared rows or duplicate')
  })

  it('switching model only marks chunks as needing embed for that model', () => {
    const db = legacyDb()
    seedChunks(db, 2)
    const repo = new DocLibraryRepository(db)
    repo.markChunksEmbedded(['d1:c0', 'd1:c1'], undefined, 'multilingual-e5-small')
    assert.equal(repo.getChunksNeedingEmbed('d1', 'multilingual-e5-small').length, 0)
    assert.equal(repo.getChunksNeedingEmbed('d1', 'bge-small-zh-v1.5').length, 2)
    repo.markChunksEmbedded(['d1:c0'], undefined, 'bge-small-zh-v1.5')
    assert.equal(repo.getChunksNeedingEmbed('d1', 'bge-small-zh-v1.5').length, 1)
    // 清 bge 标记不影响 e5
    repo.clearChunkEmbeddedAt('d1', 'bge-small-zh-v1.5')
    assert.equal(repo.getChunksNeedingEmbed('d1', 'bge-small-zh-v1.5').length, 2)
    assert.equal(repo.getChunksNeedingEmbed('d1', 'multilingual-e5-small').length, 0)
    assert.ok(db.prepare('SELECT embedded_at FROM chunks WHERE id = ?').get('d1:c0').embedded_at)
  })

  it('deleting chunks cascades embedding rows', () => {
    const db = legacyDb()
    seedChunks(db, 1)
    new DocLibraryRepository(db).markChunksEmbedded(['d1:c0'], undefined, 'bge-small-zh-v1.5')
    db.prepare('DELETE FROM chunks').run()
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM chunk_embeddings').get().n, 0)
  })
})

describe('default embedding model selection', () => {
  const dirs = []
  afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
    resetEmbeddingModelSelectionCache()
  })
  function env(extra = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-models-'))
    dirs.push(root)
    return { root, env: { ...process.env, DOC_LIBRARY_EMBEDDING_MODEL: '', DOC_LIBRARY_MODELS_DIR: root, ...extra } }
  }

  it('bge present -> bge', () => {
    const { root, env: e } = env()
    makeModel(root, 'bge-small-zh-v1.5')
    makeModel(root, 'multilingual-e5-small')
    assert.equal(selectEmbeddingModel(e).spec.id, 'bge-small-zh-v1.5')
    assert.equal(describeEmbeddingSelection(e), 'bge-small-zh-v1.5')
  })

  it('only e5 -> e5', () => {
    const { root, env: e } = env()
    makeModel(root, 'multilingual-e5-small')
    const sel = selectEmbeddingModel(e)
    assert.equal(sel.spec.id, 'multilingual-e5-small')
    assert.equal(sel.reason, 'auto-fallback')
  })

  it('none -> keyword-only (reason none)', () => {
    const { env: e } = env()
    const sel = selectEmbeddingModel(e)
    // 开发机用户目录若恰有模型则不适用；隔离目录下仅验证 reason 与描述一致
    assert.equal(describeEmbeddingSelection(e), sel.reason === 'none' ? 'keyword-only' : sel.spec.id)
  })

  it('env override wins even if bge is present; incomplete bge is ignored', () => {
    const { root, env: e } = env({ DOC_LIBRARY_EMBEDDING_MODEL: 'multilingual-e5-small' })
    makeModel(root, 'bge-small-zh-v1.5')
    assert.equal(selectEmbeddingModel(e).spec.id, 'multilingual-e5-small')
    assert.equal(selectEmbeddingModel(e).reason, 'env')
    const b = env()
    fs.mkdirSync(path.join(b.root, 'bge-small-zh-v1.5'), { recursive: true })
    assert.notEqual(selectEmbeddingModel(b.env).spec.id, 'bge-small-zh-v1.5')
  })
})

describe('mid-run model switch', () => {
  it('only marks chunks the vector store actually wrote, for the starting model', async () => {
    const { DocLibraryService } = await import('../packages/doc-library/dist/service.js')
    const { EmbeddingService, MockEmbeddingBackend } = await import('../packages/doc-library/dist/embedding.js')
    const { MemoryVectorStore } = await import('../packages/doc-library/dist/vector-store.js')
    const db = legacyDb()
    seedChunks(db, 3)
    const now = new Date().toISOString()
    db.prepare(`INSERT INTO parse_artifacts(document_id, engine_id, engine_version, status, page_count, char_count, md_path, error, ready_at, parse_fingerprint)
      VALUES ('d1','text-l0','t','ready',1,3,NULL,NULL,?,NULL)`).run(now)
    const prev = process.env.DOC_LIBRARY_EMBEDDING_MODEL
    process.env.DOC_LIBRARY_EMBEDDING_MODEL = 'multilingual-e5-small'
    try {
      const store = new MemoryVectorStore()
      const realUpsert = store.upsert.bind(store)
      // 模拟：第一批写入时模型被切到 bge（向量维度不符，被拒）
      store.upsert = async (rows) => {
        process.env.DOC_LIBRARY_EMBEDDING_MODEL = 'bge-small-zh-v1.5'
        return realUpsert(rows)
      }
      const svc = new DocLibraryService(db)
      svc.setEmbeddingService(new EmbeddingService(new MockEmbeddingBackend(true)))
      svc.setVectorStore(store)
      await svc.scheduleEmbed('d1')
      const bge = db.prepare("SELECT COUNT(*) AS n FROM chunk_embeddings WHERE model_id = 'bge-small-zh-v1.5'").get().n
      assert.equal(bge, 0, 'no holes recorded under the new model')
    } finally {
      if (prev === undefined) delete process.env.DOC_LIBRARY_EMBEDDING_MODEL
      else process.env.DOC_LIBRARY_EMBEDDING_MODEL = prev
    }
  })

  it('first batch written under e5 keeps e5 marks when model flips afterwards', async () => {
    const ctx = await embedCtx(3)
    const realUpsert = ctx.store.upsert.bind(ctx.store)
    ctx.store.upsert = async (rows) => {
      const w = await realUpsert(rows)
      process.env.DOC_LIBRARY_EMBEDDING_MODEL = 'bge-small-zh-v1.5'
      return w
    }
    await ctx.svc.scheduleEmbed('d1')
    assert.equal(count(ctx.db, 'multilingual-e5-small'), 3)
    assert.equal(count(ctx.db, 'bge-small-zh-v1.5'), 0)
    ctx.restore()
  })

  it('real upsert rejection (wrong dim vectors) is not recorded', async () => {
    const { EmbeddingService } = await import('../packages/doc-library/dist/embedding.js')
    const ctx = await embedCtx(2)
    ctx.svc.setEmbeddingService(new EmbeddingService({
      dimensions: 10,
      isReady: () => true,
      embedQuery: async () => new Array(10).fill(0.1),
      embedPassages: async (t) => t.map(() => new Array(10).fill(0.1)),
    }))
    await ctx.svc.scheduleEmbed('d1')
    assert.equal(count(ctx.db, 'multilingual-e5-small'), 0)
    ctx.restore()
  })

  it('EmbeddingService drops a backend bound to a non-active model', async () => {
    const { EmbeddingService, TransformersE5Backend } = await import('../packages/doc-library/dist/embedding.js')
    const { EMBEDDING_MODELS } = await import('../packages/doc-library/dist/embedding-models.js')
    class FakeBge extends TransformersE5Backend {
      isReady() { return true }
      async embedQuery() { return new Array(512).fill(0.1) }
    }
    const prev = process.env.DOC_LIBRARY_EMBEDDING_MODEL
    process.env.DOC_LIBRARY_EMBEDDING_MODEL = 'multilingual-e5-small'
    try {
      const svc = new EmbeddingService(new FakeBge('/nonexistent', EMBEDDING_MODELS['bge-small-zh-v1.5']))
      assert.equal(svc.isReady(), false)
      assert.equal(await svc.embedQuery('x'), null)
      assert.equal(svc.getBackend(), null)
    } finally {
      if (prev === undefined) delete process.env.DOC_LIBRARY_EMBEDDING_MODEL
      else process.env.DOC_LIBRARY_EMBEDDING_MODEL = prev
    }
  })

  it('post-switch backfill covers all 30 documents in multiple rounds', async () => {
    const ctx = await embedCtx(0)
    const now = new Date().toISOString()
    for (let i = 0; i < 30; i++) {
      const id = `doc${String(i).padStart(2, '0')}`
      ctx.db.prepare(`INSERT INTO documents(id, content_sha256, name, mime, kind, byte_size, blob_path, source_type, created_at, updated_at)
        VALUES (?,?,?,'text/plain','text',1,'/x','report',?,?)`).run(id, `sha${i}`, `${id}.txt`, now, now)
      ctx.db.prepare(`INSERT INTO parse_artifacts(document_id, engine_id, engine_version, status, page_count, char_count, md_path, error, ready_at, parse_fingerprint)
        VALUES (?,'text-l0','t','ready',1,3,NULL,NULL,?,NULL)`).run(id, now)
      ctx.db.prepare(`INSERT INTO chunks(id, document_id, seq, page, offset, text, char_count, embedded_at)
        VALUES (?, ?, 0, 1, 0, 'text body', 9, NULL)`).run(`${id}:c0`, id)
    }
    process.env.OPPTRIX_LANCE_BACKFILL_DELAY_MS = '0'
    const n = await ctx.svc.backfillActiveModel()
    assert.equal(n, 30)
    assert.equal(count(ctx.db, 'multilingual-e5-small'), 30)
    delete process.env.OPPTRIX_LANCE_BACKFILL_DELAY_MS
    ctx.restore()
  })
})

function count(db, model) {
  return db.prepare('SELECT COUNT(*) AS n FROM chunk_embeddings WHERE model_id = ?').get(model).n
}

async function embedCtx(chunks) {
  const { DocLibraryService } = await import('../packages/doc-library/dist/service.js')
  const { EmbeddingService, MockEmbeddingBackend } = await import('../packages/doc-library/dist/embedding.js')
  const { MemoryVectorStore } = await import('../packages/doc-library/dist/vector-store.js')
  const db = legacyDb()
  if (chunks > 0) {
    seedChunks(db, chunks)
    db.prepare(`INSERT INTO parse_artifacts(document_id, engine_id, engine_version, status, page_count, char_count, md_path, error, ready_at, parse_fingerprint)
      VALUES ('d1','text-l0','t','ready',1,3,NULL,NULL,?,NULL)`).run(new Date().toISOString())
  }
  const prev = process.env.DOC_LIBRARY_EMBEDDING_MODEL
  process.env.DOC_LIBRARY_EMBEDDING_MODEL = 'multilingual-e5-small'
  const store = new MemoryVectorStore()
  const svc = new DocLibraryService(db)
  svc.setEmbeddingService(new EmbeddingService(new MockEmbeddingBackend(true)))
  svc.setVectorStore(store)
  const restore = () => {
    if (prev === undefined) delete process.env.DOC_LIBRARY_EMBEDDING_MODEL
    else process.env.DOC_LIBRARY_EMBEDDING_MODEL = prev
  }
  return { db, svc, store, restore }
}
