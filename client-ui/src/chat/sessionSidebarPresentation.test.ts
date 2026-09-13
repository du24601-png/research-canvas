import { describe, expect, it } from 'vitest'
import type { SessionMeta } from '../types/chat'
import {
  isCommandPaletteShortcut,
  recentSessionsForPicker,
  sessionSidebarPresentation,
} from './sessionSidebarPresentation'

function session(id: string, expertId?: string): SessionMeta {
  return {
    id,
    title: id,
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z',
    expertId,
  }
}

describe('sessionSidebarPresentation', () => {
  it('mobile 用抽屉', () => {
    expect(sessionSidebarPresentation(true)).toBe('drawer')
  })
  it('desktop 不用侧栏', () => {
    expect(sessionSidebarPresentation(false)).toBe('none')
  })
})

describe('recentSessionsForPicker', () => {
  it('去掉专家会话并截到 8 条', () => {
    const rows = [
      session('a'),
      session('b', 'expert-1'),
      ...Array.from({ length: 10 }, (_, i) => session(`s${i}`)),
    ]
    const picked = recentSessionsForPicker(rows)
    expect(picked).toHaveLength(8)
    expect(picked.map(row => row.id)).toEqual(['a', 's0', 's1', 's2', 's3', 's4', 's5', 's6'])
  })
})

describe('isCommandPaletteShortcut', () => {
  it('识别 Ctrl/Cmd+K', () => {
    expect(isCommandPaletteShortcut(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))).toBe(true)
    expect(isCommandPaletteShortcut(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))).toBe(true)
    expect(isCommandPaletteShortcut(new KeyboardEvent('keydown', { key: 'k' }))).toBe(false)
    expect(isCommandPaletteShortcut(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, shiftKey: true }))).toBe(false)
    const prevented = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true })
    prevented.preventDefault()
    expect(isCommandPaletteShortcut(prevented)).toBe(true)
  })
})
