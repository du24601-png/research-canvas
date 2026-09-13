import { describe, expect, it } from 'vitest'
import { compactCanvasLayout } from './compactCanvasLayout'
import { DEFAULT_CANVAS_STATE } from './defaultCanvasState'

describe('narrow canvas reading layout', () => {
  it('stacks full-width cards without mutating the desktop layout', () => {
    const before = JSON.stringify(DEFAULT_CANVAS_STATE.layout)
    const compact = compactCanvasLayout(DEFAULT_CANVAS_STATE.layout, DEFAULT_CANVAS_STATE.widgets)
    expect(compact.every(item => item.x === 0 && item.w === 12)).toBe(true)
    expect(compact[1]?.y).toBe(compact[0]?.h)
    expect(compact.every(item => item.h >= 7)).toBe(true)
    expect(JSON.stringify(DEFAULT_CANVAS_STATE.layout)).toBe(before)
  })
})
