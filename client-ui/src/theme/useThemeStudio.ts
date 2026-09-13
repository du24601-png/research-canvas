/**
 * useThemeStudio — 主题工坊无头编排 hook（L2，零样式 JSX）。
 *
 * 收敛面板全部状态与行为：显隐记忆与 URL 唤起、覆盖值实时应用
 * （rAF 节流 + 300ms 防抖落盘）、深浅色/设计语言/字号预览切换、
 * 导出/导入文件、单键/分组/全部还原。
 * UI 见 `ThemeStudioPanel.tsx`。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from './ThemeContext'
import { getCssVarValues } from './cssVars'
import {
  applyFontScale,
  readFontScalePreference,
  writeFontScalePreference,
  type FontScaleName,
} from './fontScale'
import { useOpptrixDialogAlert } from '../components/opptrix/OpptrixDialogAlert'
import type { AppearanceType, ThemePreference } from './tokens'
import {
  applyThemeStudioScheme,
  countThemeStudioOverrides,
  downloadThemeStudioFile,
  loadThemeStudioOverrides,
  parseThemeStudioFile,
  readThemeStudioOpenFlag,
  resolveThemeStudioUrlIntent,
  saveThemeStudioFile,
  saveThemeStudioOverrides,
  setThemeStudioVar,
  writeThemeStudioOpenFlag,
  type ThemeStudioOverrideMap,
} from './themeStudio'
import type { ThemeStudioNote } from './ThemeStudioPanelFooter'

const PERSIST_DEBOUNCE_MS = 300
const NOTE_DURATION_MS = 4000

/** 清理地址栏中的唤起参数，避免刷新重复触发。 */
function stripStudioUrlParam(): void {
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('theme-studio')) return
    url.searchParams.delete('theme-studio')
    window.history.replaceState(null, '', url.toString())
  } catch {
    /* 地址栏清理失败不影响面板 */
  }
}

