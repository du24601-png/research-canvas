import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openDocLibraryDb, replaceFtsForDocument, searchFtsChunks } from '../packages/doc-library/dist/index.js'
import { buildNaturalGrams, naturalMatchExpr } from '../packages/doc-library/dist/fts-natural.js'
import { searchHybridDetailed } from '../packages/doc-library/dist/hybrid-search.js'
import { MemoryVectorStore } from '../packages/doc-library/dist/vector-store.js'
import { DOCUMENT_CITATION_RULE } from '../packages/agent/dist/system-prompt.js'
import { NOT_FOUND_HINT } from '../packages/agent/dist/document-tools.js'

function insertDoc(db, id, texts) {
  const now = new Date().toISOString()
  db.prepare(`INSERT INTO documents(id, content_sha256, name, mime, kind, byte_size, blob_path,
    source_type, external_id, created_at, updated_at) VALUES (?, ?, ?, 'text/plain', 'text', 10, '/t', 'report', NULL, ?, ?)`)
    .run(id, `sha-${id}`, `${id}.txt`, now, now)
  db.prepare(`INSERT INTO parse_artifacts(document_id, engine_id, engine_version, status, page_count,
    char_count, md_path, error, ready_at, parse_fingerprint) VALUES (?, 'text-l0', 't', 'ready', ?, 0, NULL, NULL, ?, NULL)`)
    .run(id, texts.length, now)
  const rows = texts.map((text, seq) => ({
    id: `${id}:c${seq}`, document_id: id, seq, page: seq + 1, offset: 0, text, char_count: text.length, embedded_at: null,
  }))
  for (const r of rows) {
    db.prepare('INSERT INTO chunks(id, document_id, seq, page, offset, text, char_count, embedded_at) VALUES (?, ?, ?, ?, 0, ?, ?, NULL)')
      .run(r.id, id, r.seq, r.page, r.text, r.char_count)
  }
  db.prepare('INSERT INTO session_documents(session_id, document_id, attachment_id, linked_at) VALUES (?, ?, NULL, ?)').run('s1', id, now)
  replaceFtsForDocument(db, id, rows)
}

const HIT = '本年度管理层认为毛利率下降主要由于原材料价格上涨及产品结构调整所致。'
const NOISE = '公司董事会审议通过了利润分配预案，拟每十股派发现金红利。'

