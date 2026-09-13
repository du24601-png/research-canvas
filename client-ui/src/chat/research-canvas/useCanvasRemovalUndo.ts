import { useCallback, useRef, useState } from 'react'
import type { CanvasLayoutItem, Widget } from './types'

interface RemovedSnapshot {
  title: string
  widgetId: string
  widgets: Widget[]
  layout: CanvasLayoutItem[]
}

export function useCanvasRemovalUndo(restore: (snapshot: RemovedSnapshot) => void) {
  const snapshotRef = useRef<RemovedSnapshot | null>(null)
  const [removedTitle, setRemovedTitle] = useState<string | null>(null)
  const clearUndo = useCallback(() => {
    snapshotRef.current = null
    setRemovedTitle(null)
  }, [])
  const rememberRemoval = useCallback((snapshot: RemovedSnapshot) => {
    snapshotRef.current = snapshot
    setRemovedTitle(snapshot.title)
  }, [])
  const undoRemoval = useCallback(() => {
    const snapshot = snapshotRef.current
    if (!snapshot) return
    clearUndo()
    restore(snapshot)
  }, [clearUndo, restore])
  return { removedTitle, rememberRemoval, clearUndo, undoRemoval }
}
