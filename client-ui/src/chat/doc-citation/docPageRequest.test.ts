import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  clearDocPageRequest,
  DOC_PAGE_REQUEST_TTL_MS,
  getDocPageRequest,
  requestDocPage,
  useDocPageRequest,
} from './docPageRequest'

afterEach(() => {
  vi.useRealTimers()
  const req = getDocPageRequest()
  if (req) clearDocPageRequest(req.key)
})

describe('docPageRequest', () => {
  it('is cleared once consumed, so reopening the file later does not jump', () => {
    const { result } = renderHook(() => useDocPageRequest('s1', 'att-1'))
    act(() => requestDocPage('s1', 'att-1', 37))
    const req = result.current
    expect(req).toMatchObject({ page: 37 })
    act(() => clearDocPageRequest(req?.key ?? -1))
    expect(result.current).toBeNull()
    expect(getDocPageRequest()).toBeNull()
  })

  it('clearing an older key keeps a newer request', () => {
    requestDocPage('s1', 'att-1', 3)
    const older = getDocPageRequest()?.key ?? -1
    requestDocPage('s1', 'att-1', 9)
    clearDocPageRequest(older)
    expect(getDocPageRequest()).toMatchObject({ page: 9 })
  })

  it('ignores other files and expires unconsumed requests', () => {
    vi.useFakeTimers()
    requestDocPage('s1', 'att-1', 5)
    expect(renderHook(() => useDocPageRequest('s1', 'att-2')).result.current).toBeNull()
    expect(renderHook(() => useDocPageRequest('s1', 'att-1')).result.current).toMatchObject({ page: 5 })
    vi.advanceTimersByTime(DOC_PAGE_REQUEST_TTL_MS + 1)
    expect(renderHook(() => useDocPageRequest('s1', 'att-1')).result.current).toBeNull()
  })
})
