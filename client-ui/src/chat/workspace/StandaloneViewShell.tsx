import { mergeClasses } from '@fluentui/react-components'
import type { ReactNode } from 'react'
import type { useMobileSlideStyles } from './WorkspaceUiContext'
import { useWorkspaceShellStyles } from './workspaceShellStyles'

export interface StandaloneViewShellProps {
  mounted: boolean
  active: boolean
  isMobile: boolean
  electronChrome: boolean
  drawerOpen: boolean
  closeDrawer: () => void
  /** 移动端滑轨左侧抽屉（仅 active 视图渲染，与原条件渲染等价） */
  drawerSidebar: ReactNode
  mobileTrackStyle: ReturnType<typeof useMobileSlideStyles>['trackStyle']
  mobileMainStyle: ReturnType<typeof useMobileSlideStyles>['mainStyle']
  page: ReactNode
}

/**
 * 独立视图（新闻/市场动态/社区/专家）的 keep-alive 壳：
 * contentWorkspace + viewHidden + aria-hidden + mobile 三段轨道 / desktop 聊天列。
 */
export function StandaloneViewShell({
  mounted,
  active,
  isMobile,
  electronChrome,
  drawerOpen,
  closeDrawer,
  drawerSidebar,
  mobileTrackStyle,
  mobileMainStyle,
  page,
}: StandaloneViewShellProps) {
  const s = useWorkspaceShellStyles()
  if (!mounted) return null
  return (
    <div
      className={mergeClasses(
        s.contentWorkspace,
        isMobile && s.contentWorkspaceMobile,
        electronChrome && s.contentWorkspaceElectron,
        electronChrome && 'opptrix-app-main',
        !active && s.viewHidden,
      )}
      aria-hidden={!active}
    >
      {isMobile ? (
        <div className={s.mobileSlideTrack} style={mobileTrackStyle}>
          {active ? drawerSidebar : null}
          <div
            className={mergeClasses(s.chatColumn, s.mobileSlideMain)}
            style={mobileMainStyle}
            onClick={drawerOpen ? closeDrawer : undefined}
          >
            {page}
          </div>
        </div>
      ) : (
        <div className={mergeClasses(s.chatColumn, electronChrome && s.chatColumnElectron)}>
          {page}
        </div>
      )}
    </div>
  )
}
