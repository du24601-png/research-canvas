import { useState, type DragEvent } from 'react'
import { Spinner, makeStyles, mergeClasses } from '@fluentui/react-components'
import { DeleteRegular } from '@fluentui/react-icons'
import { opptrixCssVars, opptrixTokens } from '../../theme/tokens'
import { ghostInteractive } from '../../theme/mixins'
import type { LibraryDocument } from '../../api/library'
import { libraryDocIcon, libraryDocIconKind } from './libraryDocIcon'
import { libraryDocMeta } from './libraryDisplay'
import { LibraryShelfAdd } from './libraryShelfAdd'
import { useShelfDocuments } from './libraryShelfState'

const useStyles = makeStyles({
  root: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
  back: {
    ...ghostInteractive,
    alignSelf: 'flex-start',
    margin: '4px 10px 0',
    padding: '4px 8px',
    color: opptrixCssVars.textSecondary,
    fontSize: 'var(--opptrix-font-sm)',
  },
  hint: {
    margin: '8px 16px 4px',
    color: opptrixCssVars.textTertiary,
    fontSize: 'var(--opptrix-font-sm)',
    lineHeight: 1.5,
  },
  ask: {
    ...ghostInteractive,
    margin: '4px 10px 6px',
    padding: '5px 10px',
    textAlign: 'left',
    color: opptrixCssVars.textPrimary,
    fontSize: '13px',
    fontWeight: 500,
  },
  fileIcon: {
    flexShrink: 0,
    width: '18px',
    height: '18px',
    marginTop: '1px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: opptrixCssVars.textSecondary,
  },
  list: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: '4px 8px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    borderRadius: opptrixTokens.radiusMd,
  },
  over: { backgroundColor: opptrixCssVars.accentSoft },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '6px',
    padding: '6px 8px',
    borderRadius: opptrixTokens.radiusMd,
    ':hover': { backgroundColor: opptrixCssVars.surfaceHover },
  },
  text: { flex: 1, minWidth: 0 },
  name: {
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 'var(--opptrix-font-base)',
    fontWeight: 500,
    color: opptrixCssVars.textPrimary,
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '2px',
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
  },
  indexing: { display: 'inline-flex', flexShrink: 0 },
  remove: {
    ...ghostInteractive,
    flexShrink: 0,
    width: '28px',
    height: '28px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: opptrixCssVars.textSecondary,
  },
  note: {
    padding: '28px 16px',
    textAlign: 'center',
    color: opptrixCssVars.textTertiary,
    fontSize: 'var(--opptrix-font-base)',
    lineHeight: 1.6,
  },
  error: {
    margin: '0 16px 8px',
    color: opptrixCssVars.textSecondary,
    fontSize: 'var(--opptrix-font-sm)',
    lineHeight: 1.5,
  },
})

const INDEXING_HINT = '正在准备按意思查找，完成前只能按关键词找到这份文件里的内容'

function ShelfRow({ doc, onRemove }: { doc: LibraryDocument; onRemove: (doc: LibraryDocument) => void }) {
  const s = useStyles()
  return (
    <div className={s.row}>
      <span className={s.fileIcon} data-icon={libraryDocIconKind(doc.kind, doc.name)} aria-hidden="true">
        {libraryDocIcon(doc.kind, doc.name)}
      </span>
      <span className={s.text}>
        <span className={s.name} title={doc.name}>{doc.name}</span>
        <span className={s.meta}>
          {libraryDocMeta(doc.page_count, doc.status, doc.added_at)}
          {doc.vector_status === 'indexing' ? (
            <span className={s.indexing} role="status" title={INDEXING_HINT}>
              <Spinner size="extra-tiny" aria-label={INDEXING_HINT} />
            </span>
          ) : null}
        </span>
      </span>
      <button
        type="button"
        className={mergeClasses(s.remove, 'opptrix-focusable')}
        aria-label={`移除 ${doc.name}`}
        onClick={() => { void onRemove(doc) }}
      >
        <DeleteRegular fontSize={14} />
      </button>
    </div>
  )
}

interface DropProps {
  docs: LibraryDocument[]
  loading: boolean
  busy: string | null
  error: string | null
  onAsk: () => void
  onAdd: (files: File[]) => void
  onRemove: (doc: LibraryDocument) => void
}

function shelfDrag(
  busy: string | null,
  setOver: (over: boolean) => void,
  onAdd: (files: File[]) => void,
) {
  return {
    onDragOver(event: DragEvent<HTMLDivElement>) {
      event.preventDefault()
      if (!busy) setOver(true)
    },
    onDragLeave(event: DragEvent<HTMLDivElement>) {
      const next = event.relatedTarget
      if (next instanceof Node && event.currentTarget.contains(next)) return
      setOver(false)
    },
    onDrop(event: DragEvent<HTMLDivElement>) {
      event.preventDefault()
      setOver(false)
      onAdd(Array.from(event.dataTransfer.files))
    },
  }
}

function ShelfDrop({ docs, loading, busy, error, onAsk, onAdd, onRemove }: DropProps) {
  const s = useStyles()
  const [over, setOver] = useState(false)
  const drag = shelfDrag(busy, setOver, onAdd)
  return (
    <>
      <LibraryShelfAdd busy={busy} onAdd={onAdd} />
      {over ? <p className={s.hint}>松开即可加入</p> : null}
      {docs.length > 0 ? (
        <button type="button" className={mergeClasses(s.ask, 'opptrix-focusable')} onClick={onAsk}>用这些资料提问</button>
      ) : null}
      {error ? <p className={s.error} role="alert">{error}</p> : null}
      {busy ? <p className={s.hint}>正在加入 {busy}</p> : null}
      <div
        className={mergeClasses(s.list, over && s.over, 'opptrix-scroll', 'opptrix-scroll-hover')}
        onDragOver={drag.onDragOver}
        onDragLeave={drag.onDragLeave}
        onDrop={drag.onDrop}
      >
        {loading ? <p className={s.note}>正在读取资料…</p> : null}
        {!loading && docs.length === 0 ? <p className={s.note}>还没有资料。把年报、研报或纪要拖到这里。</p> : null}
        {docs.map(doc => <ShelfRow key={doc.id} doc={doc} onRemove={onRemove} />)}
      </div>
    </>
  )
}

interface Props {
  onBack: () => void
  onAsk: () => void
}

export default function LibraryShelf({ onBack, onAsk }: Props) {
  const s = useStyles()
  const shelf = useShelfDocuments()
  return (
    <section className={s.root} aria-label="我的资料">
      <button type="button" className={mergeClasses(s.back, 'opptrix-focusable')} onClick={onBack}>返回对话</button>
      <ShelfDrop
        docs={shelf.docs}
        loading={shelf.loading}
        busy={shelf.busy}
        error={shelf.error}
        onAsk={onAsk}
        onAdd={files => { void shelf.addFiles(files) }}
        onRemove={doc => { void shelf.removeDoc(doc) }}
      />
    </section>
  )
}
