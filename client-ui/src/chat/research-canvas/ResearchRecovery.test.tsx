import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/testUtils'
import ResearchRecovery from './ResearchRecovery'
import { registerResearchAdjustDraftSink, consumePendingAdjustProposal } from './researchPreviewAdjust'
import { subscribeResearchCanvasEvents } from './researchCanvasBus'
import { safeSourceUrl, readableFetchTime, sourceProviderLabel } from './sourcePresentation'

describe('research recovery and evidence safety', () => {
  it('prepares a query for confirmation without changing the canvas', () => {
    const draft = vi.fn()
    const canvas = vi.fn()
    const stopDraft = registerResearchAdjustDraftSink(draft)
    const stopCanvas = subscribeResearchCanvasEvents(canvas)
    renderWithProviders(<ResearchRecovery title="毛利率趋势" missingData />)
    fireEvent.click(screen.getByRole('button', { name: '准备重新查询' }))
    expect(draft).toHaveBeenCalledWith(expect.stringContaining('毛利率趋势'))
    expect(screen.getByRole('status').textContent).toContain('发送')
    expect(consumePendingAdjustProposal()).toBeNull()
    expect(canvas).not.toHaveBeenCalled()
    stopDraft()
    stopCanvas()
  })

  it('only links safe web sources and does not invent missing timestamps', () => {
    expect(safeSourceUrl('https://example.com/report')).toBe('https://example.com/report')
    expect(safeSourceUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeSourceUrl('https://name:secret@example.com')).toBeUndefined()
    expect(safeSourceUrl('file:///private')).toBeUndefined()
    expect(readableFetchTime('invalid')).toBe('获取时间未记录')
    expect(readableFetchTime('2026-09-12T12:00:00Z')).toContain('获取时间：')
    expect(sourceProviderLabel('tushare')).toBe('公开数据')
    expect(sourceProviderLabel('unknown')).toBe('来源未标注')
    expect(sourceProviderLabel('mixed')).toBe('多个来源')
  })
})
