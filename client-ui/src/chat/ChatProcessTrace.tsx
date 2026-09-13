import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Text,
  makeStyles,
  mergeClasses,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
} from '@fluentui/react-components'
import {
  ChevronDownRegular,
  ChevronRightRegular,
  SparkleRegular,
  DocumentSearchRegular,
  CopyRegular,
  CheckmarkRegular,
  DismissRegular,
} from '@fluentui/react-icons'
import type { ChatToolStep } from '../types/chatProgress'
import { opptrixTokens, opptrixCssVars } from '../theme/tokens'
import { fadeInUp, motion } from '../theme/mixins'
import { copyTextToClipboard } from '../platform/clipboard'
import ThinkingDots from '../components/ThinkingDots'
import { resolveLiveTraceStatusLabel } from './toolLiveStatus'
import {
  formatReasoningSegmentLabel,
  resolveReasoningSegments,
  type ReasoningSegment,
} from './reasoningTimeline'
import {
  TOOL_RESULT_TRUNCATED_DETAIL_HINT,
  TOOL_RESULT_TRUNCATED_STEP_HINT,
  isToolStepResultTruncated,
} from './toolResultTruncation'
import ResearchWidgetPreviewCard from './research-canvas/ResearchWidgetPreviewCard'
import ResearchFetchPlanCard from './research-canvas/ResearchFetchPlanCard'
import { fetchPlanFromToolStep } from './research-canvas/fetchPlanFromToolStep'
import ChatStreamReceipt from './ChatStreamReceipt'
import {
  buildThinkingSummary,
  buildTraceReceipt,
  countHiddenDetailSteps,
  extractSourceChips,
  resolveInvestorStatusLabel,
} from './tracePresentation'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '2px 0 4px',
    ...fadeInUp,
  },
  thinkingRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  thinkingHead: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '2px 0',
    minHeight: '22px',
  },
  stepList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
