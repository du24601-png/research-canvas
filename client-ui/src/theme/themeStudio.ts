/**
 * Theme Studio（主题工坊）— 逻辑层，零 JSX。
 *
 * 职责：覆盖值存储、CSS 变量覆盖层应用、主题文件导出/导入、
 * 面板记忆开关与 URL 唤起意图解析。
 * 可编辑色键目录与值校验见 `themeStudioCatalog.ts`（本文件再导出其全部公开名）；
 * UI 见 `ThemeStudioPanel.tsx`。
 *
 * 实时机制：与 `cssVars.applyCssVars` 同通道 — 向
 * `document.documentElement.style` 写入同名 `--opptrix-*` 变量，
 * 全应用即时生效；`applyTheme` 在铺底后会重放本覆盖层。
 */
import type { AppearanceType, ColorScheme } from './tokens'
import { applyCssVars, getCssVarValues } from './cssVars'
import {
  EDITABLE_COLOR_KEYS,
  THEME_STUDIO_FILE_VERSION,
  THEME_STUDIO_OPEN_KEY,
  THEME_STUDIO_OVERRIDES_KEY,
  isThemeStudioEditableKey,
  isValidThemeStudioStoredValue,
  themeStudioCssVarName,
  type ThemeStudioFile,
  type ThemeStudioOverrideMap,
} from './themeStudioCatalog'

export {
  EDITABLE_COLOR_KEYS,
  THEME_STUDIO_FILE_VERSION,
  THEME_STUDIO_FREEFORM_KEYS,
  THEME_STUDIO_GROUPS,
  THEME_STUDIO_OPEN_KEY,
  THEME_STUDIO_OVERRIDES_KEY,
  isThemeStudioEditableKey,
  isValidThemeStudioValue,
  type ThemeStudioColorGroup,
  type ThemeStudioFile,
  type ThemeStudioGroupId,
  type ThemeStudioOverrideMap,
} from './themeStudioCatalog'


export type ThemeStudioUrlIntent = 'open' | 'close' | 'remember'

/** `?theme-studio=1` 打开、`=0` 关闭；其余（含无参数）读记忆。 */
export function resolveThemeStudioUrlIntent(raw: string | null): ThemeStudioUrlIntent {
  if (raw === '1' || raw === 'true') return 'open'
  if (raw === '0' || raw === 'false') return 'close'
  return 'remember'
}

export function readThemeStudioOpenFlag(): boolean {
  try {
    return window.localStorage.getItem(THEME_STUDIO_OPEN_KEY) === '1'
  } catch {
    return false
  }
}

export function writeThemeStudioOpenFlag(open: boolean): void {
  try {
    if (open) window.localStorage.setItem(THEME_STUDIO_OPEN_KEY, '1')
    else window.localStorage.removeItem(THEME_STUDIO_OPEN_KEY)
  } catch {
    /* 存储不可用只影响记忆，当前会话仍可使用 */
  }
}


type ThemeStudioStore = { light: ThemeStudioOverrideMap; dark: ThemeStudioOverrideMap }

/** 剔除未知键与非法值；结构损坏按空处理。 */
function sanitizeMap(raw: unknown): ThemeStudioOverrideMap {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: ThemeStudioOverrideMap = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isThemeStudioEditableKey(key) || !isValidThemeStudioStoredValue(key, value)) continue
    out[key] = String(value).trim()
  }
  return out
}

function readStore(): ThemeStudioStore | null {
  try {
    const raw = window.localStorage.getItem(THEME_STUDIO_OVERRIDES_KEY)
    if (raw == null) return null
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const obj = parsed as Record<string, unknown>
    return { light: sanitizeMap(obj.light), dark: sanitizeMap(obj.dark) }
  } catch {
    return null
  }
}

/** 读取指定深浅色的覆盖；无覆盖或存储损坏返回 null。 */
export function loadThemeStudioOverrides(scheme: ColorScheme): ThemeStudioOverrideMap | null {
  const store = readStore()
  if (!store) return null
  const map = store[scheme]
  return Object.keys(map).length > 0 ? map : null
}

/** 仅写当前深浅色分组；另一组保持不动。 */
export function saveThemeStudioOverrides(scheme: ColorScheme, map: ThemeStudioOverrideMap): void {
  try {
    const prev = readStore() ?? { light: {}, dark: {} }
    const next: ThemeStudioStore = { light: prev.light, dark: prev.dark }
    const clean = sanitizeMap(map)
    if (Object.keys(clean).length > 0) next[scheme] = clean
    else delete next[scheme]
    window.localStorage.setItem(THEME_STUDIO_OVERRIDES_KEY, JSON.stringify(next))
  } catch {
    /* 存储不可用时保持内存态，刷新后回落默认主题 */
  }
}

/** 当前覆盖总数（浅色 + 深色），供「已定制 N 项」展示。 */
export function countThemeStudioOverrides(): number {
  const store = readStore()
  if (!store) return 0
  return Object.keys(store.light).length + Object.keys(store.dark).length
}


/**
 * 确定性应用：逐键写入有效覆盖；无覆盖的键回写基础值（缺基础值时移除）。
 * 最终状态只取决于 map，与调用前的变量状态无关。返回实际覆盖数。
 */