export function useThemeStudio() {
  const { preference, resolvedScheme, appearance, setPreference, setAppearance } = useTheme()
  const dialog = useOpptrixDialogAlert()

  const [open, setOpen] = useState<boolean>(() => {
    const raw = new URLSearchParams(window.location.search).get('theme-studio')
    const intent = resolveThemeStudioUrlIntent(raw)
    if (intent === 'open') {
      writeThemeStudioOpenFlag(true)
      return true
    }
    if (intent === 'close') {
      writeThemeStudioOpenFlag(false)
      return false
    }
    return readThemeStudioOpenFlag()
  })
  const [overrides, setOverrides] = useState<ThemeStudioOverrideMap>(
    () => loadThemeStudioOverrides(resolvedScheme) ?? {},
  )
  const [fontScale, setFontScale] = useState<FontScaleName>(() => readFontScalePreference())
  const [note, setNote] = useState<ThemeStudioNote | null>(null)
  const [count, setCount] = useState(() => countThemeStudioOverrides())

  // 渲染期镜像，保证 rAF / 防抖回调读到最新值
  const overridesRef = useRef(overrides)
  const schemeRef = useRef(resolvedScheme)
  const appearanceRef = useRef(appearance)
  overridesRef.current = overrides
  schemeRef.current = resolvedScheme
  appearanceRef.current = appearance

  const baseValues = useMemo(
    () => getCssVarValues(resolvedScheme, appearance),
    [resolvedScheme, appearance],
  )
  const baseValuesRef = useRef(baseValues)
  baseValuesRef.current = baseValues

  const pendingVarsRef = useRef<Map<string, string>>(new Map())
  const rafRef = useRef<number | null>(null)
  const persistTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current)
      if (persistTimerRef.current != null) window.clearTimeout(persistTimerRef.current)
    }
  }, [])

  const persistNow = useCallback(() => {
    if (persistTimerRef.current != null) {
      window.clearTimeout(persistTimerRef.current)
      persistTimerRef.current = null
    }
    saveThemeStudioOverrides(schemeRef.current, overridesRef.current)
  }, [])

  const schedulePersist = useCallback(() => {
    if (persistTimerRef.current != null) window.clearTimeout(persistTimerRef.current)
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null
      saveThemeStudioOverrides(schemeRef.current, overridesRef.current)
    }, PERSIST_DEBOUNCE_MS)
  }, [])

  // 切换编辑目标（深浅色）时载入对应分组
  useEffect(() => {
    setOverrides(loadThemeStudioOverrides(resolvedScheme) ?? {})
  }, [resolvedScheme])

  useEffect(() => {
    setCount(countThemeStudioOverrides())
  }, [overrides])

  useEffect(() => {
    if (!note) return
    const timer = window.setTimeout(() => setNote(null), NOTE_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [note])

  const close = useCallback(() => {
    persistNow()
    writeThemeStudioOpenFlag(false)
    stripStudioUrlParam()
    setOpen(false)
  }, [persistNow])

  /** 还原若干键：更新存储并重铺基础值 + 剩余覆盖。 */
  const resetKeys = useCallback((keys: readonly string[]) => {
    const keySet = new Set(keys)
    const next: ThemeStudioOverrideMap = { ...overridesRef.current }
    for (const key of keySet) delete next[key]
    overridesRef.current = next
    setOverrides(next)
    saveThemeStudioOverrides(schemeRef.current, next)
    applyThemeStudioScheme(schemeRef.current, appearanceRef.current)
  }, [])

  /** 单键改动：等于基础值即视为还原；否则 rAF 节流实时应用 + 防抖落盘。 */
  const handleChange = useCallback(
    (key: string, value: string) => {
      const trimmed = value.trim()
      if (trimmed === baseValuesRef.current[key]) {
        resetKeys([key])
        return
      }
      overridesRef.current = { ...overridesRef.current, [key]: trimmed }
      setOverrides(overridesRef.current)
      pendingVarsRef.current.set(key, trimmed)
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null
          for (const [k, v] of pendingVarsRef.current) setThemeStudioVar(k, v)
          pendingVarsRef.current.clear()
        })
      }
      schedulePersist()
    },
    [resetKeys, schedulePersist],
  )

  // 预览切换前先落盘，避免未保存改动跟随旧目标丢失
  const changePreference = useCallback(
    (next: ThemePreference) => {
      persistNow()
      setPreference(next)
    },
    [persistNow, setPreference],
  )

  const changeAppearance = useCallback(
    (next: AppearanceType) => {
      persistNow()
      setAppearance(next)
    },
    [persistNow, setAppearance],
  )

  const changeFontScale = useCallback((next: FontScaleName) => {
    writeFontScalePreference(next)
    applyFontScale(next)
    setFontScale(next)
  }, [])

  const handleExport = useCallback(() => {
    persistNow()
    const ok = downloadThemeStudioFile()
    setNote(
      ok
        ? { tone: 'success', text: '主题文件已开始下载。' }
        : { tone: 'error', text: '导出没有成功，请再试一次。' },
    )
  }, [persistNow])

  const handleImportFile = useCallback(async (file: File) => {
    try {
      const result = parseThemeStudioFile(await file.text())
      if (!result.ok) {
        setNote({ tone: 'error', text: result.error })
        return
      }
      saveThemeStudioFile(result.file)
      const next = loadThemeStudioOverrides(schemeRef.current) ?? {}
      overridesRef.current = next
      setOverrides(next)
      applyThemeStudioScheme(schemeRef.current, appearanceRef.current)
      setNote(
        result.ignoredCount > 0
          ? { tone: 'success', text: `主题已应用；有 ${result.ignoredCount} 项无法识别，已跳过。` }
          : { tone: 'success', text: '主题已应用，两侧深浅色均已更新。' },
      )
    } catch {
      setNote({ tone: 'error', text: '读取文件时出现问题，请重试一次。' })
    }
  }, [])

  const resetAll = useCallback(async () => {
    const confirmed = await dialog.confirm({
      title: '还原全部定制？',
      message: '浅色与深色下修改过的颜色都会恢复默认，此操作无法撤销。',
      confirmLabel: '全部还原',
      confirmTone: 'danger',
    })
    if (!confirmed) return
    saveThemeStudioOverrides('light', {})
    saveThemeStudioOverrides('dark', {})
    overridesRef.current = {}
    setOverrides({})
    applyThemeStudioScheme(schemeRef.current, appearanceRef.current)
    setNote({ tone: 'success', text: '已恢复默认主题。' })
  }, [dialog])

  return {
    open,
    close,
    preference,
    resolvedScheme,
    appearance,
    fontScale,
    overrides,
    note,
    count,
    changePreference,
    changeAppearance,
    changeFontScale,
    handleChange,
    resetKeys,
    handleExport,
    handleImportFile,
    resetAll,
  }
}
