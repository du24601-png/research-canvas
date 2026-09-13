/**
 * Theme Studio（主题工坊）— 可编辑色键目录与值校验（纯数据，零 JSX）。
 *
 * 分组目录供面板分组渲染；逻辑层（存储/应用/文件）见 `themeStudio.ts`，
 * 该文件会再导出本目录全部公开名，调用方只需 import './themeStudio'。
 */

export type ThemeStudioOverrideMap = Record<string, string>

export type ThemeStudioFile = {
  version: 1
  light?: ThemeStudioOverrideMap
  dark?: ThemeStudioOverrideMap
}

export const THEME_STUDIO_OPEN_KEY = 'opptrix-theme-studio-open'
export const THEME_STUDIO_OVERRIDES_KEY = 'opptrix-theme-studio-overrides'
export const THEME_STUDIO_FILE_VERSION = 1

// ── 可编辑色键分组 ──────────────────────────────────────────────────────────

export type ThemeStudioGroupId = 'brand' | 'neutral' | 'text' | 'semantic' | 'glass' | 'input'

export interface ThemeStudioColorGroup {
  id: ThemeStudioGroupId
  label: string
  /** [CSS 变量短名, 中文名] */
  entries: ReadonlyArray<readonly [string, string]>
}

export const THEME_STUDIO_GROUPS: readonly ThemeStudioColorGroup[] = [
  {
    id: 'brand',
    label: '品牌强调',
    entries: [
      ['accent', '强调色'],
      ['accent-hover', '强调色 · 悬停'],
      ['accent-soft', '强调色 · 浅底'],
      ['accent-muted', '强调色 · 次浅底'],
      ['accent-foreground', '强调色上的文字'],
    ],
  },
  {
    id: 'neutral',
    label: '表面与中性',
    entries: [
      ['canvas', '主画布'],
      ['canvas-alt', '侧栏底色'],
      ['canvas-muted', '弱填充'],
      ['surface', '卡片表面'],
      ['surface-muted', '卡片表面 · 柔和'],
      ['surface-hover', '悬停表面'],
      ['gray-100', '中性一'],
      ['gray-200', '中性二'],
      ['gray-300', '中性三'],
      ['separator', '分隔线'],
      ['separator-strong', '分隔线 · 加深'],
      ['border', '描边'],
      ['border-strong', '描边 · 加深'],
    ],
  },
  {
    id: 'text',
    label: '文本',
    entries: [
      ['text', '主文本'],
      ['text-secondary', '次级文本'],
      ['text-tertiary', '辅助文本'],
    ],
  },
  {
    id: 'semantic',
    label: '语义',
    entries: [
      ['success', '成功'],
      ['success-soft', '成功 · 浅底'],
      ['warning', '提醒'],
      ['warning-soft', '提醒 · 浅底'],
      ['error', '错误'],
      ['error-soft', '错误 · 浅底'],
      ['info-soft', '信息 · 浅底'],
    ],
  },
  {
    id: 'glass',
    label: '玻璃',
    entries: [
      ['surface-glass', '玻璃面板'],
      ['glass', '玻璃 · 轻'],
      ['glass-strong', '玻璃 · 重'],
      ['glass-nav-selected', '导航选中'],
      ['sidebar-glass', '侧栏玻璃'],
      ['sidebar-selected', '侧栏选中'],
      ['user-bubble', '对话气泡'],
    ],
  },
  {
    id: 'input',
    label: '输入与焦点',
    entries: [
      ['input-bg', '输入框底色'],
      ['input-bg-hover', '输入框底色 · 悬停'],
      ['input-bg-focus', '输入框底色 · 聚焦'],
      ['input-border', '输入框描边'],
      ['input-border-focus', '输入框描边 · 聚焦'],
      ['focus-glow', '焦点光晕'],
      ['focus-border', '焦点描边'],
    ],
  },
]

/** 可编辑键全集（按组展开；shadow 类多段值不提供色板编辑）。 */
export const EDITABLE_COLOR_KEYS: readonly string[] = THEME_STUDIO_GROUPS.flatMap(group =>
  group.entries.map(([key]) => key),
)

/** 值不是纯颜色、只提供文本编辑的键（光晕为多段阴影值，取色器不适配）。 */
export const THEME_STUDIO_FREEFORM_KEYS: readonly string[] = ['focus-glow']

const EDITABLE_KEY_SET = new Set(EDITABLE_COLOR_KEYS)
const FREEFORM_KEY_SET = new Set(THEME_STUDIO_FREEFORM_KEYS)

export function isThemeStudioEditableKey(key: string): boolean {
  return EDITABLE_KEY_SET.has(key)
}

export const themeStudioCssVarName = (key: string): string => `--opptrix-${key}`

// ── 值校验 ──────────────────────────────────────────────────────────────────

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const RGB_FUNC_RE = /^rgba?\(\s*\d{1,3}%?\s*(?:,\s*\d{1,3}%?\s*){2}(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/i

/** 颜色值校验：`#rgb` / `#rrggbb` / `#rrggbbaa` 或 `rgb()` / `rgba()`。 */
export function isValidThemeStudioValue(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const v = value.trim()
  if (v === '') return false
  return HEX_COLOR_RE.test(v) || RGB_FUNC_RE.test(v)
}

/** 存储级校验：自由文本键放宽为非空短文本，其余走颜色校验。 */
export function isValidThemeStudioStoredValue(key: string, value: unknown): boolean {
  if (FREEFORM_KEY_SET.has(key)) {
    return typeof value === 'string' && value.trim() !== '' && value.length <= 120
  }
  return isValidThemeStudioValue(value)
}
