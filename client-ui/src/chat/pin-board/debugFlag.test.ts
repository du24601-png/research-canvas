import { afterEach, describe, expect, it } from 'vitest'
import { DEBUG_STORAGE_KEY, isDebugInfoVisible, resolveDebugFlag, showDeveloperInfo } from './debugFlag'

describe('debugFlag', () => {
  afterEach(() => window.localStorage.removeItem(DEBUG_STORAGE_KEY))

  it('only "1" turns debug on', () => {
    expect(resolveDebugFlag('1')).toBe(true)
    expect(resolveDebugFlag('0')).toBe(false)
    expect(resolveDebugFlag(null)).toBe(false)
  })

  it('hides developer info in chat-first unless flagged; legacy always shows', () => {
    expect(showDeveloperInfo(false)).toBe(true)
    expect(showDeveloperInfo(true)).toBe(false)
    window.localStorage.setItem(DEBUG_STORAGE_KEY, '1')
    expect(isDebugInfoVisible()).toBe(true)
    expect(showDeveloperInfo(true)).toBe(true)
  })
})
