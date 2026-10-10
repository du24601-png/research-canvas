import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  DocLibraryRepository,
  DOC_LIBRARY_SCHEMA_VERSION,
  detectAppliedSchemaVersion,
  migrateDocLibrarySchema,
  openDocLibraryDb,
  replaceFtsForDocument,
  searchFtsChunks,
} from '../packages/doc-library/dist/index.js'
import { searchCjkChunks } from '../packages/doc-library/dist/fts-cjk.js'
import {
  backfillTrigramFts,
  isTrigramBackfillDone,
  readTrigramBackfillState,
  runTrigramBackfillBatch,
} from '../packages/doc-library/dist/fts-trigram.js'

const CN_TEXT = '公司2023年毛利率下降至35%，归母净利润同比增长12%，营收达到100亿元，研发投入持续加大。'

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'opptrix-doclib-tri-'))
}

/** 写入一份 ready 文档（documents / parse_artifacts / chunks / session_documents），可选写 FTS */
function insertDoc(db, { id, sessionId, attachmentId = null, sourceType = 'report', texts, writeFts = true }) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO documents(id, content_sha256, name, mime, kind, byte_size, blob_path,
      source_type, external_id, created_at, updated_at)
    VALUES (?, ?, ?, 'text/plain', 'text', 10, '/t', ?, NULL, ?, ?)
  `).run(id, `sha-${id}`, `${id}.txt`, sourceType, now, now)
  db.prepare(`
    INSERT INTO parse_artifacts(document_id, engine_id, engine_version, status, page_count,
      char_count, md_path, error, ready_at, parse_fingerprint)
    VALUES (?, 'text-l0', 't', 'ready', ?, 0, NULL, NULL, ?, NULL)
  `).run(id, texts.length, now)
  const rows = texts.map((text, seq) => ({
    id: `${id}:c${seq}`, document_id: id, seq, page: seq + 1, offset: 0, text,
    char_count: text.length, embedded_at: null,
  }))
  for (const r of rows) {
    db.prepare(`
      INSERT INTO chunks(id, document_id, seq, page, offset, text, char_count, embedded_at)
      VALUES (?, ?, ?, ?, 0, ?, ?, NULL)
    `).run(r.id, id, r.seq, r.page, r.text, r.char_count)
  }
  if (sessionId) {
    db.prepare(`
      INSERT INTO session_documents(session_id, document_id, attachment_id, linked_at)
      VALUES (?, ?, ?, ?)
    `).run(sessionId, id, attachmentId, now)
  }
  if (writeFts) replaceFtsForDocument(db, id, rows)
}

function triCount(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM fts_chunks_tri').get().n
}

/** 模拟 v6 旧库：只有 unicode61 fts_chunks */
function downgradeToV6(db) {
  db.exec('DROP TABLE fts_chunks_tri; DROP TABLE fts_tri_backfill; DELETE FROM schema_meta WHERE version >= 7')
}

describe('doc-library trigram FTS migration + backfill', () => {
  let dir = ''
  before(() => {
    dir = tmpDir()
    process.env.OPPTRIX_DATA_DIR = dir
  })
  after(() => {
    fs.rmSync(dir, { recursive: true, force: true })
    delete process.env.OPPTRIX_DATA_DIR
  })

  it('schema version is 7 with fts_chunks kept', () => {
    const db = openDocLibraryDb(path.join(dir, 'fresh.db'))
    assert.equal(DOC_LIBRARY_SCHEMA_VERSION, 7)
    assert.equal(detectAppliedSchemaVersion(db), 7)
    const names = db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'fts_chunks%'").all().map(r => r.name)
    assert.ok(names.includes('fts_chunks'))
    assert.ok(names.includes('fts_chunks_tri'))
    assert.ok(isTrigramBackfillDone(db))
    db.close()
  })

  it('migrates an old-only-fts DB idempotently and backfills existing chunks', () => {
    const dbPath = path.join(dir, 'legacy.db')
    const db1 = openDocLibraryDb(dbPath)
    downgradeToV6(db1)
    insertDoc(db1, { id: 'old-a', sessionId: 's1', texts: [CN_TEXT, '第二页 风险提示'] })
    insertDoc(db1, { id: 'old-b', sessionId: 's1', texts: ['英文 ALPHA segment'] })
    assert.equal(detectAppliedSchemaVersion(db1), 6)
    db1.close()

    const db = openDocLibraryDb(dbPath)
    assert.equal(detectAppliedSchemaVersion(db), 7)
    assert.equal(triCount(db), 3)
    assert.ok(readTrigramBackfillState(db)?.doneAt)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fts_chunks').get().n, 3, 'old fts kept')
    migrateDocLibrarySchema(db)
    migrateDocLibrarySchema(db)
    assert.equal(detectAppliedSchemaVersion(db), 7)
    assert.equal(triCount(db), 3, 'no duplicate rows after re-migrate')
    const hits = searchFtsChunks(db, '毛利率', { sessionId: 's1' })
    assert.equal(hits.length, 1)
    assert.equal(hits[0].page, 1)
    db.close()
  })

  it('backfill is resumable in batches; search falls back while incomplete', () => {
    const db = openDocLibraryDb(path.join(dir, 'resume.db'))
    for (const id of ['r1', 'r2', 'r3']) insertDoc(db, { id, sessionId: 'sr', texts: [CN_TEXT] })
    db.exec("DELETE FROM fts_chunks_tri; UPDATE fts_tri_backfill SET cursor = '', done_at = NULL")
    assert.equal(isTrigramBackfillDone(db), false)
    assert.equal(searchFtsChunks(db, '归母净利润', { sessionId: 'sr' }).length, 3, 'instr fallback')

    assert.deepEqual(runTrigramBackfillBatch(db, 1), { documents: 1, done: false })
    assert.equal(readTrigramBackfillState(db)?.cursor, 'r1')
    assert.equal(triCount(db), 1)
    runTrigramBackfillBatch(db, 1)
    runTrigramBackfillBatch(db, 1)
    const last = runTrigramBackfillBatch(db, 1)
    assert.equal(last.done, true)
    assert.equal(triCount(db), 3)
    assert.deepEqual(runTrigramBackfillBatch(db, 1), { documents: 0, done: true })
    assert.equal(triCount(db), 3)
    db.close()
  })
})

describe('doc-library trigram backfill robustness', () => {
  let dir = ''
  before(() => {
    dir = tmpDir()
    process.env.OPPTRIX_DATA_DIR = dir
  })
  after(() => {
    fs.rmSync(dir, { recursive: true, force: true })
    delete process.env.OPPTRIX_DATA_DIR
  })

  it('failing backfill records last_error and keeps progress', () => {
    const db = openDocLibraryDb(path.join(dir, 'fail.db'))
    insertDoc(db, { id: 'f1', sessionId: 'sf', texts: [CN_TEXT] })
    db.exec("UPDATE fts_tri_backfill SET cursor = '', done_at = NULL")
    db.exec('ALTER TABLE chunks RENAME TO chunks_gone')
    assert.throws(() => backfillTrigramFts(db))
    const st = readTrigramBackfillState(db)
    assert.ok(st?.lastError && st.lastError.includes('chunks'), String(st?.lastError))
    assert.equal(st?.doneAt, null)
    assert.equal(st?.cursor, '')
    db.close()
  })

  it('during backfill: covered docs use MATCH, uncovered docs still found', () => {
    const db = openDocLibraryDb(path.join(dir, 'partial.db'))
    for (const id of ['p1', 'p2', 'p3']) insertDoc(db, { id, sessionId: 'sp', texts: [CN_TEXT] })
    // p1 已回填（游标），p2/p3 只在 chunks 中
    db.exec("DELETE FROM fts_chunks_tri WHERE document_id != 'p1'")
    db.exec("UPDATE fts_tri_backfill SET cursor = 'p1', done_at = NULL")
    const hits = searchFtsChunks(db, '归母净利润', { sessionId: 'sp' })
    assert.deepEqual(hits.map(h => h.document_id).sort(), ['p1', 'p2', 'p3'])
    assert.equal(hits[0].document_id, 'p1', 'trigram hits first')
    db.close()
  })
})

describe('doc-library CJK keyword search', () => {
  let dir = ''
  let db = null
  before(() => {
    dir = tmpDir()
    process.env.OPPTRIX_DATA_DIR = dir
    db = openDocLibraryDb(path.join(dir, 'search.db'))
    insertDoc(db, { id: 'cn-1', sessionId: 's1', attachmentId: 'att-1', texts: ['封面', CN_TEXT] })
    insertDoc(db, { id: 'cn-2', sessionId: 's2', attachmentId: 'att-2', sourceType: 'news', texts: ['行业毛利率普遍承压，营收增速放缓'] })
    insertDoc(db, { id: 'en-1', sessionId: 's1', attachmentId: 'att-3', texts: ['Gross margin ALPHATERM improved'] })
  })
  after(() => {
    db?.close()
    fs.rmSync(dir, { recursive: true, force: true })
    delete process.env.OPPTRIX_DATA_DIR
  })

  for (const term of ['毛利率', '归母净利润', '营收', '研发投入']) {
    it(`matches mid-sentence ${term}`, () => {
      const hits = searchFtsChunks(db, term, { sessionId: 's1' })
      assert.equal(hits.length, 1, term)
      assert.equal(hits[0].chunk_id, 'cn-1:c1')
      assert.equal(hits[0].page, 2)
      assert.equal(hits[0].attachment_id, 'att-1')
      assert.ok(hits[0].excerpt.includes(term), `${term} in excerpt: ${hits[0].excerpt}`)
      assert.equal(typeof hits[0].rank, 'number')
    })
  }

  it('multiple terms are AND-ed across trigram and short-term paths', () => {
    assert.equal(searchFtsChunks(db, '营收 毛利率', { sessionId: 's1' }).length, 1)
    assert.equal(searchFtsChunks(db, '毛利率 不存在的词', { sessionId: 's1' }).length, 0)
    assert.equal(searchFtsChunks(db, '营收 存货', { sessionId: 's1' }).length, 0)
  })

  it('quotes and * in a CJK query do not break search', () => {
    for (const q of ['"毛利率"', '毛利率*', '毛"利率', "'营收'", '营收* "研发投入"']) {
      const hits = searchFtsChunks(db, q, { sessionId: 's1' })
      assert.equal(hits.length, 1, q)
      assert.equal(hits[0].document_id, 'cn-1', q)
    }
  })

  it('short-term path is budgeted and ranked by occurrences', () => {
    const sid = 's-budget'
    insertDoc(db, { id: 'b-old', sessionId: sid, sourceType: 'news', texts: ['营收 营收 营收 营收'] })
    insertDoc(db, { id: 'b-mid', sessionId: sid, sourceType: 'news', texts: ['营收一次'] })
    insertDoc(db, { id: 'b-new1', sessionId: sid, sourceType: 'news', texts: ['营收两次，营收'] })
    insertDoc(db, { id: 'b-new2', sessionId: sid, sourceType: 'news', texts: ['今年营收'] })
    const all = searchCjkChunks(db, ['营收'], 10, { sessionId: sid })
    assert.deepEqual(all.map(h => h.document_id), ['b-old', 'b-new1', 'b-mid', 'b-new2'])
    assert.equal(all[0].rank, -4)
    // 仅扫描最新 2 个 chunk：最旧但次数最多的 b-old 不在预算内
    const budgeted = searchCjkChunks(db, ['营收'], 10, { sessionId: sid }, 2)
    assert.deepEqual(budgeted.map(h => h.document_id), ['b-new1', 'b-new2'])
    assert.equal(searchCjkChunks(db, ['营收'], 1, { sessionId: sid })[0].document_id, 'b-old')
  })

  it('English queries still use unicode61', () => {
    const hits = searchFtsChunks(db, 'ALPHATERM', { sessionId: 's1' })
    assert.equal(hits.length, 1)
    assert.equal(hits[0].document_id, 'en-1')
    assert.equal(searchFtsChunks(db, 'margin', { sessionId: 's1' }).length, 1)
  })

  it('respects session / document / attachment / library sourceType filters', () => {
    assert.equal(searchFtsChunks(db, '毛利率', { sessionId: 's2' })[0].document_id, 'cn-2')
    assert.equal(searchFtsChunks(db, '毛利率', { sessionId: 's1', attachmentId: 'att-3' }).length, 0)
    assert.equal(searchFtsChunks(db, '营收', { sessionId: 's1', documentId: 'en-1' }).length, 0)
    const lib = searchFtsChunks(db, '毛利率', { sessionId: '', scope: 'library' })
    assert.deepEqual(lib.map(h => h.document_id).sort(), ['cn-1', 'cn-2'])
    assert.ok(lib.every(h => h.attachment_id === null))
    const news = searchFtsChunks(db, '毛利率', { sessionId: '', scope: 'library', sourceType: 'news' })
    assert.deepEqual(news.map(h => h.document_id), ['cn-2'])
    const newsShort = searchFtsChunks(db, '营收', { sessionId: '', scope: 'library', sourceType: 'report' })
    assert.deepEqual(newsShort.map(h => h.document_id), ['cn-1'])
    db.prepare("UPDATE parse_artifacts SET status = 'pending' WHERE document_id = 'cn-2'").run()
    assert.deepEqual(
      searchFtsChunks(db, '毛利率', { sessionId: '', scope: 'library' }).map(h => h.document_id),
      ['cn-1'],
    )
  })

  it('new writes and deletes keep trigram table in sync', () => {
    replaceFtsForDocument(db, 'cn-1', [{ id: 'cn-1:c0', document_id: 'cn-1', text: '仅剩封面' }])
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM fts_chunks_tri WHERE document_id = 'cn-1'").get().n, 1)
    assert.ok(new DocLibraryRepository(db).deleteDocument('cn-2'))
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM fts_chunks_tri WHERE document_id = 'cn-2'").get().n, 0)
    assert.equal(searchFtsChunks(db, '毛利率', { sessionId: 's2' }).length, 0)
  })
})
