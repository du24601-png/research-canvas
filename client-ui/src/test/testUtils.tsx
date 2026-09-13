import type { ReactElement, ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { FluentProvider } from '@fluentui/react-components'
import { getOpptrixFluentTheme } from '../theme/opptrixTheme'

/** RTL 渲染统一包裹 FluentProvider（主题取品牌亮色，组件样式令牌可解析） */
export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <FluentProvider theme={getOpptrixFluentTheme('light')}>{children}</FluentProvider>
  }
  return render(ui, { wrapper: Wrapper, ...options })
}
