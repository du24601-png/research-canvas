import { makeStyles, mergeClasses, Text, Menu, MenuTrigger, MenuPopover, MenuList, MenuItem } from '@fluentui/react-components'
import { MoreHorizontalRegular, ReOrderDotsVerticalRegular } from '@fluentui/react-icons'
import type { ReactNode } from 'react'
import { opptrixCssVars } from '../../theme/tokens'
import ChromeToolButton from '../../desktop/ChromeToolButton'
import { DESKTOP_SIDEBAR_TOOL_ICON_PADDING } from '../../desktop/constants'

const useStyles = makeStyles({
  root: {
    height: '100%',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: opptrixCssVars.surface,
    border: `1px solid ${opptrixCssVars.border}`,
    borderRadius: '10px',
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  header: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minHeight: '42px',
    minWidth: 0,
    padding: '10px 10px 4px 8px',
  },
  dragHandle: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '28px',
    flexShrink: 0,
    color: opptrixCssVars.textTertiary,
    cursor: 'grab',
    borderRadius: '6px',
    opacity: 0.72,
    ':hover': {
      backgroundColor: opptrixCssVars.surfaceHover,
      color: opptrixCssVars.textSecondary,
      opacity: 1,
    },
    ':active': {
      cursor: 'grabbing',
    },
  },
  titleBlock: {
    flex: '1 1 0',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    lineHeight: 1.4,
    color: opptrixCssVars.textPrimary,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflowWrap: 'anywhere',
  },
  meta: {
    fontSize: 'var(--opptrix-font-md)',
    lineHeight: 1.45,
    color: opptrixCssVars.textSecondary,
  },
  toolbarSlot: {
    flexShrink: 0,
    minWidth: 0,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '4px',
    padding: '4px 10px 8px',
    borderBottom: `1px solid ${opptrixCssVars.separator}`,
  },
  body: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    padding: '8px',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
})

interface Props {
  title: string
  metaLine?: string
  selected?: boolean
  focusPulse?: boolean
  adoptEnter?: boolean
  readonly?: boolean
  onSelect?: () => void
  onDelete?: () => void
  toolbar?: ReactNode
  children: ReactNode
}

export default function WidgetFrame({
  title,
  metaLine,
  selected = false,
  focusPulse = false,
  adoptEnter = false,
  readonly = false,
  onSelect,
  onDelete,
  toolbar,
  children,
}: Props) {
  const s = useStyles()
  const hoverTitle = metaLine ? `${title} · ${metaLine}` : title

  return (
    <div
      className={mergeClasses(s.root, 'research-canvas-widget')}
      data-selected={selected ? 'true' : undefined}
      data-focus-pulse={focusPulse ? 'true' : undefined}
      data-adopt-enter={adoptEnter ? 'true' : undefined}
      aria-selected={selected || undefined}
      onClick={(event) => {
        const target = event.target
        if (!(target instanceof Element)) return
        if (target.closest('.research-canvas-drag-handle, .research-canvas-no-drag')) return
        onSelect?.()
      }}
    >
      <div className={s.header}>
        {!readonly ? (
          <span
            className={mergeClasses(s.dragHandle, 'research-canvas-drag-handle')}
            role="button"
            aria-label={`拖动${title}`}
            tabIndex={0}
          >
            <ReOrderDotsVerticalRegular fontSize={16} />
          </span>
        ) : null}
        <div className={s.titleBlock}>
          <Text className={s.title} title={hoverTitle}>
            {title}
          </Text>
          {metaLine ? (
            <Text className={s.meta} title={metaLine}>
              {metaLine}
            </Text>
          ) : null}
        </div>
        {onDelete && !readonly ? (
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <ChromeToolButton className="research-canvas-no-drag" label={`更多操作：${title}`} iconPadding={DESKTOP_SIDEBAR_TOOL_ICON_PADDING}>
                <MoreHorizontalRegular fontSize={16} />
              </ChromeToolButton>
            </MenuTrigger>
            <MenuPopover className="research-canvas-no-drag">
              <MenuList><MenuItem onClick={onDelete}>从画布移除</MenuItem></MenuList>
            </MenuPopover>
          </Menu>
        ) : null}
      </div>
      {toolbar ? <div className={mergeClasses(s.toolbarSlot, 'research-canvas-no-drag')}>{toolbar}</div> : null}
      <div className={mergeClasses(s.body, 'research-canvas-widget-body')}>
        {children}
      </div>
    </div>
  )
}
