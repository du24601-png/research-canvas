import { useCallback, useEffect, useRef, useState } from 'react'
import {
  WORKSPACE_CHAT_MIN_WIDTH,
  WORKSPACE_CHAT_RIGHT_MIN_WIDTH,
  WORKSPACE_PREVIEW_PANEL_DEFAULT_WIDTH,
  WORKSPACE_PREVIEW_PANEL_MIN_WIDTH,
  WORKSPACE_RIGHT_PANEL_MIN_WIDTH,
  WORKSPACE_RIGHT_PANEL_RESTORE_WIDTH,
  WORKSPACE_SPLITTER_WIDTH,
} from '../desktop/constants'
import { ensureWindowContentWidth } from '../platform/ensureWindowContentWidth'
import {
  clampRightWidth,
  estimateInitialRightWidth,
  ratioFromRightWidth,
  resolveCanvasSplitRatio,
  rightWidthFromRatio,
  writeStoredSplitRatio,
} from './workspaceSplitWidth'

function widthsApproximatelyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 2
}

interface Options {
  enabled?: boolean
  defaultRightWidth?: number
  previewDefaultWidth?: number
  previewMinWidth?: number
}

export function useWorkspaceSplit({
  enabled = true,
  defaultRightWidth,
  previewDefaultWidth = WORKSPACE_PREVIEW_PANEL_DEFAULT_WIDTH,
  previewMinWidth = WORKSPACE_PREVIEW_PANEL_MIN_WIDTH,
}: Options = {}) {
  const workspaceRef = useRef<HTMLDivElement>(null)
  const [workspaceWidth, setWorkspaceWidth] = useState(0)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [chatVisible, setChatVisible] = useState(true)
  const [rightPanelWidth, setRightPanelWidth] = useState(() => (
    defaultRightWidth ?? estimateInitialRightWidth()
  ))
  const [mode, setMode] = useState<'market' | 'preview'>('market')
  const [isDragging, setIsDragging] = useState(false)
  const intendedRatioRef = useRef(resolveCanvasSplitRatio())
  const savedRightWidthRef = useRef(rightPanelWidth)
  const savedPreviewWidthRef = useRef(0)
  const rightPanelWidthRef = useRef(rightPanelWidth)
  const modeRef = useRef<'market' | 'preview'>('market')
  const autoCollapsedByWidthRef = useRef(false)
  /** Skip auto-collapse while we widen the window to fit an intentional open. */
  const expandForOpenRef = useRef(false)
  const expandForOpenTimerRef = useRef<number | null>(null)
  const rightPanelOpenRef = useRef(rightPanelOpen)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const clearExpandForOpen = useCallback(() => {
    expandForOpenRef.current = false
    if (expandForOpenTimerRef.current != null) {
      window.clearTimeout(expandForOpenTimerRef.current)
      expandForOpenTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    rightPanelWidthRef.current = rightPanelWidth
  }, [rightPanelWidth])

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    rightPanelOpenRef.current = rightPanelOpen
  }, [rightPanelOpen])

  useEffect(() => () => clearExpandForOpen(), [clearExpandForOpen])

  useEffect(() => {
    if (!enabled) return
    const el = workspaceRef.current
    if (!el) return

    const sync = () => setWorkspaceWidth(el.clientWidth)
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => observer.disconnect()
  }, [enabled])

  const showSplitter = enabled && chatVisible && rightPanelOpen

  const chatWidth = showSplitter
    ? Math.max(WORKSPACE_CHAT_MIN_WIDTH, workspaceWidth - rightPanelWidth - WORKSPACE_SPLITTER_WIDTH)
    : chatVisible
      ? workspaceWidth
      : 0

  const canFitRightPanel = workspaceWidth <= 0 || workspaceWidth >= WORKSPACE_CHAT_RIGHT_MIN_WIDTH

  const canvasTargetWidth = useCallback((wsWidth: number) => {
    const ws = wsWidth > 0
      ? wsWidth
      : (typeof window !== 'undefined' ? window.innerWidth : 1280)
    if (defaultRightWidth != null) {
      return clampRightWidth(defaultRightWidth, ws, WORKSPACE_RIGHT_PANEL_MIN_WIDTH)
    }
    return rightWidthFromRatio(ws, intendedRatioRef.current)
  }, [defaultRightWidth])

  const commitWidth = useCallback((nextWidth: number, wsWidth: number) => {
    const minWidth =
      modeRef.current === 'preview' ? previewMinWidth : WORKSPACE_RIGHT_PANEL_MIN_WIDTH
    const clamped = clampRightWidth(nextWidth, wsWidth, minWidth)
    if (modeRef.current === 'preview') {
      savedPreviewWidthRef.current = clamped
    } else {
      savedRightWidthRef.current = clamped
      if (wsWidth > 0) {
        const ratio = ratioFromRightWidth(wsWidth, clamped)
        intendedRatioRef.current = ratio
        writeStoredSplitRatio(ratio)
      }
    }
    setRightPanelWidth(clamped)
  }, [previewMinWidth])

  const collapseRightPanel = useCallback((markAuto = true) => {
    if (!rightPanelOpen) return
    if (modeRef.current === 'preview') {
      savedPreviewWidthRef.current = rightPanelWidthRef.current
    } else {
      savedRightWidthRef.current = rightPanelWidthRef.current
    }
    if (markAuto) autoCollapsedByWidthRef.current = true
    setRightPanelOpen(false)
    setChatVisible(true)
  }, [rightPanelOpen])

  const beginDrag = useCallback((clientX: number) => {
    if (!enabled || !chatVisible || !rightPanelOpen) return
    dragRef.current = { startX: clientX, startWidth: rightPanelWidthRef.current }
    setIsDragging(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [chatVisible, enabled, rightPanelOpen])

  const endDrag = useCallback(() => {
    dragRef.current = null
    setIsDragging(false)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    if (!enabled) return

    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current
      const ws = workspaceRef.current
      if (!drag || !ws) return

      const delta = drag.startX - e.clientX
      const minWidth =
        modeRef.current === 'preview' ? previewMinWidth : WORKSPACE_RIGHT_PANEL_MIN_WIDTH
      const next = clampRightWidth(drag.startWidth + delta, ws.clientWidth, minWidth)
      setRightPanelWidth(next)
    }

    const onUp = () => {
      const drag = dragRef.current
      const ws = workspaceRef.current
      endDrag()
      if (drag && ws) {
        commitWidth(rightPanelWidthRef.current, ws.clientWidth)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      endDrag()
    }
  }, [commitWidth, enabled, endDrag, previewMinWidth])

  useEffect(() => {
    if (!enabled || isDragging || workspaceWidth <= 0) return

    if (expandForOpenRef.current && workspaceWidth >= WORKSPACE_CHAT_RIGHT_MIN_WIDTH) {
      clearExpandForOpen()
    }

    if (rightPanelOpen && workspaceWidth < WORKSPACE_CHAT_RIGHT_MIN_WIDTH) {
      if (expandForOpenRef.current) return
      collapseRightPanel(true)
      return
    }

    if (
      !rightPanelOpen
      && autoCollapsedByWidthRef.current
      && workspaceWidth >= WORKSPACE_RIGHT_PANEL_RESTORE_WIDTH
    ) {
      autoCollapsedByWidthRef.current = false
      const restored =
        modeRef.current === 'preview'
          ? savedPreviewWidthRef.current || previewDefaultWidth
          : canvasTargetWidth(workspaceWidth)
      setRightPanelWidth(restored)
      setRightPanelOpen(true)
      setChatVisible(true)
      return
    }

    if (!rightPanelOpen || !chatVisible) return

    if (mode === 'preview') {
      const clamped = clampRightWidth(rightPanelWidth, workspaceWidth, previewMinWidth)
      if (clamped !== rightPanelWidth) setRightPanelWidth(clamped)
      return
    }

    const target = canvasTargetWidth(workspaceWidth)
    if (!widthsApproximatelyEqual(target, rightPanelWidth)) {
      savedRightWidthRef.current = target
      setRightPanelWidth(target)
    }
  }, [
    canvasTargetWidth,
    chatVisible,
    clearExpandForOpen,
    collapseRightPanel,
    enabled,
    isDragging,
    mode,
    previewDefaultWidth,
    previewMinWidth,
    rightPanelOpen,
    rightPanelWidth,
    workspaceWidth,
  ])

  const openWithWidth = useCallback((targetWidth: number) => {
    const neededWorkspace =
      WORKSPACE_CHAT_MIN_WIDTH + WORKSPACE_SPLITTER_WIDTH + targetWidth

    autoCollapsedByWidthRef.current = false
    setRightPanelWidth(targetWidth)

    if (!rightPanelOpenRef.current) {
      setRightPanelOpen(true)
      setChatVisible(true)
    }

    if (enabled && workspaceWidth > 0 && workspaceWidth < neededWorkspace) {
      const deficit = neededWorkspace - workspaceWidth
      expandForOpenRef.current = true
      if (expandForOpenTimerRef.current != null) {
        window.clearTimeout(expandForOpenTimerRef.current)
      }
      // If resize is blocked (fullscreen / OS limits), stop shielding auto-collapse.
      expandForOpenTimerRef.current = window.setTimeout(() => {
        expandForOpenRef.current = false
        expandForOpenTimerRef.current = null
      }, 1000)

      void ensureWindowContentWidth(window.innerWidth + deficit)
    }
  }, [enabled, workspaceWidth])

  const closePreview = useCallback(() => {
    if (modeRef.current === 'preview') {
      savedPreviewWidthRef.current = rightPanelWidthRef.current
    }
    setMode('market')
    if (!rightPanelOpen) {
      openWithWidth(canvasTargetWidth(workspaceWidth))
      return
    }
    const target = canvasTargetWidth(workspaceWidth)
    if (!widthsApproximatelyEqual(rightPanelWidthRef.current, target)) {
      openWithWidth(target)
    }
  }, [canvasTargetWidth, openWithWidth, rightPanelOpen, workspaceWidth])

  const toggleRightPanel = useCallback(() => {
    if (mode === 'preview') {
      savedPreviewWidthRef.current = rightPanelWidthRef.current
      setMode('market')
      const target = canvasTargetWidth(workspaceWidth)
      if (widthsApproximatelyEqual(rightPanelWidthRef.current, target)) return
      openWithWidth(target)
      return
    }

    if (rightPanelOpen) {
      clearExpandForOpen()
      savedRightWidthRef.current = rightPanelWidthRef.current
      autoCollapsedByWidthRef.current = false
      setRightPanelOpen(false)
      setChatVisible(true)
      return
    }

    openWithWidth(canvasTargetWidth(workspaceWidth))
  }, [canvasTargetWidth, clearExpandForOpen, mode, openWithWidth, rightPanelOpen, workspaceWidth])

  const openPreview = useCallback(() => {
    if (!rightPanelOpen) {
      setMode('preview')
      openWithWidth(savedPreviewWidthRef.current || previewDefaultWidth)
      return
    }
    if (modeRef.current === 'market') {
      savedRightWidthRef.current = rightPanelWidthRef.current
    }
    setMode('preview')
    const target = savedPreviewWidthRef.current || previewDefaultWidth
    if (widthsApproximatelyEqual(rightPanelWidthRef.current, target)) return
    openWithWidth(target)
  }, [openWithWidth, previewDefaultWidth, rightPanelOpen])

  const openMarket = useCallback(() => {
    if (!rightPanelOpen) {
      setMode('market')
      openWithWidth(canvasTargetWidth(workspaceWidth))
      return
    }
    if (modeRef.current === 'preview') {
      savedPreviewWidthRef.current = rightPanelWidthRef.current
    }
    setMode('market')
    const target = canvasTargetWidth(workspaceWidth)
    if (!widthsApproximatelyEqual(rightPanelWidthRef.current, target)) {
      openWithWidth(target)
    }
  }, [canvasTargetWidth, openWithWidth, rightPanelOpen, workspaceWidth])

  const toggleChatColumn = useCallback(() => {
    if (!rightPanelOpen) return
    if (chatVisible) {
      if (modeRef.current === 'preview') {
        savedPreviewWidthRef.current = rightPanelWidthRef.current
      } else {
        savedRightWidthRef.current = rightPanelWidthRef.current
      }
      setChatVisible(false)
      return
    }
    const restored =
      modeRef.current === 'preview'
        ? savedPreviewWidthRef.current || previewDefaultWidth
        : canvasTargetWidth(workspaceWidth)
    setRightPanelWidth(restored)
    setChatVisible(true)
  }, [canvasTargetWidth, chatVisible, previewDefaultWidth, rightPanelOpen, workspaceWidth])

  const canToggleChatColumn = rightPanelOpen

  return {
    workspaceRef,
    workspaceWidth,
    rightPanelOpen,
    chatVisible,
    rightPanelWidth,
    mode,
    showSplitter,
    chatWidth,
    isDragging,
    canToggleChatColumn,
    canFitRightPanel,
    beginDrag,
    collapseRightPanel,
    closePreview,
    toggleRightPanel,
    toggleChatColumn,
    openPreview,
    openMarket,
  }
}
