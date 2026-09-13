import { Text, makeStyles, mergeClasses } from '@fluentui/react-components'
import type { ReactNode } from 'react'
import { opptrixCssVars } from '../../../theme/tokens'
import { settingsHairlineBorder, settingsSurfaceRadius, settingsSurfaceTint } from './surfaces'

const useStyles = makeStyles({
  listPanel: {
    border: settingsHairlineBorder,
    borderRadius: settingsSurfaceRadius,
    backgroundColor: settingsSurfaceTint,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  listScroll: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overscrollBehavior: 'contain',
  },
  listHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '10px 14px',
    minHeight: '44px',
    borderBottom: `1px solid ${opptrixCssVars.separator}`,
  },
  listHeaderMeta: {
    fontSize: 'var(--opptrix-font-md)',
    color: opptrixCssVars.textSecondary,
    lineHeight: 1.45,
    flex: 1,
    minWidth: 0,
  },
  listHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  listRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '8px 14px',
    minHeight: '38px',
    borderBottom: `1px solid ${opptrixCssVars.separator}`,
    ':last-child': {
      borderBottom: 'none',
    },
  },
  listRowMain: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  listRowTitle: {
    fontSize: 'var(--opptrix-font-base)',
    fontWeight: 400,
    color: opptrixCssVars.textPrimary,
    lineHeight: '18px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  listRowMeta: {
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
    lineHeight: 1.45,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  listRowControls: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
})

/** 列表面板容器（订阅 / 任务 / 状态列表等） */
export function SettingsListPanel({
  children,
  className,
  height,
}: {
  children: ReactNode
  className?: string
  /** 固定高度列表面板（如订阅列表 360px） */
  height?: string | number
}) {
  const s = useStyles()
  return (
    <div
      className={mergeClasses(s.listPanel, className)}
      style={height != null ? { height } : undefined}
    >
      {children}
    </div>
  )
}

/** 列表可滚动区 — 置于 AddBar 与 ListRow 之间 */
export function SettingsListScroll({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const s = useStyles()
  return (
    <div className={mergeClasses(s.listScroll, 'opptrix-scroll', 'opptrix-scroll-hover', className)}>
      {children}
    </div>
  )
}

/**
 * 列表顶栏 — 左侧说明 + 右侧添加/导入等操作。
 * 与 `SettingsPanelHeader`（Group 内小标题）互补：本组件用于独立 listPanel。
 */
export function SettingsAddBar({
  meta,
  actions,
}: {
  meta?: ReactNode
  actions?: ReactNode
}) {
  const s = useStyles()
  return (
    <div className={s.listHeader}>
      {meta != null && (
        typeof meta === 'string'
          ? <Text className={s.listHeaderMeta} block>{meta}</Text>
          : <div className={s.listHeaderMeta}>{meta}</div>
      )}
      {actions != null && <div className={s.listHeaderActions}>{actions}</div>}
    </div>
  )
}

/**
 * 列表行 — 默认只展示名称（+ 可选一行说明），trailing 放开关/按钮。
 * 默认不暴露 URL / 路径 / 技术 id；需要时由调用方把次要信息放进 meta 或折叠区。
 */
export function SettingsListRow({
  title,
  meta,
  trailing,
  titleTitle,
}: {
  title: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
  /** 原生 title 悬停全文 */
  titleTitle?: string
}) {
  const s = useStyles()
  return (
    <div className={s.listRow}>
      <div className={s.listRowMain}>
        {typeof title === 'string'
          ? <Text className={s.listRowTitle} block title={titleTitle ?? title}>{title}</Text>
          : <div className={s.listRowTitle} title={titleTitle}>{title}</div>}
        {meta != null && (
          typeof meta === 'string'
            ? <Text className={s.listRowMeta} block>{meta}</Text>
            : <div className={s.listRowMeta}>{meta}</div>
        )}
      </div>
      {trailing != null && <div className={s.listRowControls}>{trailing}</div>}
    </div>
  )
}
