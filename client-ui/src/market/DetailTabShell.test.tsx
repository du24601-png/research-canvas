import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import DetailTabShell from './DetailTabShell'
import { renderWithProviders } from '../test/testUtils'

/**
 * DetailTabShell 五段式状态机优先级：
 * emptyMessage → loading → errorMessage → fallbackMessage → 正常态 header+children。
 */
describe('DetailTabShell 状态机', () => {
  it('empty 优先级最高：屏蔽 loading/error/children', () => {
    renderWithProviders(
      <DetailTabShell
        emptyMessage="未选择标的"
        loading
        errorMessage="加载失败"
        fallbackMessage="暂无数据"
        header={<div>头部</div>}
      >
        <div>主体内容</div>
      </DetailTabShell>,
    )
    expect(screen.getByText('未选择标的')).toBeTruthy()
    expect(screen.queryByText('主体内容')).toBeNull()
    expect(screen.queryByText('头部')).toBeNull()
  })

  it('loading 次之：展示加载态且不渲染 children', () => {
    renderWithProviders(
      <DetailTabShell loading loadingLabel="行情加载中" errorMessage="加载失败">
        <div>主体内容</div>
      </DetailTabShell>,
    )
    expect(screen.getByText('行情加载中')).toBeTruthy()
    expect(screen.queryByText('主体内容')).toBeNull()
    expect(screen.queryByText('加载失败')).toBeNull()
  })

  it('error 高于 fallback：首载失败只展示错误文案', () => {
    renderWithProviders(
      <DetailTabShell errorMessage="网络异常，请稍后重试" fallbackMessage="暂无数据">
        <div>主体内容</div>
      </DetailTabShell>,
    )
    expect(screen.getByText('网络异常，请稍后重试')).toBeTruthy()
    expect(screen.queryByText('暂无数据')).toBeNull()
  })

  it('仅 fallback 时展示兜底缺数据文案', () => {
    renderWithProviders(
      <DetailTabShell fallbackMessage="该标的信息暂未收录">
        <div>主体内容</div>
      </DetailTabShell>,
    )
    expect(screen.getByText('该标的信息暂未收录')).toBeTruthy()
    expect(screen.queryByText('主体内容')).toBeNull()
  })

  it('正常态渲染 header + children，且无任何占位文案', () => {
    renderWithProviders(
      <DetailTabShell header={<div>标的头部</div>}>
        <div>主体内容</div>
      </DetailTabShell>,
    )
    expect(screen.getByText('标的头部')).toBeTruthy()
    expect(screen.getByText('主体内容')).toBeTruthy()
  })
})
