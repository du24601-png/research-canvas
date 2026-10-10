import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import Fastify from 'fastify'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-file-'))
process.env.OPPTRIX_DATA_DIR = dir

test('GET /api/library/documents/:id/file serves the stored original only', async () => {
  const lib = await import('../packages/doc-library/dist/index.js')
  lib.setVectorStoreForTests(new lib.MemoryVectorStore())
  lib.setEmbeddingServiceForTests(new lib.EmbeddingService(new lib.MockEmbeddingBackend(false)))
  const { registerLibraryRoutes } = await import('../apps/server/dist/library-routes.js')
  const repo = lib.getDocLibraryService().getRepository()
  const pdf = Buffer.from('%PDF-1.4 fake body')
  repo.insertDocument({
    id: 'docfile1', content_sha256: 'shafile1', name: '年报 2024.pdf', mime: 'application/pdf',
    kind: 'pdf', byte_size: pdf.length, blob_path: repo.writeBlob('shafile1', pdf),
  })
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>')
  repo.insertDocument({
    id: 'docsvg1', content_sha256: 'shasvg1', name: 'x.svg', mime: 'image/svg+xml',
    kind: 'image', byte_size: svg.length, blob_path: repo.writeBlob('shasvg1', svg),
  })
  repo.insertDocument({
    id: 'docgone', content_sha256: 'shagone', name: 'gone.pdf', mime: 'application/pdf',
    kind: 'pdf', byte_size: 1, blob_path: path.join(dir, 'missing.bin'),
  })

  const app = Fastify()
  registerLibraryRoutes(app)
  try {
    const ok = await app.inject({ method: 'GET', url: '/api/library/documents/docfile1/file' })
    assert.equal(ok.statusCode, 200)
    assert.equal(ok.headers['content-type'], 'application/pdf')
    assert.equal(ok.headers['x-content-type-options'], 'nosniff')
    assert.match(String(ok.headers['content-disposition']), /^inline; filename\*=UTF-8''/)
    assert.equal(ok.rawPayload.toString(), pdf.toString())

    const head = await app.inject({ method: 'HEAD', url: '/api/library/documents/docfile1/file' })
    assert.equal(head.statusCode, 200)
    assert.equal(head.headers['content-type'], 'application/pdf')

    const active = await app.inject({ method: 'GET', url: '/api/library/documents/docsvg1/file' })
    assert.equal(active.headers['content-type'], 'application/octet-stream')

    for (const url of [
      '/api/library/documents/unknown/file',
      '/api/library/documents/docgone/file',
      '/api/library/documents/..%2F..%2Fetc/file',
      `/api/library/documents/${'a'.repeat(129)}/file`,
      '/api/library/documents/bad%20id/file',
    ]) {
      const res = await app.inject({ method: 'GET', url })
      // 超长 id 可能先被路由层以 414 拒绝；两者都不返回文件
      assert.ok([404, 414].includes(res.statusCode), `${url} → ${res.statusCode}`)
    }
  } finally {
    await app.close()
  }
})

test.after(async () => {
  const lib = await import('../packages/doc-library/dist/index.js')
  await lib.closeDocLibraryService()
  lib.setVectorStoreForTests(null)
  lib.setEmbeddingServiceForTests(null)
  delete process.env.OPPTRIX_DATA_DIR
  try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* Windows 句柄延迟释放 */ }
})
