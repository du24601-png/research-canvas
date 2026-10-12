import type { ReactElement } from 'react'
import {
  DocumentDataRegular,
  DocumentPdfRegular,
  DocumentRegular,
  DocumentTextRegular,
  ImageRegular,
  SlideTextRegular,
} from '@fluentui/react-icons'

export type LibraryDocIconKind = 'pdf' | 'image' | 'slides' | 'data' | 'text' | 'document'

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'])

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot).toLowerCase()
}

/** 资料类型 → 图标种类。优先用接口给出的类型，扩展名作补充。 */
export function libraryDocIconKind(kind: string, name: string): LibraryDocIconKind {
  const ext = extensionOf(name)
  if (kind === 'pdf' || ext === '.pdf') return 'pdf'
  if (kind === 'image' || IMAGE_EXT.has(ext)) return 'image'
  if (kind === 'ppt' || kind === 'pptx' || ext === '.ppt' || ext === '.pptx') return 'slides'
  if (ext === '.csv') return 'data'
  if (kind === 'text' || ext === '.txt' || ext === '.md' || ext === '.markdown' || ext === '.log') return 'text'
  return 'document'
}

export function libraryDocIcon(kind: string, name: string, fontSize = 18): ReactElement {
  switch (libraryDocIconKind(kind, name)) {
    case 'pdf':
      return <DocumentPdfRegular fontSize={fontSize} />
    case 'image':
      return <ImageRegular fontSize={fontSize} />
    case 'slides':
      return <SlideTextRegular fontSize={fontSize} />
    case 'data':
      return <DocumentDataRegular fontSize={fontSize} />
    case 'text':
      return <DocumentTextRegular fontSize={fontSize} />
    default:
      return <DocumentRegular fontSize={fontSize} />
  }
}