/** 约 3 行步骤（stepHead 22 + 上下 padding ≈ 30px） */
scrollWrapper: {
  maxHeight: 'calc(3 * 30px)',
  overflowY: 'auto',
},
  summaryBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    width: '100%',
    minHeight: '22px',
    padding: '4px 8px',
    border: 'none',
    borderRadius: opptrixTokens.radiusSm,
    backgroundColor: opptrixCssVars.canvasAlt,
    cursor: 'pointer',
    textAlign: 'left',
    boxSizing: 'border-box',
    color: opptrixCssVars.textTertiary,
    transitionProperty: 'background-color, color',
    transitionDuration: motion.fast,
    ':hover': {
      backgroundColor: opptrixCssVars.canvasMuted,
      color: opptrixCssVars.textSecondary,
    },
  },
  summaryLabel: {
    fontSize: 'var(--opptrix-font-sm)',
    lineHeight: 1.35,
    color: 'inherit',
    userSelect: 'none',
  },
  summaryChevron: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '14px',
    height: '14px',
    color: 'inherit',
  },
  stepRow: {
    backgroundColor: 'transparent',
    borderBottom: `1px solid ${opptrixCssVars.separatorHairline}`,
    overflow: 'hidden',
    ':last-child': {
      borderBottom: 'none',
    },
  },
  stepHeadRow: {
    display: 'flex',
    alignItems: 'center',
  },
  stepHead: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flex: 1,
    minWidth: 0,
    minHeight: '22px',
    padding: '4px 0',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    boxSizing: 'border-box',
    ':disabled': {
      cursor: 'default',
    },
  },
  detailBtn: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '22px',
    padding: 0,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: opptrixCssVars.textTertiary,
    transitionProperty: 'color',
    transitionDuration: motion.fast,
    ':hover': {
      color: opptrixCssVars.textSecondary,
    },
  },
  leadIcon: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: opptrixCssVars.textTertiary,
    fontSize: 'var(--opptrix-font-sm)',
    width: '14px',
    height: '14px',
  },
  stepIcon: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: opptrixCssVars.textTertiary,
    fontSize: 'var(--opptrix-font-sm)',
    width: '14px',
    height: '14px',
  },
  runningDots: {
    width: '10px',
    height: '10px',
    marginRight: 0,
  },
  stepLabel: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 'var(--opptrix-font-md)',
    lineHeight: 1.4,
    color: opptrixCssVars.textTertiary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  stepLabelRunning: {
    color: opptrixCssVars.textSecondary,
    // 避免 background-clip:text：长状态（含 token / 步数）会被裁成透明看不见
    opacity: 1,
    animationDuration: '1.6s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
    animationName: {
      '0%, 100%': { opacity: 0.72 },
      '50%': { opacity: 1 },
    },
    '@media (prefers-reduced-motion: reduce)': {
      animationName: 'none',
      opacity: 1,
    },
  },
  stepLabelError: {
    color: opptrixCssVars.error,
  },
  stepLabelCol: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '6px',
    overflow: 'hidden',
  },
  stepTruncHint: {
    flex: 1,
    minWidth: 0,
    fontSize: 'var(--opptrix-font-sm)',
    lineHeight: 1.3,
    color: opptrixCssVars.textTertiary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  detailTruncBanner: {
    fontSize: 'var(--opptrix-font-sm)',
    lineHeight: 1.45,
    color: opptrixCssVars.textSecondary,
    backgroundColor: opptrixCssVars.canvasAlt,
    borderRadius: opptrixTokens.radiusMd,
    padding: '8px 10px',
  },
  stepBody: {
    padding: '0 0 6px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  detailBlock: {
    fontSize: 'var(--opptrix-font-sm)',
    lineHeight: 1.45,
    color: opptrixCssVars.textTertiary,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '180px',
    overflow: 'auto',
  },
  /** 无内部滚动约束；历史思考由外层 scrollWrapper 限高，避免嵌套 overflow 在 0fr/1fr 下高度为 0 */
  detailFlow: {
    fontSize: 'var(--opptrix-font-sm)',
    lineHeight: 1.45,
    color: opptrixCssVars.textTertiary,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  thinkingSnippet: {
    fontSize: 'var(--opptrix-font-sm)',
    lineHeight: 1.45,
    color: opptrixCssVars.textTertiary,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    padding: '0 0 2px 0',
  },
  timelineItem: {
    display: 'flex',
    alignItems: 'stretch',
    gap: '8px',
    minWidth: 0,
  },
  timelineRail: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '14px',
    flexShrink: 0,
    paddingTop: '6px',
  },
  timelineDot: {
    width: '7px',
    height: '7px',
    borderRadius: opptrixTokens.radiusFull,
    backgroundColor: opptrixCssVars.textTertiary,
    opacity: 0.55,
    flexShrink: 0,
  },
  timelineDotActive: {
    backgroundColor: opptrixCssVars.textSecondary,
    opacity: 1,
  },
  timelineLine: {
    flex: 1,
    width: '1px',
    minHeight: '8px',
    marginTop: '4px',
    backgroundColor: opptrixCssVars.separatorHairline,
  },
  timelineBody: {
    flex: 1,
    minWidth: 0,
    padding: '2px 0 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  timelineHead: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
    minWidth: 0,
  },
  timelineLabel: {
    fontSize: 'var(--opptrix-font-sm)',
    lineHeight: 1.35,
    color: opptrixCssVars.textTertiary,
    fontWeight: 600,
  },
  timelineTime: {
    fontSize: 'var(--opptrix-font-sm)',
    lineHeight: 1.35,
    color: opptrixCssVars.textTertiary,
    opacity: 0.85,
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  },
  dialogSurface: {
    maxWidth: '560px',
    width: 'calc(100vw - 40px)',
  },
  dialogTitleRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
  },
  dialogTitleMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  dialogTitle: {
    fontSize: 'var(--opptrix-font-2xl)',
    fontWeight: 600,
    letterSpacing: '-0.02em',
    lineHeight: 1.3,
    color: opptrixCssVars.textPrimary,
  },
  dialogSubtitle: {
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
    fontFamily: 'var(--opptrix-font-mono)',
    wordBreak: 'break-all',
  },
  dialogClose: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    border: 'none',
    borderRadius: opptrixTokens.radiusFull,
    background: 'none',
    cursor: 'pointer',
    color: opptrixCssVars.textTertiary,
    transitionProperty: 'background-color, color',
    transitionDuration: motion.fast,
    ':hover': {
      backgroundColor: opptrixCssVars.surfaceHover,
      color: opptrixCssVars.textPrimary,
    },
  },
  dialogScroll: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    paddingTop: '4px',
    maxHeight: '60vh',
    overflowY: 'auto',
  },
  detailSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  detailSectionHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    minHeight: '18px',
  },
  detailSectionTitle: {
    fontSize: 'var(--opptrix-font-sm)',
    fontWeight: 600,
    color: opptrixCssVars.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  detailCopyBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: opptrixTokens.radiusSm,
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
    transitionProperty: 'color',
    transitionDuration: motion.fast,
    ':hover': {
      color: opptrixCssVars.textPrimary,
    },
  },
  detailSectionText: {
    fontSize: 'var(--opptrix-font-md)',
    lineHeight: 1.55,
    color: opptrixCssVars.textPrimary,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  detailSectionMono: {
    fontSize: 'var(--opptrix-font-sm)',
    lineHeight: 1.5,
    color: opptrixCssVars.textSecondary,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    backgroundColor: opptrixCssVars.canvasAlt,
    borderRadius: opptrixTokens.radiusMd,
    padding: '8px 10px',
    maxHeight: '260px',
    overflowY: 'auto',
  },
  detailMeta: {
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
  },
  statusCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '8px 10px',
    borderRadius: opptrixTokens.radiusMd,
    backgroundColor: opptrixCssVars.canvasAlt,
    boxSizing: 'border-box',
  },
  statusHeadRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    minHeight: '22px',
  },
  statusHeadMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    minWidth: 0,
    flex: '1 1 auto',
  },
  statusText: {
    fontSize: 'var(--opptrix-font-base)',
    lineHeight: 1.4,
    fontWeight: 500,
    color: opptrixCssVars.textPrimary,
  },
  statusTextRunning: {
    animationDuration: '1.6s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
    animationName: {
      '0%, 100%': { opacity: 0.76 },
      '50%': { opacity: 1 },
    },
    '@media (prefers-reduced-motion: reduce)': {
      animationName: 'none',
      opacity: 1,
    },
  },
  inlineAction: {
    flexShrink: 0,
    border: 'none',
    background: 'none',
    padding: '2px 0 2px 8px',
    cursor: 'pointer',
    fontSize: 'var(--opptrix-font-sm)',
    lineHeight: 1.35,
    color: opptrixCssVars.textTertiary,
    ':hover': {
      color: opptrixCssVars.textSecondary,
    },
  },
  sourceChipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  sourceChip: {
    border: `1px solid ${opptrixCssVars.separator}`,
    borderRadius: opptrixTokens.radiusFull,
    padding: '2px 9px',
    fontSize: 'var(--opptrix-font-sm)',
    lineHeight: 1.35,
    color: opptrixCssVars.textSecondary,
    backgroundColor: opptrixCssVars.canvas,
  },
  thinkingSummaryBody: {
    fontSize: 'var(--opptrix-font-sm)',
    lineHeight: 1.45,
    color: opptrixCssVars.textSecondary,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  previewEmphasis: {
    borderRadius: opptrixTokens.radiusLg,
    outline: `1px solid ${opptrixCssVars.inputBorderFocus}`,
    outlineOffset: '0',
  },
  replyShell: {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: opptrixTokens.radiusLg,
    border: `1px solid ${opptrixCssVars.separator}`,
    backgroundColor: opptrixCssVars.canvas,
    overflow: 'hidden',
  },
})

