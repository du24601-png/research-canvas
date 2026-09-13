import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import OpptrixEmptyState from './OpptrixEmptyState'
import { renderWithProviders } from '../../test/testUtils'

describe('OpptrixEmptyState', () => {
  it('渲染「为什么没有 + 下一步」结构与动作', () => {
    renderWithProviders(
      <OpptrixEmptyState
        title="还没有自选标的"
        description="添加标的后即可在这里跟踪行情与提醒"
        action={<button type="button">去添加</button>}
      />,
    )
    expect(screen.getByText('还没有自选标的')).toBeTruthy()
    expect(screen.getByText('添加标的后即可在这里跟踪行情与提醒')).toBeTruthy()
    expect(screen.getByRole('button', { name: '去添加' })).toBeTruthy()
  })

  it('仅标题也可独立渲染（无说明与动作）', () => {
    renderWithProviders(<OpptrixEmptyState title="暂无数据" />)
    expect(screen.getByText('暂无数据')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
