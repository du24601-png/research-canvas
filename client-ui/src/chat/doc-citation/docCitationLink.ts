/**
 * 文档页码引用链接（与 packages/agent/src/document-citation.ts 保持一致）：
 *   opptrix-doc://a/<attachment_id>?page=N   本会话附件
 *   opptrix-doc://d/<document_id>?page=N     资料库文档（按 documentId 匹配本会话附件）
 */
import type { ReactNode } from 'react'
import { defaultUrlTransform } from 'react-markdown'

export const OPPTRIX_DOC_SCHEME = 'opptrix-doc'

export type DocCitationTarget = {
  kind: 'attachment' | 'document'
  id: string
  page: number
}

const DOC_CITE_RE = /^opptrix-doc:\/\/([ad])\/([A-Za-z0-9_-]{1,128})\?page=([1-9][0-9]{0,4})$/
const MAX_LABEL_NAME = 24

export function isDocCitationHref(href: string | null | undefined): boolean {
  return typeof href === 'string' && href.trim().toLowerCase().startsWith(`${OPPTRIX_DOC_SCHEME}:`)
}

/** 严格解析；任何多余字符（额外参数、路径穿越、非法页码）都返回 null */
export function parseDocCitationHref(href: string | null | undefined): DocCitationTarget | null {
  if (typeof href !== 'string') return null
  const m = DOC_CITE_RE.exec(href.trim())
  if (!m) return null
  const [, kind, id, page] = m
  if (!kind || !id || !page) return null
  return { kind: kind === 'a' ? 'attachment' : 'document', id, page: Number(page) }
}

/** react-markdown urlTransform：合法 opptrix-doc 链接放行，非法的清空；其余走默认白名单 */
export function docCitationUrlTransform(url: string): string {
  if (isDocCitationHref(url)) return parseDocCitationHref(url) ? url.trim() : ''
  return defaultUrlTransform(url)
}

/** 「《年报》第 37 页」→「《年报》p.37」；文件名过长时截断 */
export function docCitationLabel(text: string, page: number): string {
  const m = /《([^》]+)》/.exec(text)
  const raw = (m?.[1] ?? '').trim()
  if (!raw) return `p.${page}`
  const name = raw.length > MAX_LABEL_NAME ? `${raw.slice(0, MAX_LABEL_NAME - 1)}…` : raw
  return `《${name}》p.${page}`
}

/** markdown 链接文字（react-markdown children）拼成纯文本 */
export function textOfChildren(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(textOfChildren).join('')
  return ''
}
