import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { renderWithProviders } from '../test/testUtils'
import ComposerPlusMenu from './ComposerPlusMenu'

afterEach(cleanup)

describe('ComposerPlusMenu artifacts toggle', () => {
  it('shows 报告与脑图 and toggles it on', () => {
    const onToggleArtifacts = vi.fn()
    renderWithProviders(
      <ComposerPlusMenu
        attachmentsAllowed={false}
        grantsAvailable={false}
        onAttach={() => {}}
        onAuthorizeFolders={() => {}}
        onSelectSkill={() => {}}
        artifactsEnabled={false}
        onToggleArtifacts={onToggleArtifacts}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '更多操作' }))
    fireEvent.click(screen.getByRole('button', { name: /报告与脑图/ }))
    expect(onToggleArtifacts).toHaveBeenCalledWith(true)
  })

  it('toggles off when already enabled', () => {
    const onToggleArtifacts = vi.fn()
    renderWithProviders(
      <ComposerPlusMenu
        attachmentsAllowed={false}
        grantsAvailable={false}
        onAttach={() => {}}
        onAuthorizeFolders={() => {}}
        onSelectSkill={() => {}}
        artifactsEnabled
        onToggleArtifacts={onToggleArtifacts}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '更多操作' }))
    fireEvent.click(screen.getByRole('button', { name: /报告与脑图/ }))
    expect(onToggleArtifacts).toHaveBeenCalledWith(false)
  })
})
