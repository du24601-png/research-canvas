import ChromeToolButton from '../../desktop/ChromeToolButton'
import { DESKTOP_TOOL_ICON_SIZE } from '../../desktop/constants'
import { PanelRightContractRegular, PanelRightExpandRegular } from '../chatIcons'
import { usePinBoard } from './PinBoardContext'

/** 顶栏右侧边栏开关：只放图标，对话优先布局才显示。 */
export default function PinBoardButton() {
  const { chatFirst, open, toggleBoard } = usePinBoard()
  if (!chatFirst) return null
  return (
    <ChromeToolButton
      label={open ? '收起看板' : '打开看板'}
      active={open}
      aria-expanded={open}
      onClick={toggleBoard}
      data-pin-board-button
    >
      {open
        ? <PanelRightContractRegular fontSize={DESKTOP_TOOL_ICON_SIZE} />
        : <PanelRightExpandRegular fontSize={DESKTOP_TOOL_ICON_SIZE} />}
    </ChromeToolButton>
  )
}
