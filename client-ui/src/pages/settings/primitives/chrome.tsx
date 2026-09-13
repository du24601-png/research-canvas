import { Text, makeStyles, mergeClasses } from '@fluentui/react-components'
import type { ReactNode } from 'react'
import { opptrixCssVars } from '../../../theme/tokens'
import { designTokens } from '../../../theme/design-tokens'
import { motion } from '../../../theme/mixins'
import OpptrixEmptyState from '../../../components/opptrix/OpptrixEmptyState'
import { settingsHairlineBorder, settingsSurfaceRadius, settingsSurfaceTint } from './surfaces'

const useStyles = makeStyles({
  group: {
    border: settingsHairlineBorder,
    borderRadius: designTokens.semantic.radiusCard, // 12px — matches settingsSurfaceRadius
    backgroundColor: settingsSurfaceTint,
    overflow: 'hidden',
    transitionProperty: 'border-color, background-color',
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.ease,
    '@media (prefers-reduced-motion: reduce)': {
      transitionProperty: 'none',
    },
  },
  card: {
    border: settingsHairlineBorder,
    borderRadius: settingsSurfaceRadius,
    backgroundColor: settingsSurfaceTint,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflow: 'hidden',
    transitionProperty: 'border-color, background-color',
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.ease,
  },
  staticBlock: {
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  rowDivider: {
    height: '1px',
    backgroundColor: opptrixCssVars.separator,
    margin: '0 14px',
  },
  rowDividerFull: {
    margin: '0',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: designTokens.SPACING.md + 'px',
    padding: '8px 14px',
    minHeight: '32px',
  },
  panelHeaderTitle: {
    fontSize: 'var(--opptrix-font-md)',
    fontWeight: 400,
    color: opptrixCssVars.textSecondary,
    lineHeight: '16px',
  },
  sectionHeader: {
    padding: '0 2px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionKicker: {
    fontSize: 'var(--opptrix-font-md)',
    fontWeight: 400,
    color: opptrixCssVars.textSecondary,
    lineHeight: '16px',
  },
  sectionTitle: {
    fontSize: 'var(--opptrix-font-md)',
    fontWeight: 400,
    color: opptrixCssVars.textSecondary,
    lineHeight: '16px',
  },
  sectionSubtitle: {
    fontSize: 'var(--opptrix-font-md)',
    color: opptrixCssVars.textTertiary,
    lineHeight: '16px',
  },
  /** Group 上方页级 section 标签（对齐 SettingsPage sectionLabel） */
  sectionLabel: {
    fontSize: 'var(--opptrix-font-md)',
    fontWeight: 400,
    color: opptrixCssVars.textSecondary,
    lineHeight: '16px',
    paddingLeft: '2px',
  },
  sectionLabelSpaced: {
    padding: '0 2px 8px',
  },
})

export function SettingsGroup({ children, className }: { children: ReactNode; className?: string }) {
  const s = useStyles()
  return <div className={mergeClasses(s.group, className)}>{children}</div>
}

export function SettingsCard({ children, className }: { children: ReactNode; className?: string }) {
  const s = useStyles()
  return <div className={mergeClasses(s.card, className)}>{children}</div>
}

export function SettingsSectionHeader({
  kicker,
  title,
  subtitle,
}: {
  kicker?: string
  title: string
  subtitle?: string
}) {
  const s = useStyles()
  return (
    <div className={s.sectionHeader}>
      {kicker && <span className={s.sectionKicker}>{kicker}</span>}
      <h2 className={s.sectionTitle}>{title}</h2>
      {subtitle && <span className={s.sectionSubtitle}>{subtitle}</span>}
    </div>
  )
}

/** 设置域空态：组合 L1 原子 OpptrixEmptyState（签名保持 icon/title/desc 不变） */
export function SettingsEmptyState({
  icon,
  title,
  desc,
}: {
  icon?: ReactNode
  title: string
  desc?: string
}) {
  return <OpptrixEmptyState icon={icon} title={title} description={desc} />
}

export function SettingsStaticBlock({ children }: { children: ReactNode }) {
  const s = useStyles()
  return <div className={s.staticBlock}>{children}</div>
}

export function SettingsDivider({ fullWidth = false }: { fullWidth?: boolean } = {}) {
  const s = useStyles()
  return <div className={mergeClasses(s.rowDivider, fullWidth && s.rowDividerFull)} aria-hidden />
}

export function SettingsPanelHeader({
  title,
  action,
}: {
  title: string
  action?: ReactNode
}) {
  const s = useStyles()
  return (
    <>
      <div className={s.panelHeader}>
        <Text className={s.panelHeaderTitle} block>{title}</Text>
        {action}
      </div>
      <SettingsDivider />
    </>
  )
}

/** Group 上方页级标签 — font-md / 400 / textSecondary（禁止 base+600） */
export function SettingsSectionLabel({
  children,
  spaced = false,
}: {
  children: ReactNode
  spaced?: boolean
}) {
  const s = useStyles()
  return (
    <Text className={mergeClasses(s.sectionLabel, spaced && s.sectionLabelSpaced)} block>
      {children}
    </Text>
  )
}
