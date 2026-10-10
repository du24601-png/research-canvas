/**
 * 文档页码引用：工具结果附带现成的 markdown 链接，模型原样抄进回答。
 * 格式（与 client-ui/src/chat/doc-citation/docCitationLink.ts 保持一致）：
 *   [《文件名》第 37 页](opptrix-doc://a/<attachment_id>?page=37)   本会话附件，可直接打开
 *   [《文件名》第 37 页](opptrix-doc://d/<document_id>?page=37)     资料库文档（未链到本会话）
 */
export const DOC_CITE_SCHEME = 'opptrix-doc'

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/
export const DOC_CITE_PAGE_PLACEHOLDER = '{page}'

export interface DocCiteRef {
  attachmentId?: string | null
  documentId?: string | null
}

/** 链接文字里的文件名：去扩展名与会破坏 markdown 链接的字符 */
export function docCiteDisplayName(name: string | null | undefined): string {
  const base = String(name ?? '').replace(/\.[A-Za-z0-9]{1,5}$/, '')
  const cleaned = base.replace(/[[\]()《》\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
  return (cleaned || '文件').slice(0, 60)
}

function citeTarget(ref: DocCiteRef): string | null {
  const att = ref.attachmentId?.trim()
  if (att && ID_RE.test(att)) return `a/${att}`
  const doc = ref.documentId?.trim()
  if (doc && ID_RE.test(doc)) return `d/${doc}`
  return null
}

function buildCite(name: string | null | undefined, ref: DocCiteRef, page: string): string | undefined {
  const target = citeTarget(ref)
  if (!target) return undefined
  return `[《${docCiteDisplayName(name)}》第 ${page} 页](${DOC_CITE_SCHEME}://${target}?page=${page})`
}

/** 单页引用；页码非法或无可用 id 时返回 undefined */
export function docCiteMarkdown(
  name: string | null | undefined,
  ref: DocCiteRef,
  page: number | null | undefined,
): string | undefined {
  const n = Number(page)
  if (!Number.isInteger(n) || n < 1) return undefined
  return buildCite(name, ref, String(n))
}

/** 多页内容的引用模板：模型把 {page} 换成正文 `<!-- page:N -->` 标出的页码 */
export function docCiteTemplate(name: string | null | undefined, ref: DocCiteRef): string | undefined {
  return buildCite(name, ref, DOC_CITE_PAGE_PLACEHOLDER)
}
