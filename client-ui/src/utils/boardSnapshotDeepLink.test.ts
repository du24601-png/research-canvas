import { afterEach, describe, expect, it } from 'vitest'
import {
  buildBoardSnapshotShareUrl,
  readBoardSnapshotDeepLink,
} from './boardSnapshotDeepLink'

describe('boardSnapshotDeepLink', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('reads a board snapshot id from the query string', () => {
    window.history.replaceState({}, '', '/?board=snap-uuid-1')
    expect(readBoardSnapshotDeepLink()).toBe('snap-uuid-1')
  })

  it('treats blank board query as absent', () => {
    window.history.replaceState({}, '', '/?board=%20')
    expect(readBoardSnapshotDeepLink()).toBeNull()
  })

  it('builds a same-origin share URL without present mode', () => {
    window.history.replaceState({}, '', '/?present=1')
    const url = new URL(buildBoardSnapshotShareUrl('snap-uuid-2'))
    expect(url.searchParams.get('board')).toBe('snap-uuid-2')
    expect(url.searchParams.has('present')).toBe(false)
  })
})
