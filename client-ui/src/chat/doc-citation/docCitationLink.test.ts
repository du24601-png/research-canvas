import { describe, expect, it } from 'vitest'
import { markdownSanitizeSchema } from '../markdownSanitize'
import {
  docCitationLabel,
  docCitationUrlTransform,
  parseDocCitationHref,
} from './docCitationLink'

describe('parseDocCitationHref', () => {
  it('parses attachment and document links', () => {
    expect(parseDocCitationHref('opptrix-doc://a/att-1_x?page=37')).toEqual({ kind: 'attachment', id: 'att-1_x', page: 37 })
    expect(parseDocCitationHref('opptrix-doc://d/doc9?page=2')).toEqual({ kind: 'document', id: 'doc9', page: 2 })
  })

  it('rejects anything outside the exact format', () => {
    const bad = [
      'opptrix-doc://a/att-1?page=0',
      'opptrix-doc://a/att-1?page={page}',
      'opptrix-doc://a/att-1?page=3&x=1',
      'opptrix-doc://a/../etc?page=1',
      'opptrix-doc://x/att-1?page=1',
      'opptrix-doc://a/att 1?page=1',
      'opptrix-doc://a/att-1',
      'javascript:alert(1)',
      'https://example.com/?page=1',
    ]
    for (const href of bad) expect(parseDocCitationHref(href)).toBeNull()
  })
})

describe('docCitationUrlTransform', () => {
  it('keeps valid citation links, blanks invalid ones, defers to defaults otherwise', () => {
    expect(docCitationUrlTransform('opptrix-doc://a/att-1?page=5')).toBe('opptrix-doc://a/att-1?page=5')
    expect(docCitationUrlTransform('opptrix-doc://a/att-1?page=5&evil=1')).toBe('')
    expect(docCitationUrlTransform('javascript:alert(1)')).toBe('')
    expect(docCitationUrlTransform('https://example.com')).toBe('https://example.com')
  })
})

describe('markdown sanitizer', () => {
  it('allows opptrix-doc only for href, and nothing broader', () => {
    const href = markdownSanitizeSchema.protocols?.href ?? []
    const src = markdownSanitizeSchema.protocols?.src ?? []
    expect(href).toContain('opptrix-doc')
    expect(href).not.toContain('javascript')
    expect(href).not.toContain('opptrix-ws')
    expect(href).not.toContain('file')
    expect(src).not.toContain('opptrix-doc')
  })
})

describe('docCitationLabel', () => {
  it('formats 《文件名》p.N and truncates long names', () => {
    expect(docCitationLabel('《宁德时代 2024 年报》第 37 页', 37)).toBe('《宁德时代 2024 年报》p.37')
    expect(docCitationLabel('第 3 页', 3)).toBe('p.3')
    const long = `《${'很'.repeat(40)}》第 1 页`
    expect(docCitationLabel(long, 1)).toBe(`《${'很'.repeat(23)}…》p.1`)
  })
})
