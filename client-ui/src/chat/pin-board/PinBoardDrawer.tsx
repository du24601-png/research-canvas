import { useEffect, useRef } from 'react'
import { makeStyles, mergeClasses, Text } from '@fluentui/react-components'
import { DismissRegular } from '@fluentui/react-icons'
import OpptrixButton from '../../components/opptrix/OpptrixButton'
import { DESKTOP_Z_OVERLAY_SIDEBAR } from '../../desktop/constants'
import { opptrixCssVars } from '../../theme/tokens'
import ResearchCanvas from '../research-canvas/ResearchCanvas'
import { useWorkspaceUi } from '../workspace/WorkspaceUiContext'
import { usePinBoard } from './PinBoardContext'

const useStyles = makeStyles({
  shade: {
    position: 'fixed',
    inset: 0,
    zIndex: DESKTOP_Z_OVERLAY_SIDEBAR,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  drawer: {
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
  /** 演示模式（画布工具栏进入）：看板铺满窗口 */
  drawerPresent: { width: '100vw', borderLeft: 'none' },
  /** 关闭时移出视口但保持挂载：画布要持续接收数据集事件并落盘，钉住才能成功 */
  drawerClosed: {
    transform: 'translate3d(100%, 0, 0)',
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
  note: {
    display: 'block',
    padding: '0 16px 8px',
    fontSize: 'var(--opptrix-font-md)',
    color: opptrixCssVars.textSecondary,
  },
  body: { flex: 1, minHeight: 0, overflow: 'hidden' },
})

export interface PinBoardDrawerProps {
  sessionId: string | null
  sessionTitle?: string
}

/** 看板抽屉：复用研究画布组件与其持久化；聊天预览经用户点「钉住」写入。 */
export default function PinBoardDrawer({ sessionId, sessionTitle }: PinBoardDrawerProps) {
  const s = useStyles()
  const { open, closeBoard } = usePinBoard()
  const { presentMode } = useWorkspaceUi()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return () => {}
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeBoard()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, closeBoard])

  return (
    <>
      {open && !presentMode ? <div className={s.shade} onClick={closeBoard} aria-hidden data-pin-board-shade /> : null}
      <aside
        className={mergeClasses(s.drawer, open && presentMode && s.drawerPresent, !open && s.drawerClosed)}
        role="dialog"
        aria-modal={open}
        aria-label="看板"
        aria-hidden={!open}
        inert={!open}
        data-pin-board={open ? 'open' : 'closed'}
      >
        <div className={s.header}>
          <Text className={s.title}>看板</Text>
          <OpptrixButton ref={closeRef} variant="ghost" size="small" icon={<DismissRegular />} onClick={closeBoard}>
            收起
          </OpptrixButton>
        </div>
        <Text className={s.note}>你在回答里点「钉住」的图表会收在这里，可以拖动排版、导出或删除。</Text>
        <div className={s.body}>
          <ResearchCanvas sessionId={sessionId} sessionTitle={sessionTitle} />
        </div>
      </aside>
    </>
  )
}
