import { useCallback, useEffect, useRef, useState } from 'react'
import { listLibraryDocuments, type LibraryDocument } from '../../api/library'

/** `enabled` 为 true 时拉取「我的资料」列表（每次打开重新加载）。 */
export function useLibraryDocuments(enabled: boolean) {
  const [docs, setDocs] = useState<LibraryDocument[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const gen = useRef(0)

  const reload = useCallback(async () => {
    const mine = ++gen.current
    setLoading(true)
    setError(null)
    try {
      const resp = await listLibraryDocuments(100, 0)
      if (mine === gen.current) setDocs(resp.documents)
    } catch {
      if (mine !== gen.current) return
      setDocs([])
      setError('暂时读不到你的资料，请检查网络后重新打开此列表')
    } finally {
      if (mine === gen.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) void reload()
  }, [enabled, reload])

  return { docs, loading, error }
}
