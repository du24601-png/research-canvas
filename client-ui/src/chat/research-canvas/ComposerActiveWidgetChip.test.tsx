import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ComposerActiveWidgetChip from '../ComposerActiveWidgetChip'
import { renderWithProviders } from '../../test/testUtils'
import {
  getActiveWidgetId,
  resetActiveWidgetForTests,
  setActiveWidget,
} from './activeWidgetSelection'

describe('ComposerActiveWidgetChip', () => {
  beforeEach(() => {
    resetActiveWidgetForTests()
  })

  it('renders the active widget title and clears on dismiss', async () => {
    setActiveWidget({ id: 'w1', title: 'Revenue & Operating Margin' })
    renderWithProviders(<ComposerActiveWidgetChip />)
    expect(screen.getByText('Revenue & Operating Margin')).toBeTruthy()
    expect(screen.getByTitle('Revenue & Operating Margin')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: '停止围绕此图提问' }))
    expect(getActiveWidgetId()).toBeNull()
    expect(screen.queryByText('Revenue & Operating Margin')).toBeNull()
  })

  it('renders nothing without an active widget', () => {
    const { container } = renderWithProviders(<ComposerActiveWidgetChip />)
    expect(container.querySelector('[data-active-widget-chip]')).toBeNull()
  })
})
