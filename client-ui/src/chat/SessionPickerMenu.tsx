import { useCallback, useRef, useState } from 'react'
import { makeStyles, mergeClasses } from '@fluentui/react-components'
import { HistoryRegular, SearchRegular, SettingsRegular } from '@fluentui/react-icons'
import ChromeToolButton from '../desktop/ChromeToolButton'
import { DESKTOP_SIDEBAR_TOOL_ICON_PADDING, DESKTOP_SIDEBAR_TOOL_ICON_SIZE } from '../desktop/constants'
import { opptrixCssVars } from '../theme/tokens'
import type { SessionMeta } from '../types/chat'
import ComposerTooltipMenu, { ComposerTooltipMenuItem } from './ComposerTooltipMenu'
import { recentSessionsForPicker } from './sessionSidebarPresentation'

const useStyles = makeStyles({
  empty: {
    padding: '12px 10px',
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
    lineHeight: 1.45,
  },
  date: {
    flexShrink: 0,
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
  },
  title: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})

export interface SessionPickerMenuProps {
  sessions: SessionMeta[]
  activeId: string | null
  onSelect: (id: string) => void
  onOpenSearch: () => void
  onOpenSettings: () => void
}

function formatPickerDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

export default function SessionPickerMenu({
  sessions,
  activeId,
  onSelect,
  onOpenSearch,
  onOpenSettings,
}: SessionPickerMenuProps) {
  const s = useStyles()
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const recent = recentSessionsForPicker(sessions)

  const close = useCallback(() => setOpen(false), [])

  return (
    <>
      <span ref={anchorRef} className="opptrix-session-picker-trigger">
        <ChromeToolButton
          label="会话"
          aria-expanded={open}
          aria-haspopup="menu"
          iconPadding={DESKTOP_SIDEBAR_TOOL_ICON_PADDING}
          active={open}
          onClick={() => setOpen(value => !value)}
        >
          <HistoryRegular fontSize={DESKTOP_SIDEBAR_TOOL_ICON_SIZE} />
        </ChromeToolButton>
      </span>
      <ComposerTooltipMenu
        open={open}
        anchorRef={anchorRef}
        align="start"
        width={280}
        maxHeight={360}
        ariaLabel="最近对话"
        onClose={close}
        footer={(
          <ComposerTooltipMenuItem
            onClick={() => {
              close()
              onOpenSettings()
            }}
          >
            <SettingsRegular fontSize={16} />
            <span>系统设置</span>
          </ComposerTooltipMenuItem>
        )}
      >
        <div className="opptrix-session-tools-menu">
          <ComposerTooltipMenuItem
            onClick={() => {
              close()
              onOpenSearch()
            }}
          >
            <SearchRegular fontSize={16} />
            <span>搜索全部对话</span>
          </ComposerTooltipMenuItem>
          {recent.length === 0 ? (
            <div className={s.empty}>暂无历史对话，可先新建或搜索。</div>
          ) : recent.map(session => (
            <ComposerTooltipMenuItem
              key={session.id}
              active={session.id === activeId}
              title={session.title}
              onClick={() => {
                close()
                onSelect(session.id)
              }}
            >
              <span className={mergeClasses(s.title, 'opptrix-composer-tooltip-menu__item-title')}>
                {session.title}
              </span>
              <span className={s.date}>{formatPickerDate(session.updatedAt)}</span>
            </ComposerTooltipMenuItem>
          ))}
        </div>
      </ComposerTooltipMenu>
    </>
  )
}
