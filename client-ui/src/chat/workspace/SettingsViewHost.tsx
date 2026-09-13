import { lazy, Suspense } from 'react'
import { mergeClasses } from '@fluentui/react-components'
import type { SettingsSection } from '../../pages/settings/SettingsSidebar'
import { useElectronFullscreen } from '../../hooks/useElectronFullscreen'
import { desktopChromeToolbarReserve } from '../../desktop/layout'
import { useWorkspaceUi } from './WorkspaceUiContext'
import { useWorkspaceShellStyles } from './workspaceShellStyles'

/** 设置页按路由 chunk 懒加载（Suspense fallback=null，隐藏期不闪白） */
const SettingsPage = lazy(() => import('../../pages/SettingsPage'))

export interface SettingsViewHostProps {
  isMobile: boolean
  initialSection?: SettingsSection
  onSectionChange: (section: SettingsSection) => void
  onBack: () => void
  onSaved: () => void
  onSidebarClose: () => void
}

/** 设置视图宿主：settingsHost 容器 + SettingsPage（侧栏几何来自全局工作区状态） */
export function SettingsViewHost({
  isMobile,
  initialSection,
  onSectionChange,
  onBack,
  onSaved,
  onSidebarClose,
}: SettingsViewHostProps) {
  const s = useWorkspaceShellStyles()
  const {
    electronChrome,
    settingsSidebarVisible,
    settingsSidebarWidth,
    settingsSidebarDragging,
    beginSettingsSidebarDrag,
  } = useWorkspaceUi()
  const macFullscreen = useElectronFullscreen()

  return (
    <div className={mergeClasses(s.settingsHost, electronChrome && 'opptrix-settings-host')}>
      <Suspense fallback={null}>
        <SettingsPage
          isMobile={isMobile}
          sidebarVisible={settingsSidebarVisible}
          onSidebarClose={onSidebarClose}
          onBack={onBack}
          initialSection={initialSection}
          onSectionChange={onSectionChange}
          chromeToolbarReserve={electronChrome ? desktopChromeToolbarReserve(macFullscreen) : 0}
          sidebarWidth={settingsSidebarWidth}
          sidebarDragging={settingsSidebarDragging}
          onBeginSidebarDrag={beginSettingsSidebarDrag}
          onSaved={onSaved}
        />
      </Suspense>
    </div>
  )
}
