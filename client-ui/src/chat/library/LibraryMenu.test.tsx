import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/testUtils'
import ComposerPlusMenu from '../ComposerPlusMenu'
import * as libraryApi from '../../api/library'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function openLibrary(onInsert = vi.fn()) {
  renderWithProviders(
    <ComposerPlusMenu
      attachmentsAllowed
      grantsAvailable
      onAttach={() => {}}
      onAuthorizeFolders={() => {}}
      onSelectSkill={() => {}}
      onInsertLibraryRef={onInsert}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '更多操作' }))
  fireEvent.click(screen.getByRole('button', { name: /我的资料/ }))
  return onInsert
}

const resp = (documents: libraryApi.LibraryDocument[]) =>
  ({ total: documents.length, limit: 100, offset: 0, documents })

describe('我的资料', () => {
  it('lists documents with pages and status, click inserts reference', async () => {
    vi.spyOn(libraryApi, 'listLibraryDocuments').mockResolvedValue(resp([
      { id: 'a', name: '贵州茅台2023年报.pdf', kind: 'pdf', page_count: 120, status: 'ready', added_at: '2026-05-01T08:00:00Z' },
      { id: 'b', name: '扫描件.pdf', kind: 'pdf', page_count: null, status: 'failed', added_at: '2026-05-02T08:00:00Z' },
      { id: 'c', name: '纪要.docx', kind: 'docx', page_count: 3, status: 'pending', added_at: '2026-05-03T08:00:00Z' },
    ]))
    const onInsert = openLibrary()
    await screen.findByText('贵州茅台2023年报.pdf')
    expect(screen.getByText(/120 页 · 已整理/)).toBeTruthy()
    expect(screen.getByText(/没能读出文字/)).toBeTruthy()
    expect(screen.getByText(/3 页 · 整理中/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /贵州茅台2023年报/ }))
    expect(onInsert).toHaveBeenCalledWith('根据《贵州茅台2023年报》，')
    expect(screen.queryByText('贵州茅台2023年报.pdf')).toBeNull()
  })

  it('shows the empty state', async () => {
    vi.spyOn(libraryApi, 'listLibraryDocuments').mockResolvedValue(resp([]))
    openLibrary()
    await screen.findByText(/还没有资料。在左侧打开「我的资料」/)
  })

  it('shows a plain-language error', async () => {
    vi.spyOn(libraryApi, 'listLibraryDocuments').mockRejectedValue(new Error('boom'))
    openLibrary()
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('暂时读不到你的资料'))
  })

  it('hides the entry when no insert handler is given', () => {
    renderWithProviders(
      <ComposerPlusMenu attachmentsAllowed grantsAvailable onAttach={() => {}}
        onAuthorizeFolders={() => {}} onSelectSkill={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '更多操作' }))
    expect(screen.queryByText('我的资料')).toBeNull()
  })
})
