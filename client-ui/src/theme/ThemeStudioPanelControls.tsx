/**
 * ThemeStudioPanelControls — 主题工坊预览控制区。
 *
 * 深浅色 / 设计语言 / 字号大小三段预览：切换即改变全应用实时外观，
 * 同时决定后续颜色编辑的目标分组（深浅色）与基础值（设计语言）。
 */
import { makeStyles } from '@fluentui/react-components'
import { SettingsHint, SettingsModeTabs, SettingsSectionLabel } from '../pages/settings/SettingsPrimitives'
import type { AppearanceType, ThemePreference } from './tokens'
import {
  FONT_SCALE_LABELS,
  FONT_SCALE_OPTIONS,
  type FontScaleName,
} from './fontScale'

const useStyles = makeStyles({
  controlBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
})

export interface ThemeStudioPanelControlsProps {
  preference: ThemePreference
  appearance: AppearanceType
  fontScale: FontScaleName
  onPreferenceChange: (next: ThemePreference) => void
  onAppearanceChange: (next: AppearanceType) => void
  onFontScaleChange: (next: FontScaleName) => void
}

export function ThemeStudioPanelControls({
  preference,
  appearance,
  fontScale,
  onPreferenceChange,
  onAppearanceChange,
  onFontScaleChange,
}: ThemeStudioPanelControlsProps) {
  const s = useStyles()
  return (
    <>
      <div className={s.controlBlock}>
        <SettingsSectionLabel>深浅色</SettingsSectionLabel>
        <SettingsModeTabs
          value={preference}
          onChange={onPreferenceChange}
          ariaLabel="切换深浅色预览"
          items={[
            { id: 'system', label: '跟随系统' },
            { id: 'light', label: '浅色' },
            { id: 'dark', label: '深色' },
          ]}
        />
        {preference === 'system' && (
          <SettingsHint>正在跟随系统深浅变化；选择浅色或深色后会固定下来。</SettingsHint>
        )}
      </div>

      <div className={s.controlBlock}>
        <SettingsSectionLabel>设计语言</SettingsSectionLabel>
        <SettingsModeTabs
          value={appearance}
          onChange={onAppearanceChange}
          ariaLabel="切换设计语言预览"
          items={[
            { id: 'opptrix', label: '经典' },
            { id: 'ios', label: 'iOS' },
          ]}
        />
      </div>

      <div className={s.controlBlock}>
        <SettingsSectionLabel>字号大小</SettingsSectionLabel>
        <SettingsModeTabs
          value={fontScale}
          onChange={onFontScaleChange}
          ariaLabel="调整字号大小"
          wrap
          items={FONT_SCALE_OPTIONS.map(id => ({ id, label: FONT_SCALE_LABELS[id] }))}
        />
      </div>
    </>
  )
}
