import { beforeEach, describe, expect, it } from 'vitest'
import {
  WORKSPACE_CHAT_MIN_WIDTH,
  WORKSPACE_RIGHT_PANEL_MIN_WIDTH,
  WORKSPACE_SPLITTER_WIDTH,
} from '../desktop/constants'
import {
  WORKSPACE_CANVAS_DEFAULT_RATIO,
  WORKSPACE_SPLIT_RATIO_KEY,
  clampRightWidth,
  clampSplitRatio,
  ratioFromRightWidth,
  readStoredSplitRatio,
  resolveCanvasSplitRatio,
  rightWidthFromRatio,
  writeStoredSplitRatio,
} from './workspaceSplitWidth'

describe('workspace split ratio', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('defaults canvas to 75% of the workspace', () => {
    const ws = 1600
    const right = rightWidthFromRatio(ws, WORKSPACE_CANVAS_DEFAULT_RATIO)
    expect(right).toBe(1200)
    expect(ws - right - WORKSPACE_SPLITTER_WIDTH).toBeGreaterThanOrEqual(WORKSPACE_CHAT_MIN_WIDTH)
  })

  it('does not keep a 360px market-panel width on a wide workspace', () => {
    const ws = 1600
    const legacy = clampRightWidth(360, ws, WORKSPACE_RIGHT_PANEL_MIN_WIDTH)
    expect(legacy).toBe(360)
    const canvas = rightWidthFromRatio(ws, resolveCanvasSplitRatio())
    expect(canvas).toBeGreaterThan(legacy * 2)
  })

  it('clamps so chat keeps its minimum width', () => {
    const ws = 800
    const right = rightWidthFromRatio(ws, 0.75)
    expect(right).toBe(ws - WORKSPACE_CHAT_MIN_WIDTH - WORKSPACE_SPLITTER_WIDTH)
    expect(right).toBeGreaterThanOrEqual(WORKSPACE_RIGHT_PANEL_MIN_WIDTH)
  })

  it('preserves intended ratio across window resize after clamp', () => {
    const small = rightWidthFromRatio(800, 0.75)
    expect(small).toBeLessThan(Math.round(800 * 0.75))
    const restored = rightWidthFromRatio(1600, 0.75)
    expect(restored).toBe(1200)
  })

  it('persists and restores a user-dragged ratio', () => {
    expect(readStoredSplitRatio()).toBeNull()
    writeStoredSplitRatio(ratioFromRightWidth(1600, 900))
    expect(readStoredSplitRatio()).toBeCloseTo(900 / 1600)
    expect(rightWidthFromRatio(2000, resolveCanvasSplitRatio())).toBe(1125)
  })

  it('rejects illegal stored ratios', () => {
    expect(clampSplitRatio(Number.NaN)).toBe(WORKSPACE_CANVAS_DEFAULT_RATIO)
    window.localStorage.setItem(WORKSPACE_SPLIT_RATIO_KEY, 'nope')
    expect(readStoredSplitRatio()).toBeNull()
  })
})
