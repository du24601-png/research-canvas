import { describe, expect, it } from 'vitest'
import { formatBytes } from './formatBytes'

describe('formatBytes', () => {
  it('字节区间原值展示', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1023)).toBe('1023 B')
  })

  it('KB 区间：<10KB 一位小数，其余取整', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(9216)).toBe('9.0 KB')
    expect(formatBytes(10240)).toBe('10 KB')
    expect(formatBytes(48 * 1024)).toBe('48 KB')
  })

  it('MB 区间一位小数', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB')
  })

  it('GB 区间两位小数（行为超集新增档位）', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB')
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.50 GB')
  })
})