describe('natural-question keyword search', () => {
  let dir = ''; let db
  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opptrix-doclib-nat-'))
    process.env.OPPTRIX_DATA_DIR = dir
    db = openDocLibraryDb(path.join(dir, 'n.db'))
    insertDoc(db, 'd1', [NOISE, HIT])
  })
  after(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); delete process.env.OPPTRIX_DATA_DIR })

  it('builds deduped 3-char grams without stop words, capped', () => {
    const g = buildNaturalGrams(['管理层怎么解释毛利率下降'])
    assert.deepEqual(g, ['管理层', '解释毛', '释毛利', '毛利率', '利率下', '率下降'])
    assert.ok(buildNaturalGrams(['甲乙丙丁戊己庚辛壬癸'.repeat(10)]).length <= 24)
    assert.match(naturalMatchExpr(['毛利率', '利率下']), /^"毛利率" OR "利率下"$/)
  })

  it('natural question hits the right chunk; short keyword path unchanged', () => {
    const hits = searchFtsChunks(db, '管理层怎么解释毛利率下降', { sessionId: 's1', limit: 5 })
    assert.equal(hits[0]?.chunk_id, 'd1:c1')
    assert.equal(searchFtsChunks(db, '毛利率下降', { sessionId: 's1' })[0]?.chunk_id, 'd1:c1')
  })

  it('keeps finance terms intact: single-char stop words only stripped at segment edges', () => {
    assert.ok(buildNaturalGrams(['公司在建工程余额是多少']).includes('在建工'))
    assert.ok(buildNaturalGrams(['所有者权益合计为何变动']).includes('所有者'))
    assert.ok(buildNaturalGrams(['母公司净利润是多少']).includes('母公司'))
  })

  it('common finance grams alone do not make an unanswerable question a hit', () => {
    const db2 = openDocLibraryDb(path.join(dir, 'common.db'))
    insertDoc(db2, 'c1', Array.from({ length: 5 }, (_, i) => `报告期内公司营业收入同比增长，净利润保持稳定，第${i}段。`))
    const q = '报告期内碳排放目标是什么'
    assert.equal(searchFtsChunks(db2, q, { sessionId: 's1' }).length, 0)
    const emb = { isReady: () => false, tryEnableDefaultBackend: async () => false }
    return searchHybridDetailed(db2, q, { sessionId: 's1', embedding: emb, vectorStore: new MemoryVectorStore() })
      .then(r => { assert.equal(r.found, false); db2.close() })
  })

  it('natural hits are labelled', () => {
    const h = searchFtsChunks(db, '管理层怎么解释毛利率下降', { sessionId: 's1' })
    assert.equal(h[0].match, 'natural')
  })

  it('unrelated natural question returns nothing', () => {
    assert.equal(searchFtsChunks(db, '请问这家企业的碳排放目标是什么呢', { sessionId: 's1' }).length, 0)
  })

  describe('relevance floor', () => {
    const stubEmb = { isReady: () => true, tryEnableDefaultBackend: async () => true, embedQuery: async () => [1, 0] }
    function store(hits) {
      const s = new MemoryVectorStore()
      s.isAvailable = async () => true
      s.search = async () => hits
      return s
    }
    const base = { sessionId: 's1', embedding: stubEmb, modelId: 'bge-small-zh-v1.5', limit: 5 }
    const vh = (id, score) => ({ chunk_id: id, document_id: 'd1', text: '', score })

    it('drops low-similarity vector-only hits and reports found:false', async () => {
      const r = await searchHybridDetailed(db, '完全无关的查询词汇', { ...base, vectorStore: store([vh('d1:c0', 0.2)]) })
      assert.equal(r.found, false)
      assert.equal(r.reason, 'below_relevance_floor')
      assert.equal(r.hits.length, 0)
    })

    it('filters the zero-vector placeholder row', async () => {
      const r = await searchHybridDetailed(db, '完全无关的查询词汇', { ...base, vectorStore: store([vh('__init__', 0.99)]) })
      assert.equal(r.found, false)
    })

    it('keeps vector hits above the floor', async () => {
      const r = await searchHybridDetailed(db, '完全无关的查询词汇', { ...base, vectorStore: store([vh('d1:c0', 0.7)]) })
      assert.equal(r.found, true)
      assert.equal(r.hits[0].chunk_id, 'd1:c0')
    })

    it('keeps keyword hits even when their vector score is below the floor', async () => {
      const r = await searchHybridDetailed(db, '毛利率下降', { ...base, vectorStore: store([vh('d1:c1', 0.1), vh('d1:c0', 0.1)]) })
      assert.equal(r.found, true)
      assert.deepEqual(r.hits.map(h => h.chunk_id), ['d1:c1'])
    })

    it('no vector backend and no keyword hit -> no_match', async () => {
      const r = await searchHybridDetailed(db, '完全无关的查询词汇', {
        ...base, embedding: { ...stubEmb, isReady: () => false, tryEnableDefaultBackend: async () => false },
        vectorStore: store([]),
      })
      assert.deepEqual([r.found, r.reason], [false, 'no_match'])
    })
  })
})

describe('agent side', () => {
  it('prompt rule covers nothing-found and per-company search', () => {
    assert.match(DOCUMENT_CITATION_RULE, /found=false/)
    assert.match(DOCUMENT_CITATION_RULE, /不要凭记忆/)
    assert.match(DOCUMENT_CITATION_RULE, /分别检索/)
  })
  it('exports a Chinese not-found hint', () => {
    assert.match(NOT_FOUND_HINT, /未找到|似乎没有/)
  })
})
