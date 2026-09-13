const PRESENT_QUERY_KEY = 'present'
const BOARD_QUERY_KEY = 'board'

export function readPresentModeDeepLink(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  const raw = params.get(PRESENT_QUERY_KEY)
  return raw === '1' || raw === 'true'
}

export function writePresentModeDeepLink(active: boolean): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (active) {
    url.searchParams.set(PRESENT_QUERY_KEY, '1')
  } else {
    url.searchParams.delete(PRESENT_QUERY_KEY)
  }
  const next = `${url.pathname}${url.search}${url.hash}`
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (next === current) return
  window.history.replaceState({ opptrixPresent: active ? '1' : null }, '', next)
}

export function readBoardSnapshotDeepLink(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const raw = params.get(BOARD_QUERY_KEY)?.trim()
  return raw || null
}

export function buildBoardSnapshotShareUrl(snapshotId: string): string {
  const url = new URL(window.location.href)
  url.searchParams.delete('present')
  url.searchParams.set(BOARD_QUERY_KEY, snapshotId)
  return url.toString()
}