export function applyOverrideMap(
  map: ThemeStudioOverrideMap | null,
  root: HTMLElement = document.documentElement,
  baseValues?: Record<string, string>,
): number {
  let applied = 0
  for (const key of EDITABLE_COLOR_KEYS) {
    const override = map != null ? map[key] : undefined
    if (isThemeStudioEditableKey(key) && isValidThemeStudioStoredValue(key, override)) {
      root.style.setProperty(themeStudioCssVarName(key), String(override).trim())
      applied += 1
      continue
    }
    const base = baseValues?.[key]
    if (typeof base === 'string' && base !== '') {
      root.style.setProperty(themeStudioCssVarName(key), base)
    } else {
      root.style.removeProperty(themeStudioCssVarName(key))
    }
  }
  return applied
}

export function clearThemeStudioOverrides(root: HTMLElement = document.documentElement): void {
  for (const key of EDITABLE_COLOR_KEYS) root.style.removeProperty(themeStudioCssVarName(key))
}

/** 读取存储并应用当前深浅色的覆盖层；存储异常不会影响主主题。 */
export function applyThemeStudioOverrides(
  scheme: ColorScheme,
  appearance: AppearanceType = 'opptrix',
  root: HTMLElement = document.documentElement,
): void {
  try {
    applyOverrideMap(loadThemeStudioOverrides(scheme), root, getCssVarValues(scheme, appearance))
  } catch {
    try {
      clearThemeStudioOverrides(root)
    } catch {
      /* 彻底兜底：覆盖层永不阻断主主题 */
    }
  }
}

/** 面板刷新通道：先铺基础变量，再叠加覆盖层（幂等）。 */
export function applyThemeStudioScheme(
  scheme: ColorScheme,
  appearance: AppearanceType,
  root: HTMLElement = document.documentElement,
): void {
  applyCssVars(scheme, appearance, root)
  applyThemeStudioOverrides(scheme, appearance, root)
}

/** `applyTheme` 尾部入口（语义别名）：主主题铺底后重放覆盖层。 */
export function applyThemeStudioOverlay(
  scheme: ColorScheme,
  appearance: AppearanceType = 'opptrix',
  root: HTMLElement = document.documentElement,
): void {
  applyThemeStudioOverrides(scheme, appearance, root)
}

/** 单键实时写入（面板 rAF 节流调用）。 */
export function setThemeStudioVar(
  key: string,
  value: string,
  root: HTMLElement = document.documentElement,
): void {
  if (!isThemeStudioEditableKey(key)) return
  root.style.setProperty(themeStudioCssVarName(key), value.trim())
}

/** 单键还原到基础值（不含存储，存储由调用方处理）。 */
export function resetThemeStudioVar(
  key: string,
  scheme: ColorScheme,
  appearance: AppearanceType,
  root: HTMLElement = document.documentElement,
): void {
  if (!isThemeStudioEditableKey(key)) return
  root.style.setProperty(themeStudioCssVarName(key), getCssVarValues(scheme, appearance)[key] ?? '')
}


/** 从存储构建主题文件；两组皆空时仅含版本号。 */
export function buildThemeStudioFile(): ThemeStudioFile {
  const store = readStore() ?? { light: {}, dark: {} }
  const file: ThemeStudioFile = { version: THEME_STUDIO_FILE_VERSION }
  if (Object.keys(store.light).length > 0) file.light = store.light
  if (Object.keys(store.dark).length > 0) file.dark = store.dark
  return file
}

export type ThemeStudioParseResult =
  | { ok: true; file: ThemeStudioFile; ignoredCount: number }
  | { ok: false; error: string }

/** 解析导入文件：校验版本与结构；未知键、非法值跳过并计数，不抛异常。 */
export function parseThemeStudioFile(json: string): ThemeStudioParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, error: '无法读取这份文件，请确认选择的是「导出主题」生成的文件。' }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: '文件内容不完整，缺少可用的主题信息。' }
  }
  const obj = parsed as Record<string, unknown>
  if (obj.version !== THEME_STUDIO_FILE_VERSION) {
    return { ok: false, error: '这份主题文件来自其他版本，暂时无法在此使用。' }
  }
  let ignoredCount = 0
  const file: ThemeStudioFile = { version: THEME_STUDIO_FILE_VERSION }
  for (const scheme of ['light', 'dark'] as const) {
    const raw = obj[scheme]
    if (raw === undefined) continue
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, error: '文件内容不完整，缺少可用的主题信息。' }
    }
    const map = collectValidOverrides(raw, () => {
      ignoredCount += 1
    })
    if (Object.keys(map).length > 0) file[scheme] = map
  }
  return { ok: true, file, ignoredCount }
}

function collectValidOverrides(
  raw: object,
  onSkip: () => void,
): ThemeStudioOverrideMap {
  const map: ThemeStudioOverrideMap = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isThemeStudioEditableKey(key) || !isValidThemeStudioStoredValue(key, value)) {
      onSkip()
      continue
    }
    map[key] = String(value).trim()
  }
  return map
}

/** 持久化整份主题文件（两组一起写入）。 */
export function saveThemeStudioFile(file: ThemeStudioFile): void {
  saveThemeStudioOverrides('light', file.light ?? {})
  saveThemeStudioOverrides('dark', file.dark ?? {})
}

/** 导出主题文件并触发浏览器下载；失败返回 false。 */
export function downloadThemeStudioFile(): boolean {
  try {
    const payload = JSON.stringify(buildThemeStudioFile(), null, 2)
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `opptrix-theme-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
  } catch {
    return false
  }
}
