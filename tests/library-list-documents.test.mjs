import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import Fastify from 'fastify'
import { getDocLibraryService } from '../packages/doc-library/dist/index.js'

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-list-'))
  const svc = getDocLibraryService(path.join(dir, 'doc.sqlite'))
  return svc.getRepository()
}
const row = (i, created, source = 'report') => ({
  id: `d${i}`, content_sha256: `sha${i}`, name: `年报${i}.pdf`, mime: 'application/pdf',
  kind: 'pdf', byte_size: 1, blob_path: `b${i}`, source_type: source, external_id: source === 'news' ? `n${i}` : null,
  created_at: created, updated_at: created,
})

test('listLibraryDocuments: newest first, excludes news, paginates', () => {
  const repo = setup()
  assert.deepEqual(repo.listLibraryDocuments(10, 0), { total: 0, items: [] })
  repo.insertDocument(row(0, '2026-01-01T00:00:00Z'))
  repo.insertDocument(row(1, '2026-01-03T00:00:00Z'))
  repo.insertDocument(row(2, '2026-01-02T00:00:00Z'))
  repo.insertDocument(row(3, '2026-01-04T00:00:00Z', 'news'))
  const all = repo.listLibraryDocuments(10, 0)
  assert.equal(all.total, 3)
  assert.deepEqual(all.items.map(d => d.id), ['d1', 'd2', 'd0'])
  assert.equal(repo.listLibraryDocuments(2, 2).items.length, 1)
})

test('GET /api/library/documents validates pagination', async () => {
  const { registerLibraryRoutes } = await import('../apps/server/dist/library-routes.js')
  const app = Fastify()
  registerLibraryRoutes(app)
  for (const q of ['limit=0', 'limit=101', 'limit=abc', 'offset=-1']) {
    const res = await app.inject({ method: 'GET', url: `/api/library/documents?${q}` })
    assert.equal(res.statusCode, 400, q)
  }
  await app.close()
})

test('POST /api/library/documents rejects pictures and empty files', async () => {
  const { registerLibraryRoutes } = await import('../apps/server/dist/library-routes.js')
  const app = Fastify()
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body)
  })
  registerLibraryRoutes(app)
  const picture = await app.inject({
    method: 'POST',
    url: '/api/library/documents',
    headers: {
      'content-type': 'application/octet-stream',
      'x-attachment-name': encodeURIComponent('照片.png'),
      'x-attachment-mime': 'image/png',
    },
    payload: Buffer.from('not-a-png'),
  })
  assert.equal(picture.statusCode, 400)
  const empty = await app.inject({
    method: 'POST',
    url: '/api/library/documents',
    headers: {
      'content-type': 'application/octet-stream',
      'x-attachment-name': encodeURIComponent('空.txt'),
      'x-attachment-mime': 'text/plain',
    },
    payload: Buffer.alloc(0),
  })
  assert.equal(empty.statusCode, 400)
  const badId = await app.inject({ method: 'DELETE', url: '/api/library/documents/not%20safe' })
  assert.equal(badId.statusCode, 400)
  await app.close()
})
