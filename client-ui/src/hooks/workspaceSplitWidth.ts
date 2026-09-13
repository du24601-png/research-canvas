import {
  WORKSPACE_CHAT_MIN_WIDTH,
  WORKSPACE_RIGHT_PANEL_MIN_WIDTH,
  WORKSPACE_SPLITTER_WIDTH,
} from '../desktop/constants'

export const WORKSPACE_SPLIT_RATIO_KEY = 'opptrix.workspace-split.right-ratio'
/** Research Canvas occupies most of the workspace; chat stays a narrow agent column. */
export const WORKSPACE_CANVAS_DEFAULT_RATIO = 0.75

export function clampSplitRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return WORKSPACE_CANVAS_DEFAULT_RATIO
  return Math.min(0.9, Math.max(0.2, ratio))
}

export function clampRightWidth(width: number, wsWidth: number, minWidth: number): number {
  const maxRight = wsWidth - WORKSPACE_CHAT_MIN_WIDTH - WORKSPACE_SPLITTER_WIDTH
  if (maxRight < minWidth) return minWidth
  return Math.max(minWidth, Math.min(width, maxRight))
}

export function rightWidthFromRatio(
  wsWidth: number,
  ratio: number,
  minWidth: number = WORKSPACE_RIGHT_PANEL_MIN_WIDTH,
): number {
  return clampRightWidth(
    Math.round(wsWidth * clampSplitRatio(ratio)),
    wsWidth,
    minWidth,
  )
}

export function ratioFromRightWidth(wsWidth: number, rightWidth: number): number {
  if (!(wsWidth > 0) || !Number.isFinite(rightWidth)) return WORKSPACE_CANVAS_DEFAULT_RATIO
  return clampSplitRatio(rightWidth / wsWidth)
}

export function readStoredSplitRatio(): number | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(WORKSPACE_SPLIT_RATIO_KEY)
  if (raw == null) return null
  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed)) return null
  return clampSplitRatio(parsed)
}

export function writeStoredSplitRatio(ratio: number): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(WORKSPACE_SPLIT_RATIO_KEY, String(clampSplitRatio(ratio)))
  } catch {
    /* quota / private mode */
  }
}

export function resolveCanvasSplitRatio(): number {
  return readStoredSplitRatio() ?? WORKSPACE_CANVAS_DEFAULT_RATIO
}

export function estimateInitialRightWidth(
  minWidth: number = WORKSPACE_RIGHT_PANEL_MIN_WIDTH,
): number {
  const fallbackWs = 1280
  const ws = typeof window !== 'undefined' && window.innerWidth > 0
    ? window.innerWidth
    : fallbackWs
  return rightWidthFromRatio(ws, resolveCanvasSplitRatio(), minWidth)
}
