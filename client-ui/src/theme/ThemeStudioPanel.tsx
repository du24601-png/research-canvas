/**
 * ThemeStudioPanel — 主题工坊面板（默认完全隐藏的维护工具）。
 *
 * 唤起：URL `?theme-studio=1` 打开并记忆；`=0` 或面板内「关闭」清除记忆。
 * 面板改动通过 `--opptrix-*` 变量全应用实时生效，并按深浅色分组持久化。
 * 挂载点：`App.tsx`（`SystemUpdateHost` 之后）。
 *
 * 状态与行为在无头 hook `useThemeStudio`；分区：
 * 预览控制 `ThemeStudioPanelControls`、色键列表 `ThemeStudioPanelSections`、
 * 底部操作 `ThemeStudioPanelFooter`。
 */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { makeStyles, mergeClasses, Text } from '@fluentui/react-components'
import { DismissRegular } from '@fluentui/react-icons'
import { opptrixCssVars } from './tokens'
import { designTokens } from './design-tokens'
import { OPPTRIX_GLASS_PANEL_CLASS, motion } from './mixins'
import OpptrixButton from '../components/opptrix/OpptrixButton'
import { ThemeStudioPanelControls } from './ThemeStudioPanelControls'
import { ThemeStudioPanelFooter } from './ThemeStudioPanelFooter'
import { ThemeStudioColorGroups } from './ThemeStudioPanelSections'
import { useThemeStudio } from './useThemeStudio'

const useStyles = makeStyles({
  panel: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: '360px',
    maxWidth: '100vw',
    zIndex: designTokens.Z.tooltip,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '14px 16px 10px',
    borderBottom: `1px solid ${opptrixCssVars.separator}`,
  },
  title: {
    fontSize: 'var(--opptrix-font-lg)',
    fontWeight: 500,
    color: opptrixCssVars.textPrimary,
    lineHeight: '20px',
  },
  target: {
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
    marginTop: '2px',
  },
  scroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '14px 16px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  fade: {
    transitionProperty: 'opacity',
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.ease,
  },
})

export function ThemeStudioPanel() {
  const s = useStyles()
  const studio = useThemeStudio()
  const {
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
  } = studio

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  return createPortal(
    <aside
      className={mergeClasses(OPPTRIX_GLASS_PANEL_CLASS, s.panel, s.fade)}
      role="dialog"
      aria-label="主题工坊"
    >
      <header className={s.header}>
        <div>
          <Text className={s.title} block>主题工坊</Text>
          <Text className={s.target} block>
            正在定制：{resolvedScheme === 'dark' ? '深色' : '浅色'}
          </Text>
        </div>
        <OpptrixButton
          variant="icon"
          icon={<DismissRegular />}
          aria-label="关闭并退出定制模式"
          title="关闭并退出定制模式"
          onClick={close}
        />
      </header>

      <div className={s.scroll}>
        <ThemeStudioPanelControls
          preference={preference}
          appearance={appearance}
          fontScale={fontScale}
          onPreferenceChange={changePreference}
          onAppearanceChange={changeAppearance}
          onFontScaleChange={changeFontScale}
        />
        <ThemeStudioColorGroups
          scheme={resolvedScheme}
          appearance={appearance}
          overrides={overrides}
          onChange={handleChange}
          onResetKeys={resetKeys}
        />
      </div>

      <ThemeStudioPanelFooter
        note={note}
        count={count}
        onExport={handleExport}
        onImportFile={file => void handleImportFile(file)}
        onResetAll={() => void resetAll()}
      />
    </aside>,
    document.body,
  )
}
