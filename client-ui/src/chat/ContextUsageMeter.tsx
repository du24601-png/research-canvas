import { Text, makeStyles, mergeClasses } from '@fluentui/react-components'
import { opptrixCssVars, opptrixTokens } from '../theme/tokens'
import { formatContextUsageLabel, formatCacheHitLabel, resolveContextUsagePercent } from './formatTokenCount'
import type { ChatContextUsage } from '../types/chat'

const RING_SIZE = 16
const RING_STROKE = 2
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

const useStyles = makeStyles({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    maxWidth: '220px',
    minWidth: 0,
    flexShrink: 1,
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: 1.4,
  },
  stacked: {
    display: 'block',
    maxWidth: '100%',
    width: '100%',
    fontSize: 'var(--opptrix-font-xs)',
    lineHeight: 1.35,
    textAlign: 'right',
    whiteSpace: 'normal',
    overflow: 'visible',
    textOverflow: 'unset',
  },
  panel: {
    display: 'block',
    maxWidth: '100%',
    width: '100%',
    fontSize: 'var(--opptrix-font-sm)',
    lineHeight: 1.45,
    color: opptrixCssVars.textTertiary,
    whiteSpace: 'normal',
    overflow: 'visible',
    textOverflow: 'unset',
  },
  ring: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    flexShrink: 0,
    padding: 0,
    border: 'none',
    backgroundColor: 'transparent',
    borderRadius: opptrixTokens.radiusFull,
  },
  svg: {
    display: 'block',
    width: `${RING_SIZE}px`,
    height: `${RING_SIZE}px`,
  },
  track: {
    fill: 'none',
    stroke: opptrixCssVars.separatorStrong,
    strokeWidth: RING_STROKE,
  },
  fill: {
    fill: 'none',
    stroke: opptrixCssVars.textSecondary,
    strokeWidth: RING_STROKE,
    strokeLinecap: 'round',
  },
  fillWarn: {
    stroke: opptrixCssVars.warning,
  },
  fillHigh: {
    stroke: opptrixCssVars.error,
  },
})

interface ContextUsageMeterProps {
  usage: ChatContextUsage | null | undefined
  /** 工具栏：环形用量，详情放在悬停说明 */
  compact?: boolean
  /** 手机：叠在模型选择下方，展示完整上下文与缓存 */
  stacked?: boolean
  /** 模型配置面板底部信息栏 */
  panel?: boolean
}

function usageTitle(usage: ChatContextUsage, percent: number): string {
  const contextLabel = formatContextUsageLabel(percent, usage.compacted)
  const cacheLabel = usage.cacheHitPercent !== undefined
    ? formatCacheHitLabel(usage.cacheHitPercent)
    : null
  const fullLabel = cacheLabel ? `${contextLabel} · ${cacheLabel}` : contextLabel
  const nearLimitHint = percent >= 85 ? ' · 上下文接近上限' : ''
  const cacheHint = usage.cacheHitPercent !== undefined && usage.cacheHitPercent > 0
    ? ' · 最近一轮请求中，较早内容复用了缓存'
    : usage.cacheHitPercent === 0
      ? ' · 本轮未命中前缀缓存'
      : ''
  return `${fullLabel}${nearLimitHint}${cacheHint}`
}

export default function ContextUsageMeter({
  usage,
  compact = false,
  stacked = false,
  panel = false,
}: ContextUsageMeterProps) {
  const s = useStyles()
  if (!usage) return null
  const percent = resolveContextUsagePercent(usage)
  const title = usageTitle(usage, percent)

  if (compact) {
    const offset = RING_CIRCUMFERENCE * (1 - Math.min(100, Math.max(0, percent)) / 100)
    return (
      <span
        className={s.ring}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={title}
        title={title}
      >
        <svg className={s.svg} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} aria-hidden>
          <circle
            className={s.track}
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
          />
          <g transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}>
            <circle
              className={mergeClasses(
                s.fill,
                percent >= 95 && s.fillHigh,
                percent >= 85 && percent < 95 && s.fillWarn,
              )}
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={offset}
            />
          </g>
        </svg>
      </span>
    )
  }

  const contextLabel = formatContextUsageLabel(percent, usage.compacted)
  const cacheLabel = usage.cacheHitPercent !== undefined
    ? formatCacheHitLabel(usage.cacheHitPercent)
    : null
  const displayLabel = cacheLabel ? `${contextLabel} · ${cacheLabel}` : contextLabel
  return (
    <Text
      className={mergeClasses(s.root, stacked && s.stacked, panel && s.panel)}
      title={title}
      aria-label={title}
    >
      {displayLabel}
    </Text>
  )
}