function hasExpandableContent(step: ChatToolStep): boolean {
  return Boolean(step.resultDetail || step.thinking || step.argsPreview)
}

function StepLead({ running, expandable, expanded }: {
  running: boolean
  expandable: boolean
  expanded: boolean
}) {
  const s = useStyles()
  if (running) {
    return (
      <span className={s.stepIcon} aria-hidden>
        <ThinkingDots className={s.runningDots} label="" />
      </span>
    )
  }
  return (
    <span className={s.stepIcon} aria-hidden>
      {expandable
        ? (expanded ? <ChevronDownRegular fontSize={14} /> : <ChevronRightRegular fontSize={14} />)
        : <ChevronRightRegular fontSize={14} style={{ opacity: 0.35 }} />}
    </span>
  )
}

const STATUS_LABEL: Record<ChatToolStep['status'], string> = {
  running: '执行中',
  done: '已完成',
  error: '执行出错',
}

function formatStepTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function CopyButton({ text }: { text: string }) {
  const s = useStyles()
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    void copyTextToClipboard(text).then((ok) => {
      if (!ok) return
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  }, [text])
  return (
    <button
      type="button"
      className={s.detailCopyBtn}
      onClick={handleCopy}
      aria-label={copied ? '已复制' : '复制内容'}
    >
      {copied ? <CheckmarkRegular fontSize={13} /> : <CopyRegular fontSize={13} />}
      {copied ? '已复制' : '复制'}
    </button>
  )
}

