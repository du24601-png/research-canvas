import { describe, expect, it } from 'vitest'
import { layoutsEqual, nextCommittedLayout } from './layoutCommit'
import type { CanvasLayoutItem } from './types'

const A: CanvasLayoutItem = { i: 'a', x: 0, y: 0, w: 8, h: 6, minW: 5, minH: 4 }
const B: CanvasLayoutItem = { i: 'b', x: 8, y: 0, w: 4, h: 6, minW: 3, minH: 4 }

describe('research-canvas layout commit', () => {
  it('does not commit while drag or resize is active', () => {
    const next = nextCommittedLayout({
      interactionActive: true,
      current: [A],
      incoming: [{ ...A, x: 2 }],
    })
    expect(next).toBeNull()
  })

  it('skips a second persist when normalized layout is unchanged', () => {
    const first = nextCommittedLayout({
      interactionActive: false,
      current: [A, B],
      incoming: [B, A],
    })
    expect(first).toBeNull()
    expect(layoutsEqual([A, B], [B, A])).toBe(true)

    const moved = nextCommittedLayout({
      interactionActive: false,
      current: [A, B],
      incoming: [{ ...A, x: 1 }, B],
    })
    expect(moved).toEqual([{ ...A, x: 1 }, B])

    const duplicate = nextCommittedLayout({
      interactionActive: false,
      current: moved ?? [],
      incoming: moved ?? [],
    })
    expect(duplicate).toBeNull()
  })
})
