import { act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useAppNavigation } from './useAppNavigation'

describe('useAppNavigation', () => {
  it('初始路由生效且不可回退/前进', () => {
    const { result } = renderHook(() => useAppNavigation('chat'))
    expect(result.current.current).toBe('chat')
    expect(result.current.canGoBack).toBe(false)
    expect(result.current.canGoForward).toBe(false)
  })

  it('navigate 压栈，back 退栈，到栈底后不可再退', () => {
    const { result } = renderHook(() => useAppNavigation('chat'))
    act(() => result.current.navigate('settings'))
    expect(result.current.current).toBe('settings')
    expect(result.current.canGoBack).toBe(true)
    act(() => result.current.goBack())
    expect(result.current.current).toBe('chat')
    expect(result.current.canGoBack).toBe(false)
  })

  it('回退后新 navigate 截断前向分支', () => {
    const { result } = renderHook(() => useAppNavigation('chat'))
    act(() => result.current.navigate('settings'))
    act(() => result.current.goBack())
    expect(result.current.canGoForward).toBe(true)
    act(() => result.current.navigate('settings'))
    expect(result.current.current).toBe('settings')
    expect(result.current.canGoForward).toBe(false)
  })

  it('与当前路由相同的 navigate 不产生新栈帧', () => {
    const { result } = renderHook(() => useAppNavigation('chat'))
    act(() => result.current.navigate('chat'))
    expect(result.current.canGoBack).toBe(false)
    expect(result.current.current).toBe('chat')
  })

  it('forward 沿历史栈前进，到栈顶后不可再进', () => {
    const { result } = renderHook(() => useAppNavigation('chat'))
    act(() => result.current.navigate('settings'))
    act(() => result.current.goBack())
    act(() => result.current.goForward())
    expect(result.current.current).toBe('settings')
    expect(result.current.canGoForward).toBe(false)
  })
})
