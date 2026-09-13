/**
 * Theme Studio 纯逻辑测试：值校验、存储读写、覆盖层应用/清除、
 * 主题文件解析与 URL 唤起意图。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { CSS_VAR_KEYS } from './cssVars'
import {
  EDITABLE_COLOR_KEYS,
  THEME_STUDIO_FREEFORM_KEYS,
  THEME_STUDIO_GROUPS,
  THEME_STUDIO_OVERRIDES_KEY,
  THEME_STUDIO_OPEN_KEY,
  applyOverrideMap,
  applyThemeStudioOverrides,
  applyThemeStudioScheme,
  applyThemeStudioOverlay,
  buildThemeStudioFile,
  clearThemeStudioOverrides,
  countThemeStudioOverrides,
  isValidThemeStudioValue,
  loadThemeStudioOverrides,
  parseThemeStudioFile,
  readThemeStudioOpenFlag,
  resolveThemeStudioUrlIntent,
  saveThemeStudioFile,
  saveThemeStudioOverrides,
} from './themeStudio'

const ACCENT_VAR = '--opptrix-accent'
const TEXT_VAR = '--opptrix-text'

function styleOf(): CSSStyleDeclaration {
  return document.documentElement.style
}

function prop(name: string): string {
  return styleOf().getPropertyValue(name)
}

beforeEach(() => {
  window.localStorage.clear()
  styleOf().cssText = ''
})

describe('isValidThemeStudioValue', () => {
  it('接受合法 hex 与 rgb/rgba', () => {
    expect(isValidThemeStudioValue('#abc')).toBe(true)
    expect(isValidThemeStudioValue('#AABBCC')).toBe(true)
    expect(isValidThemeStudioValue('#aabbccdd')).toBe(true)
    expect(isValidThemeStudioValue('rgb(20, 20, 20)')).toBe(true)
    expect(isValidThemeStudioValue('rgba(20, 20, 20, 0.08)')).toBe(true)
    expect(isValidThemeStudioValue('rgba(240,240,240,1)')).toBe(true)
    expect(isValidThemeStudioValue('  #aabbcc  ')).toBe(true)
  })

  it('拒绝非法值', () => {
    expect(isValidThemeStudioValue('')).toBe(false)
    expect(isValidThemeStudioValue('red')).toBe(false)
    expect(isValidThemeStudioValue('#ab')).toBe(false)
    expect(isValidThemeStudioValue('#aabb')).toBe(false)
    expect(isValidThemeStudioValue('#aabbccd')).toBe(false)
    expect(isValidThemeStudioValue('#abcdeg')).toBe(false)
    expect(isValidThemeStudioValue('0 0 0 3px rgba(0, 0, 0, 0.1)')).toBe(false)
    expect(isValidThemeStudioValue('rgb(20 20 20)')).toBe(false)
    expect(isValidThemeStudioValue(null)).toBe(false)
    expect(isValidThemeStudioValue(42)).toBe(false)
  })
})

describe('可编辑色键', () => {
  it('全部落在 CSS_VAR_KEYS 内且无重复', () => {
    const set = new Set<string>(CSS_VAR_KEYS)
    for (const key of EDITABLE_COLOR_KEYS) {
      expect(set.has(key), `未知键：${key}`).toBe(true)
    }
    expect(new Set(EDITABLE_COLOR_KEYS).size).toBe(EDITABLE_COLOR_KEYS.length)
  })

  it('分组覆盖 spec 枚举的关键键，且不含 shadow 类键', () => {
    const keys = new Set(EDITABLE_COLOR_KEYS)
    for (const key of ['accent', 'canvas', 'text', 'success', 'user-bubble', 'focus-border', 'focus-glow']) {
      expect(keys.has(key), `缺少键：${key}`).toBe(true)
    }
    for (const key of ['composer-float-shadow', 'popover-shadow', 'glass-panel-shadow']) {
      expect(keys.has(key)).toBe(false)
    }
    expect(THEME_STUDIO_FREEFORM_KEYS).toContain('focus-glow')
  })

  it('六个分组标签与键数符合预期', () => {
    expect(THEME_STUDIO_GROUPS.map(group => group.id)).toEqual([
      'brand',
      'neutral',
      'text',
      'semantic',
      'glass',
      'input',
    ])
    expect(EDITABLE_COLOR_KEYS.length).toBe(42)
  })
})

describe('存储读写', () => {
  it('round-trip 且深浅色互不影响', () => {
    saveThemeStudioOverrides('dark', { accent: '#112233' })
    saveThemeStudioOverrides('light', { text: '#445566' })
    expect(loadThemeStudioOverrides('dark')).toEqual({ accent: '#112233' })
    expect(loadThemeStudioOverrides('light')).toEqual({ text: '#445566' })
  })

  it('未知键与非法值在写入时被剔除', () => {
    saveThemeStudioOverrides('dark', { accent: '#112233', 'unknown-key': '#123456', text: 'nope' })
    expect(loadThemeStudioOverrides('dark')).toEqual({ accent: '#112233' })
  })

  it('清空分组后返回 null', () => {
    saveThemeStudioOverrides('dark', { accent: '#112233' })
    saveThemeStudioOverrides('dark', {})
    expect(loadThemeStudioOverrides('dark')).toBeNull()
  })

  it('损坏 JSON 容错返回 null', () => {
    window.localStorage.setItem(THEME_STUDIO_OVERRIDES_KEY, '{oops')
    expect(loadThemeStudioOverrides('dark')).toBeNull()
    window.localStorage.setItem(THEME_STUDIO_OVERRIDES_KEY, '[1,2,3]')
    expect(loadThemeStudioOverrides('dark')).toBeNull()
    window.localStorage.setItem(THEME_STUDIO_OVERRIDES_KEY, '"str"')
    expect(loadThemeStudioOverrides('dark')).toBeNull()
  })

  it('覆盖计数横跨两组', () => {
    expect(countThemeStudioOverrides()).toBe(0)
    saveThemeStudioOverrides('dark', { accent: '#112233' })
    saveThemeStudioOverrides('light', { text: '#445566', canvas: '#778899' })
    expect(countThemeStudioOverrides()).toBe(3)
  })
})

describe('覆盖层应用与清除', () => {
  it('应用覆盖并保持确定性（无残留）', () => {
    saveThemeStudioOverrides('dark', { accent: '#112233', text: 'rgba(68, 85, 102, 0.5)' })
    applyThemeStudioOverrides('dark')
    expect(prop(ACCENT_VAR)).toBe('#112233')
    expect(prop(TEXT_VAR)).toBe('rgba(68, 85, 102, 0.5)')
    // 无覆盖的键回写基础值（深色 Opptrix 主画布）
    expect(prop('--opptrix-canvas')).toBe('#181818')
  })

  it('无覆盖时重放会保留外观对应的基础值（iOS 预览不被覆盖层破坏）', () => {
    applyThemeStudioOverrides('light', 'ios')
    // iOS 浅色强调色（系统蓝），与 Opptrix 墨色不同
    expect(prop(ACCENT_VAR)).toBe('#007AFF')
    applyThemeStudioOverrides('light', 'opptrix')
    expect(prop(ACCENT_VAR)).toBe('#141414')
  })

  it('存储清空后重放覆盖层会退回基础值', () => {
    saveThemeStudioOverrides('dark', { accent: '#112233' })
    applyThemeStudioOverrides('dark')
    expect(prop(ACCENT_VAR)).toBe('#112233')
    saveThemeStudioOverrides('dark', {})
    applyThemeStudioOverrides('dark')
    // 旧覆盖失效，回到深色基础 accent
    expect(prop(ACCENT_VAR)).toBe('#F0F0F0')
  })

  it('applyOverrideMap 跳过未知键并返回有效数量', () => {
    const applied = applyOverrideMap({ accent: '#112233', 'unknown-key': '#123456', text: 'nope' })
    expect(applied).toBe(1)
    expect(prop(ACCENT_VAR)).toBe('#112233')
  })

  it('applyThemeStudioScheme 先铺基础值再叠加覆盖', () => {
    applyThemeStudioScheme('light', 'opptrix')
    // 基础 accent（Opptrix 浅色 = 墨色）已被铺上
    expect(prop(ACCENT_VAR)).not.toBe('')
    saveThemeStudioOverrides('light', { accent: '#112233' })
    applyThemeStudioScheme('light', 'opptrix')
    expect(prop(ACCENT_VAR)).toBe('#112233')
    expect(prop(TEXT_VAR)).not.toBe('')
  })

  it('clearThemeStudioOverrides 移除全部可编辑键', () => {
    saveThemeStudioOverrides('dark', { accent: '#112233', text: '#445566' })
    applyThemeStudioOverrides('dark')
    clearThemeStudioOverrides()
    expect(prop(ACCENT_VAR)).toBe('')
    expect(prop(TEXT_VAR)).toBe('')
  })

  it('overlay 入口在存储损坏时静默降级到基础值', () => {
    window.localStorage.setItem(THEME_STUDIO_OVERRIDES_KEY, '{broken')
    expect(() => applyThemeStudioOverlay('dark')).not.toThrow()
    expect(prop(ACCENT_VAR)).toBe('#F0F0F0')
  })
})

describe('主题文件', () => {
  it('build → parse round-trip', () => {
    saveThemeStudioFile({
      version: 1,
      light: { accent: '#112233' },
      dark: { text: '#445566', canvas: 'rgba(0, 0, 0, 0.5)' },
    })
    const file = buildThemeStudioFile()
    expect(file.version).toBe(1)
    const parsed = parseThemeStudioFile(JSON.stringify(file))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.file).toEqual(file)
      expect(parsed.ignoredCount).toBe(0)
    }
  })

  it('合法文件：未知键与非法值跳过并计数', () => {
    const parsed = parseThemeStudioFile(
      JSON.stringify({
        version: 1,
        light: { accent: '#112233', 'unknown-key': '#123456', text: 'nope' },
        dark: { canvas: '#778899' },
      }),
    )
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.file.light).toEqual({ accent: '#112233' })
      expect(parsed.file.dark).toEqual({ canvas: '#778899' })
      expect(parsed.ignoredCount).toBe(2)
    }
  })

  it('错误版本给出产品级报错', () => {
    const parsed = parseThemeStudioFile(JSON.stringify({ version: 2, light: { accent: '#112233' } }))
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.error.length).toBeGreaterThan(0)
  })

  it('损坏 JSON 与坏结构给出产品级报错', () => {
    expect(parseThemeStudioFile('{oops').ok).toBe(false)
    expect(parseThemeStudioFile('null').ok).toBe(false)
    expect(parseThemeStudioFile('[]').ok).toBe(false)
    expect(parseThemeStudioFile(JSON.stringify({ version: 1, light: 42 })).ok).toBe(false)
    expect(parseThemeStudioFile(JSON.stringify({ version: 1, light: ['accent'] })).ok).toBe(false)
  })

  it('空值组在结果中省略', () => {
    const parsed = parseThemeStudioFile(JSON.stringify({ version: 1, light: {} }))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.file.light).toBeUndefined()
      expect(parsed.file.dark).toBeUndefined()
    }
  })
})

describe('面板记忆与 URL 唤起', () => {
  it('open 标记读写与清除', () => {
    expect(readThemeStudioOpenFlag()).toBe(false)
    window.localStorage.setItem(THEME_STUDIO_OPEN_KEY, '1')
    expect(readThemeStudioOpenFlag()).toBe(true)
  })

  it('resolveThemeStudioUrlIntent 解析唤起意图', () => {
    expect(resolveThemeStudioUrlIntent('1')).toBe('open')
    expect(resolveThemeStudioUrlIntent('true')).toBe('open')
    expect(resolveThemeStudioUrlIntent('0')).toBe('close')
    expect(resolveThemeStudioUrlIntent('false')).toBe('close')
    expect(resolveThemeStudioUrlIntent(null)).toBe('remember')
    expect(resolveThemeStudioUrlIntent('')).toBe('remember')
    expect(resolveThemeStudioUrlIntent('abc')).toBe('remember')
  })
})
