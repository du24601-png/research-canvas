import { makeStyles } from '@fluentui/react-components'
import type { ChatToolStep } from '../../types/chatProgress'
import { opptrixTokens, opptrixCssVars } from '../../theme/tokens'
import { buildProgressCounts, progressHeading, progressRatio } from './progressLive'

const useStyles = makeStyles({
  card: {
    display: 'grid',
    gap: '7px',
    padding: '11px 14px',
    border: `1px solid ${opptrixCssVars.separator}`,
    borderRadius: opptrixTokens.radiusLg,
    boxSizing: 'border-box',
    minWidth: 0,
  },
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    fontSize: 'var(--opptrix-font-sm)',
    lineHeight: 1.35,
    color: opptrixCssVars.textTertiary,
  },
  count: {
    fontVariantNumeric: 'tabular-nums',
  },
  track: {
    height: '2px',
    borderRadius: '2px',
    overflow: 'hidden',
    backgroundColor: opptrixCssVars.separator,
  },
  fill: {
    display: 'block',
    height: '100%',
    backgroundColor: opptrixCssVars.textPrimary,
    transitionProperty: 'width',
    transitionDuration: '320ms',
    transitionTimingFunction: 'ease-out',
    '@media (prefers-reduced-motion: reduce)': {
      transitionDuration: '0ms',
    },
  },
  action: {
    display: 'inline-block',
    maxWidth: '100%',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    verticalAlign: 'top',
    fontSize: 'var(--opptrix-font-md)',
    lineHeight: 1.45,
    color: 'transparent',
    backgroundImage: `linear-gradient(90deg, ${opptrixCssVars.textTertiary} 0%, ${opptrixCssVars.textTertiary} 35%, ${opptrixCssVars.textPrimary} 50%, ${opptrixCssVars.textTertiary} 65%, ${opptrixCssVars.textTertiary} 100%)`,
    backgroundSize: '250% 100%',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    animationName: {
      from: { backgroundPosition: '100% 0' },
      to: { backgroundPosition: '-150% 0' },
    },
    animationDuration: '1.8s',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
    '@media (prefers-reduced-motion: reduce)': {
      animationName: 'none',
      backgroundImage: 'none',
      color: opptrixCssVars.textSecondary,
    },
  },
})

interface Props {
  steps: ChatToolStep[]
  actionLabel: string
}

/** 对话优先布局的取数进度卡（方案 B）：标题 + 步数、细进度条、一行当前动作 */
export default function ProgressCard({ steps, actionLabel }: Props) {
  const s = useStyles()
  const counts = buildProgressCounts(steps)
  const percent = Math.round(progressRatio(counts) * 100)
  return (
    <div className={s.card} role="status" aria-live="polite" data-progress-card="b">
      <div className={s.head}>
        <span>{progressHeading(steps)}</span>
        <span className={s.count} aria-label={`已完成 ${counts.done} 步，共 ${counts.total} 步`}>
          {counts.done} / {counts.total}
        </span>
      </div>
      <div className={s.track} aria-hidden>
        <i className={s.fill} style={{ width: `${percent}%` }} />
      </div>
      <div>
        <span className={s.action}>{actionLabel}</span>
      </div>
    </div>
  )
}
