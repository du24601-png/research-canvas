/**
 * D1 文档页码引用：工具结果带 cite / cite_template；系统提示含引用与文档数字隔离规则。
 */
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

let dataDir = ''

describe('document citation helpers', () => {
  it('builds attachment / document links and rejects bad input', async () => {
    const { docCiteMarkdown, docCiteTemplate, docCiteDisplayName } =
      await import('../packages/agent/dist/document-citation.js')
    assert.equal(
      docCiteMarkdown('年报 2024.pdf', { attachmentId: 'att-1', documentId: 'doc-1' }, 37),
      '[《年报 2024》第 37 页](opptrix-doc://a/att-1?page=37)',
    )
    assert.equal(
      docCiteMarkdown('x.pdf', { documentId: 'doc_9' }, 2),
      '[《x》第 2 页](opptrix-doc://d/doc_9?page=2)',
    )
    assert.equal(docCiteMarkdown('x.pdf', { attachmentId: 'bad id/..' }, 2), undefined)
    assert.equal(docCiteMarkdown('x.pdf', { attachmentId: 'a1' }, 0), undefined)
    assert.equal(docCiteTemplate('x.pdf', { attachmentId: 'a1' }), '[《x》第 {page} 页](opptrix-doc://a/a1?page={page})')
    assert.equal(docCiteDisplayName('[危险](名)《书》.pdf'), '危险 名 书')
  })

  it('system prompt carries the citation + document-number rule', async () => {
    const { assembleSystemPrompt } = await import('../packages/agent/dist/system-prompt.js')
    const text = assembleSystemPrompt()
    assert.ok(text.includes('cite 链接原样抄写'))
    assert.ok(text.includes('不得传给 query_data / refine_dataset / propose_widget'))
  })
})

describe('document tools carry cite fields', { concurrency: false }, () => {
  before(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'opptrix-doc-cite-'))
    process.env.OPPTRIX_DATA_DIR = dataDir
    const { MemoryVectorStore, setVectorStoreForTests, setEmbeddingServiceForTests, EmbeddingService, MockEmbeddingBackend } =
      await import('../packages/doc-library/dist/index.js')
    setVectorStoreForTests(new MemoryVectorStore())
    setEmbeddingServiceForTests(new EmbeddingService(new MockEmbeddingBackend(false)))
  })

  after(async () => {
    try {
      const { closeDocLibraryService, setVectorStoreForTests, setEmbeddingServiceForTests } =
        await import('../packages/doc-library/dist/index.js')
      await closeDocLibraryService()
      setVectorStoreForTests(null)
      setEmbeddingServiceForTests(null)
    } catch { /* ignore */ }
    try {
      const { getUserDataStore } = await import('../packages/user-store/dist/index.js')
      getUserDataStore().close()
    } catch { /* ignore */ }
    if (dataDir) await rm(dataDir, { recursive: true, force: true }).catch(() => {})
    delete process.env.OPPTRIX_DATA_DIR
  })

  it('search_library / read_document return copyable cite links', async () => {
    const { buildDocumentTools } = await import('../packages/agent/dist/document-tools.js')
    const { runInToolSession } = await import('../packages/agent/dist/mcp/tool-session-context.js')
    const { getDocLibraryService } = await import('../packages/doc-library/dist/index.js')
    const svc = getDocLibraryService()
    const report = svc.ingestFromText({
      text: '研报正文提到 UNIQUECITE4471 评级上调，内容足够长用于入库校验与检索。',
      name: '引用测试研报.pdf',
      sourceType: 'report',
      externalId: 'report-ext-cite-1',
    })
    assert.ok(report)
    const tools = buildDocumentTools()
    const searchLibrary = tools.find(t => t.name === 'search_library')
    const readDocument = tools.find(t => t.name === 'read_document')
    assert.ok(searchLibrary && readDocument)

    const outside = await searchLibrary.handler({ query: 'UNIQUECITE4471', source_type: 'report' })
    const hitOutside = outside.hits.find(h => h.document_id === report.documentId)
    assert.ok(hitOutside, JSON.stringify(outside))
    assert.equal(hitOutside.cite, `[《引用测试研报》第 ${hitOutside.page} 页](opptrix-doc://d/${report.documentId}?page=${hitOutside.page})`)

    svc.linkSession('sess-cite-1', report.documentId, 'att-cite-1')
    const inside = await runInToolSession('sess-cite-1', () =>
      searchLibrary.handler({ query: 'UNIQUECITE4471', source_type: 'report' }))
    const hitInside = inside.hits.find(h => h.document_id === report.documentId)
    assert.ok(hitInside)
    assert.equal(hitInside.attachment_id, 'att-cite-1')
    assert.ok(hitInside.cite.includes('(opptrix-doc://a/att-cite-1?page='))

    const read = await runInToolSession('sess-cite-1', () =>
      readDocument.handler({ document_id: report.documentId, page_from: 1 }))
    assert.ok(!('error' in read), JSON.stringify(read))
    assert.equal(read.cite, '[《引用测试研报》第 1 页](opptrix-doc://a/att-cite-1?page=1)')

    const range = await runInToolSession('sess-cite-1', () =>
      readDocument.handler({ document_id: report.documentId, page_from: 1, page_to: 3 }))
    assert.equal(range.cite_template, '[《引用测试研报》第 {page} 页](opptrix-doc://a/att-cite-1?page={page})')
  })
})
