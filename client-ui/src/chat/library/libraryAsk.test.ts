import { afterEach, describe, expect, it } from 'vitest'
import { armLibraryAsk, consumeLibraryAsk, disarmLibraryAsk, isLibraryAskArmed } from './libraryAsk'

afterEach(() => {
  disarmLibraryAsk()
})

describe('只根据资料', () => {
  it('arms until the send consumes it', () => {
    expect(isLibraryAskArmed()).toBe(false)
    armLibraryAsk()
    expect(consumeLibraryAsk()).toBe(true)
    expect(consumeLibraryAsk()).toBe(false)
  })

  it('can be cancelled before send', () => {
    armLibraryAsk()
    disarmLibraryAsk()
    expect(isLibraryAskArmed()).toBe(false)
  })
})
