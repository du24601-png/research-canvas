import { makeStyles, mergeClasses } from '@fluentui/react-components'
import {
  DESKTOP_SIDEBAR_TOOL_ICON_PADDING,
  DESKTOP_SIDEBAR_TOOL_ICON_SIZE,
  DESKTOP_TITLEBAR_HEIGHT,
} from '../desktop/constants'
import ChromeToolButton from '../desktop/ChromeToolButton'
import {
  ArrowMaximizeRegular,
  ArrowMinimizeRegular,
  PanelRightContractRegular,
} from './chatIcons'
import { opptrixCssVars } from '../theme/tokens'
import { electronPlatform } from '../platform/detect'
import ResearchCanvas from './research-canvas/ResearchCanvas'

const useStyles = makeStyles({
  root: {
    height: '100%',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: opptrixCssVars.canvas,
  },
  rootElectron: {
    backgroundColor: 'transparent',
  },
  header: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '2px',
    minHeight: '36px',
    padding: '4px 8px',
    boxSizing: 'border-box',
  },
  headerElectron: {
    minHeight: `${DESKTOP_TITLEBAR_HEIGHT}px`,
  },
  body: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
})

export interface BlankCanvasPlaceholderProps {
  electronChrome?: boolean
  chatColumnVisible?: boolean
  onToggleRightPanel?: () => void
  onToggleChatColumn?: () => void
}

/** 右侧研究画布宿主：顶栏保留 Phase 1 操作，主体渲染静态 Research Canvas。 */
export default function BlankCanvasPlaceholder({
  electronChrome = false,
  chatColumnVisible = true,
  onToggleRightPanel,
  onToggleChatColumn,
}: BlankCanvasPlaceholderProps) {
  const s = useStyles()
  const electronWin = electronChrome && electronPlatform() === 'win32'
  const showActions = Boolean(onToggleRightPanel || onToggleChatColumn)

  return (
    <div className={mergeClasses(s.root, electronChrome && s.rootElectron)}>
      {showActions ? (
        <div
          className={mergeClasses(
            s.header,
            electronChrome && s.headerElectron,
            electronChrome && 'opptrix-right-panel-title-bar',
            electronChrome && (electronWin ? 'opptrix-panel-title-no-drag' : 'opptrix-right-panel-title-drag'),
          )}
        >
          {onToggleChatColumn ? (
            <ChromeToolButton
              label={chatColumnVisible ? '最大化右侧面板' : '恢复聊天区域'}
              iconPadding={DESKTOP_SIDEBAR_TOOL_ICON_PADDING}
              onClick={onToggleChatColumn}
            >
              {chatColumnVisible
                ? <ArrowMaximizeRegular fontSize={DESKTOP_SIDEBAR_TOOL_ICON_SIZE} />
                : <ArrowMinimizeRegular fontSize={DESKTOP_SIDEBAR_TOOL_ICON_SIZE} />}
            </ChromeToolButton>
          ) : null}
          {onToggleRightPanel ? (
            <ChromeToolButton
              label="收起右侧面板"
              iconPadding={DESKTOP_SIDEBAR_TOOL_ICON_PADDING}
              active
              onClick={onToggleRightPanel}
            >
              <PanelRightContractRegular fontSize={DESKTOP_SIDEBAR_TOOL_ICON_SIZE} />
            </ChromeToolButton>
          ) : null}
        </div>
      ) : null}
      <div className={s.body}>
        <ResearchCanvas />
      </div>
    </div>
  )
}
