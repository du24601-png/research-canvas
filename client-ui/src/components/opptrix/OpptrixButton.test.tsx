import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OpptrixButton from './OpptrixButton'
import { renderWithProviders } from '../../test/testUtils'

describe('OpptrixButton', () => {
  it('渲染文案并触发点击回调', async () => {
    const onClick = vi.fn()
    renderWithProviders(<OpptrixButton onClick={onClick}>保存</OpptrixButton>)
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('disabled 时点击不触发回调', async () => {
    const onClick = vi.fn()
    renderWithProviders(
      <OpptrixButton disabled onClick={onClick}>
        删除
      </OpptrixButton>,
    )
    await userEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('danger variant 与 small size 正常渲染', () => {
    renderWithProviders(
      <OpptrixButton variant="danger" size="small">
        移除
      </OpptrixButton>,
    )
    expect(screen.getByRole('button', { name: '移除' })).toBeTruthy()
  })
})
