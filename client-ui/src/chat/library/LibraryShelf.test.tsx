import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/testUtils'
import { OpptrixDialogAlertProvider } from '../../components/opptrix/OpptrixDialogAlert'
import LibraryShelf from './LibraryShelf'
import { libraryDocIconKind } from './libraryDocIcon'
import { libraryShelfFileError } from './libraryShelfFiles'
import * as libraryApi from '../../api/library'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const doc: libraryApi.LibraryDocument = {
  id: 'doc-1',
  name: '纪要.txt',
  kind: 'text',
  page_count: 1,
  status: 'ready',
  added_at: '2026-05-01T08:00:00Z',
}

function renderShelf(onAsk = vi.fn(), onBack = vi.fn()) {
  renderWithProviders(
    <OpptrixDialogAlertProvider>
      <LibraryShelf onBack={onBack} onAsk={onAsk} />
    </OpptrixDialogAlertProvider>,
  )
  return { onAsk, onBack }
}

describe('资料架文件类型', () => {
  it('picks an icon from the file type', () => {
    expect(libraryDocIconKind('pdf', '年报.pdf')).toBe('pdf')
    expect(libraryDocIconKind('docx', '纪要.docx')).toBe('document')
    expect(libraryDocIconKind('pptx', '路演.pptx')).toBe('slides')
    expect(libraryDocIconKind('text', '纪要.txt')).toBe('text')
    expect(libraryDocIconKind('other', '表.csv')).toBe('data')
    expect(libraryDocIconKind('image', 'shot.png')).toBe('image')
  })

  it('rejects empty files and pictures', () => {
    expect(libraryShelfFileError({ name: '空.txt', size: 0 })).toMatch(/空的/)
    expect(libraryShelfFileError({ name: '照片.png', size: 10 })).toMatch(/PDF/)
    expect(libraryShelfFileError({ name: '纪要.txt', size: 4 })).toBeNull()
  })
})

describe('我的资料架', () => {
  it('lists a file, asks from it, and removes it after confirm', async () => {
    vi.spyOn(libraryApi, 'listLibraryDocuments').mockResolvedValue({
      total: 1, limit: 100, offset: 0, documents: [doc],
    })
    const remove = vi.spyOn(libraryApi, 'deleteLibraryDocument').mockResolvedValue()
    const { onAsk, onBack } = renderShelf()
    await screen.findByText('纪要.txt')
    expect(document.querySelector('[data-icon="text"]')).toBeTruthy()
    expect(screen.getByRole('button', { name: '拖入或点击添加' }).querySelector('input[type="file"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '用这些资料提问' }))
    expect(onAsk).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '返回对话' }))
    expect(onBack).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '移除 纪要.txt' }))
    fireEvent.click(await screen.findByRole('button', { name: '移除' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith('doc-1'))
    await waitFor(() => expect(screen.queryByText('纪要.txt')).toBeNull())
  })

  it('shows a loading mark only while a file is still being prepared for meaning search', async () => {
    vi.spyOn(libraryApi, 'listLibraryDocuments').mockResolvedValue({
      total: 2,
      limit: 100,
      offset: 0,
      documents: [
        { ...doc, id: 'doc-1', name: '纪要.txt', vector_status: 'indexing' },
        { ...doc, id: 'doc-2', name: '年报.pdf', kind: 'pdf', vector_status: 'ready' },
      ],
    })
    renderShelf()
    await screen.findByText('年报.pdf')
    expect(document.querySelector('[data-icon="pdf"]')).toBeTruthy()
    expect(document.querySelector('[data-icon="text"]')).toBeTruthy()
    const marks = screen.getAllByRole('status')
    expect(marks).toHaveLength(1)
    expect(marks[0]?.closest('div')?.textContent ?? '').toContain('纪要.txt')
  })

  it('uploads a dropped text file and rejects a picture', async () => {
    const list = vi.spyOn(libraryApi, 'listLibraryDocuments')
    list.mockResolvedValueOnce({ total: 0, limit: 100, offset: 0, documents: [] })
    list.mockResolvedValue({ total: 1, limit: 100, offset: 0, documents: [doc] })
    const upload = vi.spyOn(libraryApi, 'uploadLibraryDocument').mockResolvedValue(doc)
    renderShelf()
    await screen.findByText(/还没有资料/)
    const zone = screen.getByRole('button', { name: '拖入或点击添加' })
    const bad = new File(['x'], '照片.png', { type: 'image/png' })
    const transfer = {
      types: ['Files'],
      files: [bad],
      items: [{ kind: 'file', type: bad.type, getAsFile: () => bad }],
    }
    fireEvent.dragEnter(zone, { dataTransfer: transfer })
    await waitFor(() => expect(zone.textContent ?? '').toContain('松开即可加入'))
    fireEvent.drop(zone, { dataTransfer: transfer })
    const alert = await screen.findByRole('alert')
    expect(alert.textContent ?? '').toMatch(/PDF/)
    expect(upload).not.toHaveBeenCalled()
    const input = document.querySelector('input[type="file"]')
    expect(input).toBeTruthy()
    if (!input) return
    const good = new File(['你好'], '纪要.txt', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [good] } })
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
    await screen.findByText('纪要.txt')
  })
})
