const SHELF_EXT = new Set([
  '.pdf', '.doc', '.docx', '.ppt', '.pptx',
  '.txt', '.md', '.markdown', '.csv', '.log',
])

export const LIBRARY_SHELF_ACCEPT = [...SHELF_EXT].join(',')

/** 拖入前的类型检查。空串表示可以加入。 */
export function libraryShelfFileError(file: { name: string; size: number }): string | null {
  const name = file.name.trim()
  if (!name || file.size <= 0) return '这份文件是空的，换一份再试'
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : ''
  if (!SHELF_EXT.has(ext)) return '请拖入 PDF、Word、PPT 或文本'
  return null
}
