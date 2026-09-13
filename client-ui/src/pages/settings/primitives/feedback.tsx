import { Text, makeStyles, mergeClasses } from '@fluentui/react-components'
import type { ReactNode } from 'react'
import { opptrixTokens, opptrixCssVars } from '../../../theme/tokens'
import { ghostInteractive, motion } from '../../../theme/mixins'
import { settingsItemTint, settingsTabActiveShadow } from './surfaces'

const useStyles = makeStyles({
  /** 模式切换 Tab 容器 — pill 底座 */
  tabsRow: {
    display: 'flex',
    gap: '4px',
    padding: '3px',
    backgroundColor: opptrixCssVars.canvasAlt,
    borderRadius: opptrixTokens.radiusFull,
    width: 'fit-content',
    maxWidth: '100%',
  },
  tabsRowWrap: {
    flexWrap: 'wrap',
  },
  tabsRowSpaced: {
    marginBottom: '12px',
  },
  tab: {
    ...ghostInteractive,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '5px 14px',
    borderRadius: opptrixTokens.radiusFull,
    fontSize: 'var(--opptrix-font-md)',
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    color: opptrixCssVars.textTertiary,
    transitionProperty: 'background-color, color',
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.ease,
    whiteSpace: 'nowrap',
  },
  tabActive: {
    backgroundColor: opptrixCssVars.surface,
    color: opptrixCssVars.textPrimary,
    boxShadow: settingsTabActiveShadow,
  },
  /** 区块说明行 */
  hint: {
    fontSize: 'var(--opptrix-font-md)',
    color: opptrixCssVars.textSecondary,
    lineHeight: 1.5,
    padding: '0 2px 4px',
  },
  /** 浅底条目卡 */
  itemCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '10px 14px',
    borderRadius: opptrixTokens.radiusMd,
    backgroundColor: settingsItemTint,
  },
  /** 状态提示卡 — 图标 + 标题 + 正文 */
  statusCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: opptrixTokens.radiusMd,
  },
  statusCardSuccess: {
    border: `1px solid color-mix(in srgb, ${opptrixCssVars.success} 28%, transparent)`,
    backgroundColor: 'color-mix(in srgb, var(--opptrix-success) 6%, transparent)',
  },
  statusCardWarning: {
    border: `1px solid color-mix(in srgb, ${opptrixCssVars.warning} 28%, transparent)`,
    backgroundColor: 'color-mix(in srgb, var(--opptrix-warning) 6%, transparent)',
  },
  statusCardError: {
    border: `1px solid color-mix(in srgb, ${opptrixCssVars.error} 28%, transparent)`,
    backgroundColor: 'color-mix(in srgb, var(--opptrix-error) 6%, transparent)',
  },
  statusCardNeutral: {
    border: `1px solid ${opptrixCssVars.separator}`,
    backgroundColor: settingsItemTint,
  },
  statusIcon: {
    flexShrink: 0,
    marginTop: '1px',
    display: 'inline-flex',
    alignItems: 'center',
  },
  statusIconSuccess: { color: opptrixCssVars.success },
  statusIconWarning: { color: opptrixCssVars.warning },
  statusIconError: { color: opptrixCssVars.error },
  statusIconNeutral: { color: opptrixCssVars.textTertiary },
  statusBody: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  statusTitle: {
    fontSize: 'var(--opptrix-font-sm)',
    fontWeight: 600,
    color: opptrixCssVars.textPrimary,
    lineHeight: 1.35,
  },
  statusText: {
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textSecondary,
    lineHeight: 1.45,
    wordBreak: 'break-word',
  },
})

/**
 * 模式切换 Tab — 设置区多视图切换标准件（受控）。
 * 统一此前各 Section 手搓的 modeRow / tabRow 结构。
 */
export function SettingsModeTabs<T extends string>({
  value,
  onChange,
  items,
  ariaLabel,
  spaced = false,
  wrap = false,
  className,
}: {
  value: T
  onChange: (next: T) => void
  items: ReadonlyArray<{
    id: T
    label: string
    /** 前置图标 */
    icon?: ReactNode
    /** 后置附加内容（如状态徽标） */
    trailing?: ReactNode
  }>
  ariaLabel?: string
  /** 与下方内容留 12px 间距（多视图面板顶部使用） */
  spaced?: boolean
  /** 窄窗口允许换行（视图数多时） */
  wrap?: boolean
  className?: string
}) {
  const s = useStyles()
  return (
    <div
      className={mergeClasses(s.tabsRow, wrap && s.tabsRowWrap, spaced && s.tabsRowSpaced, className)}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map(item => {
        const active = value === item.id
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={mergeClasses(s.tab, active && s.tabActive, 'opptrix-focusable')}
            onClick={() => onChange(item.id)}
          >
            {item.icon}
            {item.label}
            {item.trailing}
          </button>
        )
      })}
    </div>
  )
}

/** 区块说明行 — SettingsSectionLabel / Group 下方的辅助说明文字 */
export function SettingsHint({ children, className }: { children: ReactNode; className?: string }) {
  const s = useStyles()
  return (
    <Text className={mergeClasses(s.hint, className)} block>
      {children}
    </Text>
  )
}

/** 浅底条目卡 — 列表条目 / 摘要卡的统一容器（ink 3% 浅底 + 卡片圆角） */
export function SettingsItemCard({
  children,
  className,
  role,
}: {
  children: ReactNode
  className?: string
  /** 语义角色透传（如 listitem） */
  role?: string
}) {
  const s = useStyles()
  return <div className={mergeClasses(s.itemCard, className)} role={role}>{children}</div>
}

/**
 * 状态提示卡 — 图标 + 标题 + 正文（如「当前生效」的代理地址）。
 * tone 决定描边与浅底颜色；正文可传自定义节点（如等宽地址）。
 */
export function SettingsStatusCard({
  icon,
  title,
  body,
  tone = 'neutral',
  className,
}: {
  icon?: ReactNode
  title: string
  body?: ReactNode
  tone?: 'success' | 'warning' | 'error' | 'neutral'
  className?: string
}) {
  const s = useStyles()
  const toneKey = tone.charAt(0).toUpperCase() + tone.slice(1) as 'Success' | 'Warning' | 'Error' | 'Neutral'
  return (
    <div className={mergeClasses(s.statusCard, s[`statusCard${toneKey}`], className)}>
      {icon != null && (
        <span className={mergeClasses(s.statusIcon, s[`statusIcon${toneKey}`])}>{icon}</span>
      )}
      <div className={s.statusBody}>
        <Text className={s.statusTitle} block>{title}</Text>
        {body != null && <div className={s.statusText}>{body}</div>}
      </div>
    </div>
  )
}
