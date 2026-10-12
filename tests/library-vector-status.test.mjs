import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { openDocLibraryDb } from '../packages/doc-library/dist/index.js'
import { computeLibraryVectorStatus } from '../packages/doc-library/dist/library-vector-status.js'

const MODEL = 'bge-small-zh-v1.5'

function seed() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-vec-'))
  const db = openDocLibraryDb(path.join(dir, 'doc.sqlite'))
  const now = '2026-01-01T00:00:00Z'
  for (const id of ['full', 'half', 'none']) {
    db.prepare(`INSERT INTO documents (id, content_sha256, name, mime, kind, byte_size, blob_path, created_at, updated_at)
      VALUES (?, ?, ?, 'text/plain', 'text', 1, 'b', ?, ?)`).run(id, `sha-${id}`, `${id}.txt`, now, now)
    for (const n of [0, 1]) {
      db.prepare(`INSERT INTO chunks (id, document_id, seq, page, offset, text, char_count)
        VALUES (?, ?, ?, 1, 0, 'x', 1)`).run(`${id}-${n}`, id, n)
    }
  }
  const mark = db.prepare('INSERT INTO chunk_embeddings (chunk_id, model_id, embedded_at) VALUES (?, ?, ?)')
  mark.run('full-0', MODEL, now)
  mark.run('full-1', MODEL, now)
  mark.run('half-0', MODEL, now)
  mark.run('none-0', 'multilingual-e5-small', now)
  return db
}

const docs = [
  { id: 'full', status: 'ready' },
  { id: 'half', status: 'ready' },
  { id: 'none', status: 'ready' },
  { id: 'parsing', status: 'pending' },
]

test('vector status per document follows the active model', () => {
  const db = seed()
  const out = computeLibraryVectorStatus(db, docs, { modelId: MODEL, modelInstalled: true })
  assert.equal(out.get('full'), 'ready')
  assert.equal(out.get('half'), 'indexing')
  assert.equal(out.get('none'), 'indexing', 'vectors from another model do not count')
  assert.equal(out.get('parsing'), 'off')
  db.close()
})

test('no local model means no loading state', () => {
  const db = seed()
  const out = computeLibraryVectorStatus(db, docs, { modelId: MODEL, modelInstalled: false })
  assert.deepEqual([...out.values()], ['off', 'off', 'off', 'off'])
  db.close()
})
