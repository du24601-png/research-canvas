import { SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MIN_WIDTH } from '../desktop/constants'
import type { SessionMeta } from '../types/chat'

export type SessionSidebarPresentation = 'drawer' | 'none'

export const SESSION_PICKER_RECENT_LIMIT = 8

/** Overlay width fraction — kept for settings overlay geometry helpers. */
export const SESSION_OVERLAY_SIDEBAR_RATIO = 0.25

/** Desktop uses command palette + picker; mobile keeps the drawer. */
export function sessionSidebarPresentation(isMobile: boolean): SessionSidebarPresentation {
  return isMobile ? 'drawer' : 'none'
}

export function resolveSessionOverlaySidebarWidth(viewportWidth: number): number {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) {
    return SIDEBAR_DEFAULT_WIDTH
  }
  return Math.max(
    SIDEBAR_MIN_WIDTH,
    Math.round(viewportWidth * SESSION_OVERLAY_SIDEBAR_RATIO),
  )
}

export function recentSessionsForPicker(
  sessions: readonly SessionMeta[],
  limit: number = SESSION_PICKER_RECENT_LIMIT,
): SessionMeta[] {
  return sessions.filter(session => !session.expertId).slice(0, limit)
}

export function isCommandPaletteShortcut(event: KeyboardEvent): boolean {
  if (event.isComposing) return false
  if (event.altKey || event.shiftKey) return false
  if (event.key !== 'k' && event.key !== 'K') return false
  return event.metaKey || event.ctrlKey
}
