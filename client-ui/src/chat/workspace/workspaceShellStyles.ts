import { makeStyles } from '@fluentui/react-components'
import { opptrixCssVars } from '../../theme/tokens'
import {
  DESKTOP_SIDEBAR_LAYOUT_MS,
  DESKTOP_SIDEBAR_LAYOUT_EASE,
  DESKTOP_TITLEBAR_HEIGHT,
  DESKTOP_Z_TITLE,
} from '../../desktop/constants'

/**
 * 布局/壳域共享样式（原 ChatApp useStyles 的工作区部分）。
 * root / rootLayout 仍留在 ChatApp。
 */
export const useWorkspaceShellStyles = makeStyles({
  /** Shared parent of chat + right panel — peer to SessionSidebar */
  contentWorkspace: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    height: '100%',
    display: 'flex',
    flexDirection: 'row',
    overflow: 'hidden',
    transitionProperty: 'padding',
    transitionDuration: `${DESKTOP_SIDEBAR_LAYOUT_MS}ms`,
    transitionTimingFunction: DESKTOP_SIDEBAR_LAYOUT_EASE,
  },
  /** Mobile：裁切视口；内层 track 整段 translate（主列不被挤压） */
  contentWorkspaceMobile: {
    flexDirection: 'row',
    position: 'relative',
    overflow: 'hidden',
  },
  contentWorkspaceElectron: {
    paddingTop: `${DESKTOP_TITLEBAR_HEIGHT}px`,
  },
  /** [drawer | main | right?] 固定宽滑轨 */
  mobileSlideTrack: {
    display: 'flex',
    flexDirection: 'row',
    flexShrink: 0,
    height: '100%',
    willChange: 'transform',
    transitionProperty: 'transform',
    transitionDuration: `${DESKTOP_SIDEBAR_LAYOUT_MS}ms`,
    transitionTimingFunction: DESKTOP_SIDEBAR_LAYOUT_EASE,
    '@media (prefers-reduced-motion: reduce)': {
      transitionDuration: '1ms',
    },
  },
  /** 主列：恒为视口宽，随轨平移 */
  mobileSlideMain: {
    flexShrink: 0,
    height: '100%',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  /** 右栏：恒为视口宽，挂在轨上 */
  mobileRightSheet: {
    flexShrink: 0,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: opptrixCssVars.canvas,
    boxSizing: 'border-box',
    paddingTop: 'env(safe-area-inset-top)',
    paddingRight: 'env(safe-area-inset-right)',
    paddingBottom: 'env(safe-area-inset-bottom)',
    paddingLeft: 'env(safe-area-inset-left)',
  },
  mobileRightSheetInner: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    '& > *': {
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      height: '100%',
    },
  },
  chatColumn: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transitionProperty: 'width, min-width',
    transitionDuration: `${DESKTOP_SIDEBAR_LAYOUT_MS}ms`,
    transitionTimingFunction: DESKTOP_SIDEBAR_LAYOUT_EASE,
  },
  chatColumnDragging: {
    transitionProperty: 'none',
  },
  chatColumnElectron: {
    marginTop: `-${DESKTOP_TITLEBAR_HEIGHT}px`,
    height: `calc(100% + ${DESKTOP_TITLEBAR_HEIGHT}px)`,
    boxSizing: 'border-box',
  },
  /** Occupies the title-bar band; title text renders in DesktopWindowChrome over this slot */
  chatTitleBar: {
    flexShrink: 0,
    height: `${DESKTOP_TITLEBAR_HEIGHT}px`,
    boxSizing: 'border-box',
    backgroundColor: opptrixCssVars.canvas,
    borderBottom: `1px solid ${opptrixCssVars.separatorStrong}`,
    position: 'relative',
    zIndex: DESKTOP_Z_TITLE,
  },
  chatPanel: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: opptrixCssVars.canvas,
    borderRadius: 0,
    overflow: 'hidden',
  },
  settingsHost: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    width: '100%',
    display: 'flex',
    backgroundColor: 'transparent',
  },
  viewHidden: {
    display: 'none',
  },
})
