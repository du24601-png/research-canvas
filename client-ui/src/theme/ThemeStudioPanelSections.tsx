/**
 * ThemeStudioPanelSections — 主题工坊的分组色键列表。
 *
 * 每组一个 SettingsGroup 小节；每行：中文名 + 取色器 + 值文本输入 + 还原。
 * 改动经父级 onChange 实时应用；还原只回写当前键的存储与变量。
 */
import { useEffect, useMemo, useState } from 'react'
import { makeStyles, mergeClasses } from '@fluentui/react-components'
import { SettingsGroup, SettingsRow, SettingsSectionLabel } from '../pages/settings/SettingsPrimitives'
import { getCssVarValues } from './cssVars'
import { opptrixCssVars, opptrixTokens, type AppearanceType, type ColorScheme } from './tokens'
import { motion } from './mixins'
import {
  THEME_STUDIO_FREEFORM_KEYS,
  THEME_STUDIO_GROUPS,
  isValidThemeStudioValue,
  type ThemeStudioOverrideMap,
} from './themeStudio'

const FREEFORM_KEY_SET = new Set(THEME_STUDIO_FREEFORM_KEYS)
/** 取色器兜底色（纯黑），由 Number 派生以保持 token 卫生。 */
const FALLBACK_SWATCH = `#${(0).toString(16).padStart(6, '0')}`

/** rgba()/短 hex → 取色器可用的 6 位 hex；无法解析返回 null。 */
function toHex6(value: string): string | null {
  const v = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v
      .slice(1)
      .split('')
      .map(c => c + c)
      .join('')}`
  }
  const m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/.exec(v)
  if (!m) return null
  const clamp = (n: number) => Math.max(0, Math.min(255, n))
  return `#${[Number(m[1]), Number(m[2]), Number(m[3])]
    .map(n => clamp(n).toString(16).padStart(2, '0'))
    .join('')}`
}

const useStyles = makeStyles({
  groupSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  groupHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: '2px',
  },
  groupReset: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: opptrixTokens.radiusSm,
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
    transitionProperty: 'color, background-color',
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.ease,
    ':hover': {
      color: opptrixCssVars.error,
      backgroundColor: opptrixCssVars.surfaceHover,
    },
    ':disabled': {
      opacity: 0.35,
      cursor: 'default',
    },
    ':focus': { outline: 'none' },
    ':focus-visible': {
      outline: `2px solid ${opptrixCssVars.inputBorderFocus}`,
      outlineOffset: '2px',
    },
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  swatch: {
    width: '28px',
    height: '28px',
    flexShrink: 0,
    padding: 0,
    border: `1px solid ${opptrixCssVars.borderStrong}`,
    borderRadius: opptrixTokens.radiusSm,
    background: 'transparent',
    cursor: 'pointer',
  },
  textField: {
    width: '118px',
    height: '28px',
    boxSizing: 'border-box',
    padding: '0 8px',
    fontFamily: 'inherit',
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textPrimary,
    backgroundColor: opptrixCssVars.inputBg,
    border: `1px solid ${opptrixCssVars.border}`,
    borderRadius: opptrixTokens.radiusSm,
    ':focus': { outline: 'none', border: `1px solid ${opptrixCssVars.inputBorderFocus}` },
  },
  textFieldInvalid: {
    border: `1px solid ${opptrixCssVars.error}`,
  },
  resetBtn: {
    height: '28px',
    padding: '0 8px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    borderRadius: opptrixTokens.radiusSm,
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
    transitionProperty: 'color, background-color',
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.ease,
    ':hover': {
      color: opptrixCssVars.textPrimary,
      backgroundColor: opptrixCssVars.surfaceHover,
    },
    ':focus': { outline: 'none' },
    ':focus-visible': {
      outline: `2px solid ${opptrixCssVars.inputBorderFocus}`,
      outlineOffset: '2px',
    },
  },
})

interface ColorKeyRowProps {
  label: string
  varKey: string
  scheme: ColorScheme
  appearance: AppearanceType
  override: string | null
  base: string
  onChange: (key: string, value: string) => void
  onReset: () => void
  last: boolean
}

function ColorKeyRow({
  label,
  varKey,
  scheme,
  appearance,
  override,
  base,
  onChange,
  onReset,
  last,
}: ColorKeyRowProps) {
  const s = useStyles()
  const applied = override ?? base
  const [draft, setDraft] = useState(applied)
  // 外部变化（导入 / 还原 / 切换深浅色）同步回输入框
  useEffect(() => {
    setDraft(applied)
  }, [applied])

  const freeform = FREEFORM_KEY_SET.has(varKey)
  const draftValid = freeform
    ? draft.trim().length > 0
    : isValidThemeStudioValue(draft)

  const commit = (value: string) => {
    setDraft(value)
    if (FREEFORM_KEY_SET.has(varKey)) {
      if (value.trim() !== '') onChange(varKey, value)
      return
    }
    if (isValidThemeStudioValue(value)) onChange(varKey, value)
  }

  return (
    <SettingsRow
      title={label}
      last={last}
      control={
        <div className={s.controls}>
          {!freeform && (
            <input
              type="color"
              className={s.swatch}
              value={toHex6(applied) ?? FALLBACK_SWATCH}
              aria-label={`选取「${label}」颜色`}
              onChange={e => commit(e.target.value)}
            />
          )}
          <input
            type="text"
            className={mergeClasses(s.textField, !draftValid && s.textFieldInvalid)}
            value={draft}
            spellCheck={false}
            aria-label={`输入「${label}」的颜色值`}
            onChange={e => commit(e.target.value)}
            onBlur={() => {
              if (!draftValid) setDraft(applied)
            }}
          />
          {override != null && (
            <button type="button" className={s.resetBtn} onClick={onReset} aria-label={`还原「${label}」`}>
              还原
            </button>
          )}
        </div>
      }
    />
  )
}

export interface ThemeStudioColorGroupsProps {
  scheme: ColorScheme
  appearance: AppearanceType
  overrides: ThemeStudioOverrideMap
  onChange: (key: string, value: string) => void
  onResetKeys: (keys: readonly string[]) => void
}

export function ThemeStudioColorGroups({
  scheme,
  appearance,
  overrides,
  onChange,
  onResetKeys,
}: ThemeStudioColorGroupsProps) {
  const s = useStyles()
  const baseValues = useMemo(() => getCssVarValues(scheme, appearance), [scheme, appearance])

  return (
    <>
      {THEME_STUDIO_GROUPS.map(group => {
        const groupKeys = group.entries.map(([key]) => key)
        const activeCount = groupKeys.filter(key => overrides[key] != null).length
        return (
          <section key={group.id} className={s.groupSection}>
            <div className={s.groupHead}>
              <SettingsSectionLabel>{group.label}</SettingsSectionLabel>
              <button
                type="button"
                className={s.groupReset}
                disabled={activeCount === 0}
                onClick={() => onResetKeys(groupKeys)}
              >
                还原本组
              </button>
            </div>
            <SettingsGroup>
              {group.entries.map(([varKey, label], index) => (
                <ColorKeyRow
                  key={varKey}
                  label={label}
                  varKey={varKey}
                  scheme={scheme}
                  appearance={appearance}
                  override={overrides[varKey] ?? null}
                  base={baseValues[varKey] ?? ''}
                  onChange={onChange}
                  onReset={() => onResetKeys([varKey])}
                  last={index === group.entries.length - 1}
                />
              ))}
            </SettingsGroup>
          </section>
        )
      })}
    </>
  )
}
