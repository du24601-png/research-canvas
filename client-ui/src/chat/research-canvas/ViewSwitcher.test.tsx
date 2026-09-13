import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, screen, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { renderWithProviders } from '../../test/testUtils'
import { ViewSwitcher } from './ViewSwitcher'
import { MOCK_GROSS_MARGIN_DATASET } from './mockGrossMarginDataset'
import type { WidgetType } from './types'

afterEach(cleanup)

function Switcher({ initial, metric }: { initial: WidgetType; metric: string }) {
  const [type, setType] = useState(initial)
  return <ViewSwitcher dataset={{ ...MOCK_GROSS_MARGIN_DATASET, metric }} type={type}
    onChange={next => setType(next.type)} />
}

describe('data table navigation', () => {
  it('can switch K line to data and back to K line', () => {
    renderWithProviders(<Switcher initial="candlestick" metric="kline" />)
    fireEvent.click(screen.getByRole('tab', { name: '表格' }))
    expect(screen.getByRole('tab', { name: '表格', selected: true })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'K 线' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'K 线' }))
    expect(screen.getByRole('tab', { name: 'K 线', selected: true })).toBeTruthy()
  })

  it('offers grouped bar for multi-year company comparison', () => {
    renderWithProviders(<Switcher initial="bar_chart" metric="gross_margin" />)
    expect(screen.getByRole('tab', { name: '分组柱' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: '分组柱' }))
    expect(screen.getByRole('tab', { name: '分组柱', selected: true })).toBeTruthy()
    expect(screen.queryByLabelText('对比年份')).toBeNull()
  })

  it('retains the original extended chart when inspecting data', () => {
    renderWithProviders(<Switcher initial="pie_chart" metric="gross_margin" />)
    const select = screen.getByRole('combobox', { name: '图表视图' }) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'table' } })
    expect(screen.getByRole('option', { name: '饼图' })).toBeTruthy()
    fireEvent.change(select, { target: { value: 'pie_chart' } })
    expect(select.value).toBe('pie_chart')
  })
})
