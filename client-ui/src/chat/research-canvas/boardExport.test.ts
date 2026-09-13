import { describe, expect, it } from 'vitest'
import {
  boardExportFooterLabel,
  exportSizeForRatio,
  sanitizeBoardExportFilename,
} from './boardExport'

describe('boardExport', () => {
  it('maps export ratios to fixed pixel sizes', () => {
    expect(exportSizeForRatio('16:9')).toEqual({ width: 1920, height: 1080 })
    expect(exportSizeForRatio('9:16')).toEqual({ width: 1080, height: 1920 })
  })

  it('sanitizes export filenames', () => {
    expect(sanitizeBoardExportFilename(' 茅台 ROE 看板 ')).toBe('茅台 ROE 看板-看板.png')
    expect(sanitizeBoardExportFilename('bad/name?')).toBe('badname-看板.png')
    expect(sanitizeBoardExportFilename('')).toBe('看板-看板.png')
  })

  it('builds investor-facing footer copy', () => {
    expect(boardExportFooterLabel('2024')).toBe('数据截至 2024 · 数字来自公开财报，未编造')
    expect(boardExportFooterLabel(null)).toBe('数据截至 — · 数字来自公开财报，未编造')
  })
})
