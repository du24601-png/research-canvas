import { Text, makeStyles, mergeClasses } from '@fluentui/react-components'
import { OpenRegular } from '@fluentui/react-icons'
import type { ReactNode } from 'react'
import { opptrixCssVars } from '../../../theme/tokens'
import { designTokens } from '../../../theme/design-tokens'
import { motion, nativeIconInteractive } from '../../../theme/mixins'
import OpptrixButton from '../../../components/opptrix/OpptrixButton'
import { SettingsDivider } from './chrome'

const useStyles = makeStyles({
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: designTokens.SPACING.xxl + 'px',
    padding: '12px 14px',
    minHeight: '42px',
    '@media (max-width: 660px)': {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: '8px',
      padding: '12px 14px',
    },
  },
  rowStack: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: '8px',
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  rowTitle: {
    fontSize: 'var(--opptrix-font-base)',
    fontWeight: 400,
    color: opptrixCssVars.textPrimary,
    lineHeight: '18px',
  },
  rowDesc: {
    fontSize: 'var(--opptrix-font-base)',
    color: opptrixCssVars.textSecondary,
    lineHeight: '18px',
  },
  rowControl: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    width: '100%',
    '@media (min-width: 661px)': {
      width: 'auto',
    },
  },
  rowControlStack: {
    width: '100%',
    justifyContent: 'stretch',
    '@media (min-width: 661px)': {
      width: '100%',
    },
  },
  actionRow: {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    ...nativeIconInteractive,
    backgroundColor: 'transparent',
    textAlign: 'left',
    borderRadius: 0,
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    transitionProperty: 'background-color, color',
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.ease,
    ':hover': {
      backgroundColor: opptrixCssVars.surfaceHover,
      color: opptrixCssVars.textPrimary,
    },
  },
  actionRowBody: {
    width: '100%',
  },
  actionRowIcon: {
    color: opptrixCssVars.textTertiary,
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
  },
  /** 外链行：单层可点，trailing 为外开图标（勿用 Chevron 冒充） */
  externalLinkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 14px',
    minHeight: '42px',
    margin: 0,
    border: 'none',
    borderRadius: 0,
    backgroundColor: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
    color: 'inherit',
    font: 'inherit',
    transitionProperty: 'background-color',
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.ease,
    ':hover': {
      backgroundColor: opptrixCssVars.surfaceHover,
    },
    '@media (prefers-reduced-motion: reduce)': {
      transitionProperty: 'none',
    },
  },
  externalLinkLeading: {
    color: opptrixCssVars.textTertiary,
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
  },
  externalLinkMain: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  externalLinkTitle: {
    fontSize: 'var(--opptrix-font-base)',
    fontWeight: 400,
    color: opptrixCssVars.textPrimary,
    lineHeight: '18px',
  },
  externalLinkDesc: {
    fontSize: 'var(--opptrix-font-base)',
    color: opptrixCssVars.textSecondary,
    lineHeight: '18px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  externalLinkTrailing: {
    color: opptrixCssVars.textTertiary,
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
  },
})

export function SettingsRow({
  title,
  desc,
  control,
  last = false,
  stack = false,
}: {
  title: string
  desc?: ReactNode
  control?: ReactNode
  last?: boolean
  stack?: boolean
}) {
  const s = useStyles()
  return (
    <>
      <div className={mergeClasses(s.row, stack && s.rowStack)}>
        <div className={s.rowMain}>
          <Text className={s.rowTitle} block>{title}</Text>
          {desc != null && (
            typeof desc === 'string'
              ? <Text className={s.rowDesc} block>{desc}</Text>
              : <div className={s.rowDesc}>{desc}</div>
          )}
        </div>
        {control != null && (
          <div className={mergeClasses(s.rowControl, stack && s.rowControlStack)}>{control}</div>
        )}
      </div>
      {!last && <SettingsDivider />}
    </>
  )
}

export function SettingsActionRow({
  title,
  desc,
  onClick,
  icon,
  last = false,
  dividerAbove = false,
  dividerFullWidth = false,
}: {
  title: string
  desc?: string
  onClick: () => void
  icon?: ReactNode
  last?: boolean
  /** 分割线画在行上方（用于组内末行操作入口） */
  dividerAbove?: boolean
  dividerFullWidth?: boolean
}) {
  const s = useStyles()
  return (
    <>
      {dividerAbove && <SettingsDivider fullWidth={dividerFullWidth} />}
      <OpptrixButton
        variant="ghost"
        block
        className={mergeClasses(s.actionRow, 'opptrix-focusable')}
        onClick={onClick}
      >
        <div className={s.actionRowBody}>
          <SettingsRow
            title={title}
            desc={desc}
            control={icon != null ? <span className={s.actionRowIcon}>{icon}</span> : undefined}
            last
          />
        </div>
      </OpptrixButton>
      {!last && <SettingsDivider fullWidth={dividerFullWidth} />}
    </>
  )
}

/**
 * 外链行 — 在浏览器/系统中打开 URL。
 * trailing 固定为外开图标；勿用 ChevronRight 冒充页内导航。
 */
export function SettingsExternalLinkRow({
  title,
  desc,
  onClick,
  icon,
  last = false,
  dividerFullWidth = true,
}: {
  title: string
  desc?: string
  onClick: () => void
  icon?: ReactNode
  last?: boolean
  dividerFullWidth?: boolean
}) {
  const s = useStyles()
  return (
    <>
      <button
        type="button"
        className={mergeClasses(s.externalLinkRow, 'opptrix-focusable')}
        onClick={onClick}
      >
        {icon != null && <span className={s.externalLinkLeading}>{icon}</span>}
        <span className={s.externalLinkMain}>
          <Text className={s.externalLinkTitle} block>{title}</Text>
          {desc != null && desc !== '' && (
            <Text className={s.externalLinkDesc} block>{desc}</Text>
          )}
        </span>
        <span className={s.externalLinkTrailing} aria-hidden>
          <OpenRegular fontSize={16} />
        </span>
      </button>
      {!last && <SettingsDivider fullWidth={dividerFullWidth} />}
    </>
  )
}

