import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/testUtils'
import type { ChatAttachmentMeta } from '../../types/chat'
import { WorkspaceUiContext, type WorkspaceUiContextValue } from '../workspace/WorkspaceUiContext'
import MarkdownMessage from '../MarkdownMessage'
import { DocCitationChip } from './DocCitationChip'
import { getDocPageRequest } from './docPageRequest'
import { libraryFileUrlForAttachment } from './libraryPreview'

const meta: ChatAttachmentMeta = {
  id: 'att-1',
  kind: 'pdf',
  mime: 'application/pdf',
  name: '宁德时代 2024 年报.pdf',
  size: 10,
  createdAt: '2026-10-01T00:00:00.000Z',
}

const linked: ChatAttachmentMeta = {
  ...meta,
  id: 'att-linked',
  name: '已链研报.pdf',
  extract: { status: 'ready', documentId: 'doclinked' },
}

vi.mock('../../api/client', () => ({
  fetchSessionAttachmentMeta: vi.fn(async (_sid: string, id: string) => {
    if (id === 'att-1') return meta
    throw new Error('not found')
  }),
  listSessionAttachments: vi.fn(async () => [{ ...linked, referenced: true }]),
  sessionWorkspaceFileUrl: () => '',
  sessionAttachmentUrl: () => '',
  API_BASE: '/api',
}))

vi.mock('../../api/library', () => ({
  fetchLibraryDocumentMime: vi.fn(async (id: string) => (id === 'libdoc9' ? 'application/pdf' : null)),
  libraryDocumentFileUrl: (id: string) => `/api/library/documents/${id}/file`,
}))

afterEach(cleanup)

describe('DocCitationChip', () => {
  it('renders 《文件名》p.N and calls the open handler with the page', () => {
    const onOpen = vi.fn()
    renderWithProviders(
      <DocCitationChip target={{ kind: 'attachment', id: 'att-1', page: 37 }} text="《年报》第 37 页" onOpen={onOpen} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /《年报》p\.37/ }))
    expect(onOpen).toHaveBeenCalledWith({ kind: 'attachment', id: 'att-1', page: 37 })
  })

  it('is display-only without a handler', () => {
    renderWithProviders(
      <DocCitationChip target={{ kind: 'document', id: 'd1', page: 2 }} text="《年报》第 2 页" />,
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('《年报》p.2')).toBeTruthy()
  })
})

function renderMarkdown(content: string, openFilePreview = vi.fn()) {
  const ui = { openFilePreview } as unknown as WorkspaceUiContextValue
  renderWithProviders(
    <WorkspaceUiContext.Provider value={ui}>
      <MarkdownMessage content={content} sessionId="s1" />
    </WorkspaceUiContext.Provider>,
  )
  return openFilePreview
}

describe('citation links in markdown', () => {
  it('renders a chip that opens the preview at the cited page', async () => {
    const open = renderMarkdown('毛利率上升「原文」[《宁德时代 2024 年报》第 37 页](opptrix-doc://a/att-1?page=37)')
    fireEvent.click(screen.getByRole('button', { name: /《宁德时代 2024 年报》p\.37/ }))
    await waitFor(() => expect(open).toHaveBeenCalledWith('s1', meta))
    expect(getDocPageRequest()).toMatchObject({ sessionId: 's1', attachmentId: 'att-1', page: 37 })
  })

  it('does not turn malformed or foreign links into chips', () => {
    renderMarkdown([
      '[坏链接](opptrix-doc://a/att-1?page=3&x=1)',
      '[脚本](javascript:alert(1))',
      '<a href="opptrix-doc://a/../x?page=1">原始 HTML</a>',
    ].join('\n\n'))
    expect(screen.queryByRole('button', { name: /打开原文/ })).toBeNull()
    // 被清空的链接只留文字，不渲染成指向当前页的空链接
    expect(screen.getByText('坏链接').closest('a')).toBeNull()
    expect(screen.getByText('脚本').closest('a')).toBeNull()
    expect(document.querySelector('a[href=""]')).toBeNull()
    for (const el of Array.from(document.querySelectorAll('a'))) {
      const href = el.getAttribute('href') ?? ''
      expect(href.startsWith('javascript:')).toBe(false)
      expect(href.startsWith('opptrix-doc:')).toBe(false)
    }
  })
})

describe('d/ library citations', () => {
  it('opens a library-only PDF in the preview at the cited page', async () => {
    const open = renderMarkdown('[《宁德时代 年报》第 12 页](opptrix-doc://d/libdoc9?page=12)')
    fireEvent.click(screen.getByRole('button', { name: /p\.12/ }))
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1))
    const [sid, att] = open.mock.calls[0] as [string, ChatAttachmentMeta]
    expect(sid).toBe('s1')
    expect(att).toMatchObject({ kind: 'pdf', name: '宁德时代 年报' })
    expect(libraryFileUrlForAttachment(att)).toBe('/api/library/documents/libdoc9/file')
    expect(getDocPageRequest()).toMatchObject({ attachmentId: att.id, page: 12 })
  })

  it('prefers the session attachment linked to the document', async () => {
    const open = renderMarkdown('[《已链研报》第 3 页](opptrix-doc://d/doclinked?page=3)')
    fireEvent.click(screen.getByRole('button', { name: /p\.3/ }))
    await waitFor(() => expect(open).toHaveBeenCalledWith('s1', expect.objectContaining({ id: 'att-linked' })))
    expect(libraryFileUrlForAttachment(linked)).toBeNull()
  })

  it('degrades to a muted chip when the document is unknown', async () => {
    const open = renderMarkdown('[《不存在》第 1 页](opptrix-doc://d/nope?page=1)')
    fireEvent.click(screen.getByRole('button', { name: /p\.1/ }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /p\.1/ })).toBeNull())
    expect(open).not.toHaveBeenCalled()
  })
})
