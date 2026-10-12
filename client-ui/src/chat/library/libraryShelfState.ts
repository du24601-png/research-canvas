import { useCallback, useEffect, useRef, useState } from 'react'
import { formatAttachmentUploadError } from '../attachmentUpload'
import { useOpptrixDialogAlert } from '../../components/opptrix/OpptrixDialogAlert'
import {
  deleteLibraryDocument,
  listLibraryDocuments,
  uploadLibraryDocument,
  type LibraryDocument,
} from '../../api/library'
import { libraryShelfFileError } from './libraryShelfFiles'

type Gen = { current: number }
type DocsSetter = (docs: LibraryDocument[] | ((prev: LibraryDocument[]) => LibraryDocument[])) => void
type TextSetter = (value: string | null) => void
type BoolSetter = (value: boolean) => void

async function pullShelf(
  gen: Gen,
  setDocs: DocsSetter,
  setError: TextSetter,
  setLoading: BoolSetter,
  quiet: boolean,
): Promise<void> {
  const mine = ++gen.current
  if (!quiet) setLoading(true)
  try {
    const resp = await listLibraryDocuments(100, 0)
    if (mine !== gen.current) return
    setDocs(resp.documents)
    setError(null)
  } catch {
    if (mine !== gen.current) return
    if (!quiet) setDocs([])
    setError('暂时读不到你的资料，请稍后再打开')
  } finally {
    if (mine === gen.current) setLoading(false)
  }
}

async function uploadShelfFiles(files: File[], setBusy: (name: string | null) => void): Promise<{ failed: string; added: number }> {
  let failed = ''
  let added = 0
  for (const file of files) {
    const rejected = libraryShelfFileError(file)
    if (rejected) {
      failed = rejected
      continue
    }
    setBusy(file.name)
    try {
      await uploadLibraryDocument(file)
      added += 1
    } catch (err) {
      failed = formatAttachmentUploadError(err)
    }
  }
  setBusy(null)
  return { failed, added }
}

export function useShelfDocuments() {
  const confirm = useOpptrixDialogAlert().confirm
  const gen = useRef(0)
  const [docs, setDocs] = useState<LibraryDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refresh = useCallback((quiet: boolean) => pullShelf(gen, setDocs, setError, setLoading, quiet), [])

  useEffect(() => { void refresh(false) }, [refresh])
  useEffect(() => {
    if (!docs.some(doc => doc.status === 'pending' || doc.vector_status === 'indexing')) return undefined
    const timer = window.setInterval(() => { void refresh(true) }, 2000)
    return () => window.clearInterval(timer)
  }, [docs, refresh])

  const addFiles = useCallback(async (files: File[]) => {
    if (files.length === 0 || busy) return
    setError(null)
    const { failed, added } = await uploadShelfFiles(files, setBusy)
    if (added > 0) await refresh(true)
    if (failed) setError(failed)
  }, [busy, refresh])

  const removeDoc = useCallback(async (doc: LibraryDocument) => {
    const ok = await confirm({
      title: '从资料中移除？',
      message: '移除后，之后的提问不会再引用这份文件。',
      confirmLabel: '移除',
      cancelLabel: '取消',
      confirmTone: 'danger',
    })
    if (!ok) return
    try {
      await deleteLibraryDocument(doc.id)
      setDocs(current => current.filter(item => item.id !== doc.id))
    } catch {
      setError('暂时没能移除，请再试一次')
    }
  }, [confirm])

  return { docs, loading, busy, error, addFiles, removeDoc }
}
