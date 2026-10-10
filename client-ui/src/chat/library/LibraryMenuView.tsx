import { listRowKey } from '../../utils/listRowKey'
import { ComposerTooltipMenuItem } from '../ComposerTooltipMenu'
import { libraryDocMeta } from './libraryDisplay'
import { useLibraryDocuments } from './useLibraryDocuments'
import type { LibraryDocument } from '../../api/library'

interface Props {
  enabled: boolean
  onSelect: (doc: LibraryDocument) => void
}

/** 「+」菜单里的「我的资料」子视图 */
export default function LibraryMenuView({ enabled, onSelect }: Props) {
  const { docs, loading, error } = useLibraryDocuments(enabled)
  if (loading) return <div className="opptrix-composer-plus-menu__empty">正在加载资料…</div>
  if (error) return <div className="opptrix-composer-plus-menu__empty" role="alert">{error}</div>
  if (docs.length === 0) {
    return (
      <div className="opptrix-composer-plus-menu__empty">
        还没有资料。用「添加附件」上传年报、研报或纪要，之后提问时我会引用里面的原文和页码。
      </div>
    )
  }
  return (
    <>
      {docs.map((doc, index) => (
        <ComposerTooltipMenuItem key={listRowKey(index, doc.id, doc.name)} onClick={() => onSelect(doc)}>
          <span className="opptrix-composer-plus-menu__label">
            <span className="opptrix-composer-plus-menu__title">{doc.name}</span>
            <span className="opptrix-composer-plus-menu__hint">
              {libraryDocMeta(doc.page_count, doc.status, doc.added_at)}
            </span>
          </span>
        </ComposerTooltipMenuItem>
      ))}
    </>
  )
}
