import type { LibraryDocStatus } from '../../api/library'

const KNOWN_EXT = /\.(pdf|docx|doc|txt|md|xlsx|xls|csv|pptx|ppt|html|htm)$/i

export function libraryStatusLabel(status: LibraryDocStatus): string {
  if (status === 'ready') return '已整理'
  if (status === 'failed') return '没能读出文字'
  return '整理中'
}

export function libraryDocMeta(pageCount: number | null, status: LibraryDocStatus, addedAt: string): string {
  const parts: string[] = []
  if (pageCount !== null && pageCount > 0) parts.push(`${pageCount} 页`)
  parts.push(libraryStatusLabel(status))
  const d = new Date(addedAt)
  if (!Number.isNaN(d.getTime())) {
    parts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  return parts.join(' · ')
}

/** 点击资料后插入输入框的引用文字 */
export function libraryReferenceText(name: string): string {
  const title = name.replace(KNOWN_EXT, '')
  return `根据《${title}》，`
}
