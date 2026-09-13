import type { ReactNode } from 'react'
import { makeStyles, mergeClasses } from '@fluentui/react-components'
import { opptrixCssVars } from '../../theme/tokens'

/**
 * OpptrixEmptyState — L1 原子：标准空态（「为什么没有」+「下一步是什么」+ 动作）。
 * 业务中性；设置域 SettingsEmptyState 与其他空态场景统一组合本原子。
 */
const useStyles = makeStyles({
  root: {
    padding: '24px 14px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    textAlign: 'center',
  },
  icon: {
    color: opptrixCssVars.textTertiary,
    flexShrink: 0,
    marginBottom: '4px',
  },
  title: {
    fontSize: 'var(--opptrix-font-base)',
    fontWeight: 400,
    color: opptrixCssVars.textPrimary,
    lineHeight: '18px',
  },
  description: {
    fontSize: 'var(--opptrix-font-base)',
    color: opptrixCssVars.textSecondary,
    lineHeight: '18px',
    maxWidth: '240px',
  },
})

export interface OpptrixEmptyStateProps {
  /** 装饰图标（可选） */
  icon?: ReactNode
  /** 标题：说明「为什么没有」 */
  title: ReactNode
  /** 补充说明：指引「下一步是什么」 */
  description?: ReactNode
  /** 下一步动作（如「去添加」按钮） */
  action?: ReactNode
  className?: string
}

export default function OpptrixEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: OpptrixEmptyStateProps) {
  const s = useStyles()
  return (
    <div className={mergeClasses(s.root, className)}>
      {icon && <span className={s.icon}>{icon}</span>}
      <span className={s.title}>{title}</span>
      {description && <span className={s.description}>{description}</span>}
      {action}
    </div>
  )
}
