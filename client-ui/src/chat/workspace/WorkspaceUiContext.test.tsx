import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { useWorkspaceUi } from './WorkspaceUiContext'

describe('WorkspaceUiContext', () => {
  it('缺 Provider 时 useWorkspaceUi 直接抛错（组合壳必须显式挂载）', () => {
    function Probe() {
      useWorkspaceUi()
      return null
    }
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => render(<Probe />)).toThrow()
    } finally {
      errorSpy.mockRestore()
    }
  })
})
