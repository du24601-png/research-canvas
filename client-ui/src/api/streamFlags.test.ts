import { afterEach, describe, expect, it, vi } from 'vitest'
import { streamSessionChat } from './client'

/** 只验证请求体里的布局 / 功能开关字段；SSE 内容为空即可 */
function mockFetch() {
  const calls: Array<Record<string, unknown>> = []
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>)
    return new Response(new ReadableStream({ start(c) { c.close() } }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
  }))
  return calls
}

describe('streamSessionChat flags', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('old two-column layout sends canvas_edit; chat-first sends composer only', async () => {
    const calls = mockFetch()
    await streamSessionChat('s1', 'hi', () => {}, undefined, undefined, undefined, undefined, { canvasEdit: true }).catch(() => {})
    await streamSessionChat('s1', 'hi', () => {}, undefined, undefined, undefined, undefined, { uiComposer: true }).catch(() => {})
    expect(calls[0]?.canvas_edit).toBe(true)
    expect(calls[0]?.ui_composer).toBeUndefined()
    expect(calls[1]?.canvas_edit).toBeUndefined()
    expect(calls[1]?.ui_composer).toBe(true)
  })
})
