import { useEffect } from 'react'
import { makeStyles, mergeClasses, Text } from '@fluentui/react-components'
import {
  DESKTOP_SIDEBAR_LAYOUT_EASE,
  DESKTOP_SIDEBAR_LAYOUT_MS,
  DESKTOP_TITLEBAR_HEIGHT,
  DESKTOP_Z_OVERLAY_SIDEBAR,
} from '../../desktop/constants'
import { opptrixCssVars } from '../../theme/tokens'
import ResearchCanvas from '../research-canvas/ResearchCanvas'
import { useWorkspaceUi } from '../workspace/WorkspaceUiContext'
import { usePinBoard } from './PinBoardContext'

const DOCK_WIDTH = 'clamp(360px, 36vw, 520px)'

const useStyles = makeStyles({
  shade: {
    position: 'fixed',
    inset: 0,
    zIndex: DESKTOP_Z_OVERLAY_SIDEBAR,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  overlay: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: 'min(760px, 100vw)',
    zIndex: DESKTOP_Z_OVERLAY_SIDEBAR + 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: opptrixCssVars.canvas,
    borderLeft: `1px solid ${opptrixCssVars.separator}`,
    boxShadow: opptrixCssVars.composerFloatShadow,
    transform: 'translate3d(0, 0, 0)',
    transitionProperty: 'transform, visibility',
    transitionDuration: '220ms',
    transitionTimingFunction: 'ease-out',
    '@media (prefers-reduced-motion: reduce)': { transitionDuration: '0ms' },
  },
  overlayPresent: { width: '100vw', borderLeft: 'none' },
  overlayClosed: {
    transform: 'translate3d(100%, 0, 0)',
    visibility: 'hidden',
  },
  dock: {
    flex: '0 0 auto',
    display: 'flex',
    flexDirection: 'row',
    alignSelf: 'stretch',
    minWidth: 0,
    minHeight: 0,
    height: '100%',
    boxSizing: 'border-box',
    backgroundColor: opptrixCssVars.canvas,
    borderLeft: `1px solid ${opptrixCssVars.separator}`,
    overflow: 'hidden',
    transitionProperty: 'width, flex-basis',
    transitionDuration: `${DESKTOP_SIDEBAR_LAYOUT_MS}ms`,
    transitionTimingFunction: DESKTOP_SIDEBAR_LAYOUT_EASE,
    '@media (prefers-reduced-motion: reduce)': { transitionDuration: '0ms' },
  },
  dockClosed: { width: 0, flexBasis: 0, borderLeftWidth: 0 },
  dockOpen: { width: DOCK_WIDTH, flexBasis: DOCK_WIDTH },
  dockPresent: {
    position: 'fixed',
    inset: 0,
    width: '100vw',
    flexBasis: 'auto',
    zIndex: DESKTOP_Z_OVERLAY_SIDEBAR + 1,
    borderLeft: 'none',
  },
  dockElectron: {
    marginTop: `-${DESKTOP_TITLEBAR_HEIGHT}px`,
    height: `calc(100% + ${DESKTOP_TITLEBAR_HEIGHT}px)`,
    boxSizing: 'border-box',
  },
  panel: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  /** 收起时画布仍挂载，才能接着收数据集并落盘 */
  panelClosed: {
    width: 0,
    overflow: 'hidden',
    visibility: 'hidden',
  },
  header: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '10px 12px 6px 16px',
  },
  title: { fontSize: 'var(--opptrix-font-xxl)', fontWeight: 600, color: opptrixCssVars.textPrimary },
  body: { flex: 1, minHeight: 0, overflow: 'hidden' },
})

export interface PinBoardDrawerProps {
  sessionId: string | null
  sessionTitle?: string
  /** dock：桌面右侧边栏，由顶栏图标开关。overlay：手机浮层。 */
  placement?: 'dock' | 'overlay'
}

/** 看板：复用研究画布与其持久化；聊天预览经用户点「钉住」写入。 */
export default function PinBoardDrawer({
  sessionId,
  sessionTitle,
  placement = 'dock',
}: PinBoardDrawerProps) {
  const s = useStyles()
  const { open, closeBoard } = usePinBoard()
  const { presentMode, electronChrome } = useWorkspaceUi()
  const dock = placement === 'dock'
  const expanded = open || presentMode

  useEffect(() => {
    if (!open) return () => {}
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeBoard()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, closeBoard])

  const panel = (
    <div className={mergeClasses(s.panel, dock && !expanded && s.panelClosed)} aria-hidden={dock && !expanded} inert={dock && !expanded}>
      <div className={s.header}>
        <Text className={s.title}>看板</Text>
      </div>
      <div className={s.body}>
        <ResearchCanvas sessionId={sessionId} sessionTitle={sessionTitle} />
      </div>
    </div>
  )

  if (!dock) {
    return (
      <>
        {open && !presentMode ? <div className={s.shade} onClick={closeBoard} aria-hidden data-pin-board-shade /> : null}
        <aside
          className={mergeClasses(s.overlay, open && presentMode && s.overlayPresent, !open && s.overlayClosed)}
          role="dialog"
          aria-modal={open}
          aria-label="看板"
          aria-hidden={!open}
          inert={!open}
          data-pin-board={open ? 'open' : 'closed'}
        >
          {panel}
        </aside>
      </>
    )
  }

  return (
    <aside
      className={mergeClasses(
        s.dock,
        expanded ? s.dockOpen : s.dockClosed,
        presentMode && s.dockPresent,
        electronChrome && !presentMode && s.dockElectron,
      )}
      aria-label="看板"
      data-pin-board={expanded ? 'open' : 'closed'}
    >
      {panel}
    </aside>
  )
}
