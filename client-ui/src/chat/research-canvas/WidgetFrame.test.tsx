import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WidgetFrame from './WidgetFrame'
import { renderWithProviders } from '../../test/testUtils'

describe('WidgetFrame selection', () => {
  it('selects when the widget body is clicked', async () => {
    const onSelect = vi.fn()
    renderWithProviders(
      <WidgetFrame title="营收" onSelect={onSelect}>
        <div>plot</div>
      </WidgetFrame>,
    )
    await userEvent.click(screen.getByText('plot'))
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('does not select from the drag handle or close button', async () => {
    const onSelect = vi.fn()
    const onDelete = vi.fn()
    renderWithProviders(
      <WidgetFrame title="营收" selected onSelect={onSelect} onDelete={onDelete}>
        <div>plot</div>
      </WidgetFrame>,
    )
    await userEvent.click(screen.getByRole('button', { name: '拖动营收' }))
    expect(onSelect).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '更多操作：营收' }))
    await userEvent.click(screen.getByRole('menuitem', { name: '从画布移除' }))
    expect(onDelete).toHaveBeenCalledOnce()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('does not select from the view toolbar', async () => {
    const onSelect = vi.fn()
    const onToggleData = vi.fn()
    renderWithProviders(
      <WidgetFrame title="营收" onSelect={onSelect} toolbar={<button onClick={onToggleData}>表格</button>}>
        <div>plot</div>
      </WidgetFrame>,
    )
    await userEvent.click(screen.getByRole('button', { name: '表格' }))
    expect(onToggleData).toHaveBeenCalledOnce()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('marks selected widgets without changing the title', () => {
    const { container } = renderWithProviders(
      <WidgetFrame title="营收" selected>
        <div>plot</div>
      </WidgetFrame>,
    )
    expect(container.querySelector('.research-canvas-widget')?.getAttribute('data-selected')).toBe('true')
    expect(screen.getByText('营收')).toBeTruthy()
  })
})