interface StepDetailDialogProps {
  step: ChatToolStep
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** 步骤完整详情弹窗 — 展示入参、分析思路、结果与执行信息。 */
function StepDetailDialog({ step, open, onOpenChange }: StepDetailDialogProps) {
  const s = useStyles()
  const started = formatStepTime(step.startedAt)
  const finished = formatStepTime(step.finishedAt)
  // 优先展示完整参数 / 结果详情，回退到行内预览（兼容旧会话数据）。
  const args = step.argsDetail || step.argsPreview
  const result = step.resultDetail || step.resultPreview

  return (
    <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)}>
      <DialogSurface className={mergeClasses(s.dialogSurface, 'opptrix-dialog-surface')}>
        <DialogBody>
          <DialogTitle>
            <div className={s.dialogTitleRow}>
              <div className={s.dialogTitleMain}>
                <Text className={s.dialogTitle} block>{step.label}</Text>
                {step.tool && <Text className={s.dialogSubtitle} block>{step.tool}</Text>}
              </div>
              <button
                type="button"
                className={s.dialogClose}
                onClick={() => onOpenChange(false)}
                aria-label="关闭"
              >
                <DismissRegular fontSize={16} />
              </button>
            </div>
          </DialogTitle>
          <DialogContent>
            <div className={mergeClasses(s.dialogScroll, 'opptrix-scroll')}>
              {isToolStepResultTruncated(step) ? (
                <Text className={s.detailTruncBanner} block>
                  {TOOL_RESULT_TRUNCATED_DETAIL_HINT}
                </Text>
              ) : null}
              <div className={s.detailSection}>
                <div className={s.detailSectionHead}>
                  <Text className={s.detailSectionTitle} block>执行信息</Text>
                </div>
                <Text className={s.detailMeta} block>
                  {STATUS_LABEL[step.status]}
                  {started ? ` · 开始 ${started}` : ''}
                  {finished ? ` · 完成 ${finished}` : ''}
                </Text>
              </div>
              {args && (
                <div className={s.detailSection}>
                  <div className={s.detailSectionHead}>
                    <Text className={s.detailSectionTitle} block>调用参数</Text>
                    <CopyButton text={args} />
                  </div>
                  <Text className={mergeClasses(s.detailSectionMono, 'opptrix-scroll')} block>{args}</Text>
                </div>
              )}
              {step.thinking && (
                <div className={s.detailSection}>
                  <div className={s.detailSectionHead}>
                    <Text className={s.detailSectionTitle} block>分析思路</Text>
                  </div>
                  <Text className={s.detailSectionText} block>{step.thinking}</Text>
                </div>
              )}
              {result && (
                <div className={s.detailSection}>
                  <div className={s.detailSectionHead}>
                    <Text className={s.detailSectionTitle} block>执行结果</Text>
                    <CopyButton text={result} />
                  </div>
                  <Text className={mergeClasses(s.detailSectionMono, 'opptrix-scroll')} block>{result}</Text>
                </div>
              )}
            </div>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

interface StepRowProps {
  step: ChatToolStep
  live?: boolean
  defaultExpanded?: boolean
}

function StepRow({ step, live = false, defaultExpanded = false }: StepRowProps) {
  const s = useStyles()
  const expandable = hasExpandableContent(step)
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [detailOpen, setDetailOpen] = useState(false)
  const running = live && step.status === 'running'

  const truncated = isToolStepResultTruncated(step)
  const argsPreview = step.argsPreview?.trim() || ''
  const truncHint = !running && truncated ? TOOL_RESULT_TRUNCATED_STEP_HINT : ''
  const secondaryLine = [argsPreview, truncHint].filter(Boolean).join(' · ')
  const head = (
    <>
      <StepLead running={running} expandable={expandable} expanded={expanded} />
      <div className={s.stepLabelCol}>
        <Text
          className={mergeClasses(
            s.stepLabel,
            running && s.stepLabelRunning,
            step.status === 'error' && s.stepLabelError,
          )}
          block
          title={step.label}
        >
          {step.label}
          {running ? '…' : ''}
        </Text>
        {secondaryLine ? (
          <Text className={s.stepTruncHint} block title={secondaryLine}>
            {secondaryLine}
          </Text>
        ) : null}
      </div>
    </>
  )

  return (
    <div className={s.stepRow}>
      <div className={s.stepHeadRow}>
        {expandable ? (
          <button
            type="button"
            className={s.stepHead}
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
          >
            {head}
          </button>
        ) : (
          <div className={s.stepHead} aria-disabled>
            {head}
          </div>
        )}
        {!running && (
          <button
            type="button"
            className={s.detailBtn}
            onClick={() => setDetailOpen(true)}
            title="查看步骤详情"
            aria-label={`查看「${step.label}」的详情`}
          >
            <DocumentSearchRegular fontSize={14} />
          </button>
        )}
      </div>
      {expandable && expanded && (
        <div className={s.stepBody}>
          {truncated ? (
            <Text className={s.detailTruncBanner} block>
              {TOOL_RESULT_TRUNCATED_DETAIL_HINT}
            </Text>
          ) : null}
          {step.thinking && (
            <Text className={mergeClasses(s.detailBlock, 'opptrix-scroll')} block>
              {`【分析思路】\n${step.thinking}`}
            </Text>
          )}
          {step.resultDetail && (
            <Text className={mergeClasses(s.detailBlock, 'opptrix-scroll')} block>
              {step.resultDetail}
            </Text>
          )}
          {!step.resultDetail && step.resultPreview && (
            <Text className={mergeClasses(s.detailBlock, 'opptrix-scroll')} block>
              {step.resultPreview}
            </Text>
          )}
        </div>
      )}
      {!running && (
        <StepDetailDialog step={step} open={detailOpen} onOpenChange={setDetailOpen} />
      )}
    </div>
  )
}

interface ReasoningTimelineProps {
  segments: ReasoningSegment[]
  /** live：展开并跟随末段滚动 */
  active: boolean
  /**
   * 是否用内部 maxHeight + overflow 约束滚动；默认 true。
   * active=false 或显式 false 时不约束，避免嵌套 overflow 在手风琴折叠下高度算成 0。
   */
  constrained?: boolean
}

/** 思考竖轴 — 复用 step 视觉；多段显示「第 N 段思路」，单段省略段标题。
 * live 时不另起 spinner 行：状态由外层 ChatProcessTrace 状态头统一承载，避免双 spinner。 */
function ReasoningTimeline({ segments, active, constrained }: ReasoningTimelineProps) {
  const s = useStyles()
  const bodyScrollRef = useRef<HTMLDivElement>(null)
  const showLabels = segments.length > 1
  const lastLen = segments[segments.length - 1]?.content.length ?? 0
  const scrollConstrained = active && (constrained ?? true)

  useEffect(() => {
    if (!active || !scrollConstrained) return
    const el = bodyScrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [active, scrollConstrained, segments.length, lastLen])

  return (
    <div className={s.stepRow}>
      <div
        ref={scrollConstrained ? bodyScrollRef : undefined}
        className={mergeClasses(
          scrollConstrained ? s.detailBlock : s.detailFlow,
          scrollConstrained && 'opptrix-scroll',
        )}
        aria-label={active ? '正在梳理思路' : undefined}
      >
        <div className={s.timeline}>
          {segments.map((seg, index) => {
            const isLast = index === segments.length - 1
            const time = formatStepTime(seg.at)
            const label = showLabels
              ? (seg.label?.trim() || formatReasoningSegmentLabel(index + 1))
              : undefined
            return (
              <div key={`seg-${index}-${seg.round ?? ''}`} className={s.timelineItem}>
                <div className={s.timelineRail} aria-hidden>
                  <span
                    className={mergeClasses(
                      s.timelineDot,
                      active && isLast && s.timelineDotActive,
                    )}
                  />
                  {!isLast && <span className={s.timelineLine} />}
                </div>
                <div className={s.timelineBody}>
                  {(label || time) && (
                    <div className={s.timelineHead}>
                      {label && (
                        <Text className={s.timelineLabel} block>{label}</Text>
                      )}
                      {time && (
                        <Text className={s.timelineTime} block>{time}</Text>
                      )}
                    </div>
                  )}
                  <Text className={s.thinkingSnippet} block>
                    {seg.content}
                  </Text>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface Props {
  steps: ChatToolStep[]
  sessionId?: string | null
  thinkingLabel?: string
  phaseLabel?: string
  estimatedTokens?: number
  thinkingSnippet?: string
  thinkingSegments?: ReasoningSegment[]
  live?: boolean
  hiddenPreviewStepIds?: ReadonlySet<string>
  /** 正式回复流式中：过程区由 Reply 气泡承载 */
  replyActive?: boolean
}

export default function ChatProcessTrace({
  steps,
  sessionId = null,
  thinkingLabel,
  phaseLabel,
  estimatedTokens,
  thinkingSnippet,
  thinkingSegments,
  live = false,
  hiddenPreviewStepIds,
  replyActive = false,
}: Props) {
  const s = useStyles()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const [thinkingExpanded, setThinkingExpanded] = useState(false)
  const [statusDismissed, setStatusDismissed] = useState(false)

  const segments = resolveReasoningSegments(thinkingSegments, thinkingSnippet)
  const runningStep = live ? steps.find(st => st.status === 'running') : null
  const modelThinking = live && !runningStep
  const statusLabel = live
    ? resolveInvestorStatusLabel({ phaseLabel, steps })
      ?? resolveLiveTraceStatusLabel({ phaseLabel, estimatedTokens, steps, thinkingLabel })
    : undefined
  const thinkingSummary = buildThinkingSummary(segments)
  const sourceChips = extractSourceChips(steps)
  const receiptText = buildTraceReceipt(steps, !live)
  const hasThinking = segments.length > 0
  const previewSteps = steps.filter(step => (
    step.tool === 'propose_widget' && !hiddenPreviewStepIds?.has(step.id)
  ))
  const planSteps = steps.filter(step => fetchPlanFromToolStep(step) != null)
  const lastPlanId = planSteps[planSteps.length - 1]?.id
  const otherSteps = steps.filter(step => step.tool !== 'propose_widget')
  const detailStepCount = countHiddenDetailSteps(steps)
  const showDetailsToggle = detailStepCount > 0 || hasThinking
  const lastPreviewId = previewSteps[previewSteps.length - 1]?.id
  const detailsToggleLabel = detailsExpanded
    ? '收起详细过程'
    : '展开详细过程'

  useEffect(() => {
    if (!live) return
    setStatusDismissed(false)
    setDetailsExpanded(false)
    setThinkingExpanded(false)
  }, [live, phaseLabel])

  useEffect(() => {
    if (!live || !detailsExpanded) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [live, detailsExpanded, steps.length, segments.length])

  if (live && replyActive) return null

  const showLiveStatus = live && statusLabel && !statusDismissed
  const showLiveThinking = live && thinkingSummary && !statusDismissed
  const showLivePreviews = live && !statusDismissed
  const showHistoryReceipt = !live && Boolean(receiptText)

  const hasPreviews = previewSteps.length > 0
  const hasPlans = planSteps.length > 0
  if (!live && !showHistoryReceipt && !showDetailsToggle && !hasPreviews && !hasPlans) {
    return null
  }

  if (live && statusDismissed && !hasPreviews && !showDetailsToggle && !showLiveThinking) {
    return null
  }

  const thinkingToggleLabel = thinkingSummary
    ? (thinkingExpanded
      ? '分析过程'
      : `分析过程${thinkingSummary.durationSec ? ` · ${thinkingSummary.durationSec} 秒` : ''}`)
    : ''

  return (
    <div className={s.root} data-chat-process-trace={live ? 'live' : 'history'}>
      {showHistoryReceipt && receiptText && (
        <ChatStreamReceipt
          text={receiptText}
          onExpand={showDetailsToggle ? () => setDetailsExpanded(true) : undefined}
        />
      )}

      {showLiveStatus && (
        <div className={s.statusCard}>
          <div className={s.statusHeadRow}>
            <div className={s.statusHeadMain}>
              {modelThinking ? (
                <span className={s.stepIcon} aria-hidden>
                  <ThinkingDots className={s.runningDots} label="" />
                </span>
              ) : (
                <SparkleRegular className={s.leadIcon} aria-hidden />
              )}
              <Text
                className={mergeClasses(
                  s.statusText,
                  modelThinking && s.statusTextRunning,
                )}
                block
              >
                {statusLabel}
              </Text>
            </div>
            <button
              type="button"
              className={s.inlineAction}
              onClick={() => setStatusDismissed(true)}
            >
              收起
            </button>
          </div>
          {sourceChips.length > 0 && (
            <div className={s.sourceChipRow}>
              {sourceChips.map(chip => (
                <span key={chip} className={s.sourceChip}>{chip}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {showLiveThinking && (
        <>
          <button
            type="button"
            className={s.summaryBar}
            onClick={() => setThinkingExpanded(v => !v)}
            aria-expanded={thinkingExpanded}
          >
            <span className={s.summaryChevron} aria-hidden>
              {thinkingExpanded
                ? <ChevronDownRegular fontSize={14} />
                : <ChevronRightRegular fontSize={14} />}
            </span>
            <Text className={s.summaryLabel} block>{thinkingToggleLabel}</Text>
          </button>
          <Text className={s.thinkingSummaryBody} block>
            {thinkingSummary.line}
          </Text>
          {thinkingExpanded && (
            <div className={mergeClasses(s.scrollWrapper, 'opptrix-scroll')}>
              <div className={s.stepBody}>
                <ReasoningTimeline segments={segments} active={false} constrained={false} />
              </div>
            </div>
          )}
        </>
      )}

      {showLivePreviews && planSteps.map(step => (
        <ResearchFetchPlanCard
          key={step.id}
          step={step}
          sessionId={sessionId}
          live={live}
          isLatest={step.id === lastPlanId}
        />
      ))}

      {showLivePreviews && previewSteps.map(step => (
        <div
          key={step.id}
          className={mergeClasses(
            live && step.id === lastPreviewId && step.status === 'done' && s.previewEmphasis,
          )}
        >
          <ResearchWidgetPreviewCard step={step} sessionId={sessionId} />
        </div>
      ))}

      {!live && planSteps.map(step => (
        <ResearchFetchPlanCard
          key={step.id}
          step={step}
          sessionId={sessionId}
          live={false}
          isLatest={step.id === lastPlanId}
        />
      ))}

      {!live && previewSteps.map(step => (
        <ResearchWidgetPreviewCard key={step.id} step={step} sessionId={sessionId} />
      ))}

      {showDetailsToggle && (
        <>
          <button
            type="button"
            className={s.summaryBar}
            onClick={() => setDetailsExpanded(v => !v)}
            aria-expanded={detailsExpanded}
          >
            <span className={s.summaryChevron} aria-hidden>
              {detailsExpanded
                ? <ChevronDownRegular fontSize={14} />
                : <ChevronRightRegular fontSize={14} />}
            </span>
            <Text className={s.summaryLabel} block>{detailsToggleLabel}</Text>
          </button>
          {detailsExpanded && (
            <div
              ref={live ? scrollRef : undefined}
              className={mergeClasses(s.scrollWrapper, 'opptrix-scroll')}
            >
              {hasThinking && (
                <div className={s.stepBody}>
                  <ReasoningTimeline segments={segments} active={false} constrained={false} />
                </div>
              )}
              {otherSteps.length > 0 && (
                <div className={s.stepList}>
                  {otherSteps.map(step => (
                    <StepRow key={step.id} step={step} live={live} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** 流式回复气泡外壳：Receipt + 正文 */
export function ChatStreamReplyShell({
  receiptText,
  children,
}: {
  receiptText?: string | null
  children: import('react').ReactNode
}) {
  const s = useStyles()
  return (
    <div className={s.replyShell}>
      {receiptText ? <ChatStreamReceipt text={receiptText} /> : null}
      {children}
    </div>
  )
}
