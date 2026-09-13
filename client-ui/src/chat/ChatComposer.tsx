import { useRef, useEffect, useCallback, useState, useMemo, forwardRef, useImperativeHandle } from 'react'
import { Text, makeStyles, mergeClasses } from '@fluentui/react-components'
import { ArrowUpRegular, DismissRegular, MicFilled, MicRegular, PauseFilled } from '@fluentui/react-icons'
import ModelSelector from './ModelSelector'
import type { SessionLlmParamsPatch } from './ModelSelector'
import ContextUsageMeter from './ContextUsageMeter'
import ComposerContextRefTag from './ComposerContextRefTag'
import ComposerActiveWidgetChip from './ComposerActiveWidgetChip'
import ChatWorkspaceGrants, { type ChatWorkspaceGrantsHandle } from './ChatWorkspaceGrants'
import ComposerPlusMenu from './ComposerPlusMenu'
import ComposerStockMentionList from './ComposerStockMentionList'
import ComposerSkillSlashList from './ComposerSkillSlashList'
import ComposerAgentUserPromptPanel from './ComposerAgentUserPromptPanel'
import ComposerPromptQueuePanel from './ComposerPromptQueuePanel'
import ComposerBackgroundJobsBar from './ComposerBackgroundJobsBar'
import ComposerCollaborationTasksBar from './ComposerCollaborationTasksBar'
import type { QueuedPrompt } from './sessionPromptQueue'
import type { SessionBackgroundJob } from './jobWatchProgress'
import {
  isActiveCollaborationStatus,
  type SessionCollaborationTask,
} from './sessionCollaborationTasks'
import OpptrixButton from '../components/opptrix/OpptrixButton'
import { useWatchlist } from '../market/useWatchlist'
import { useStockMention } from './useStockMention'
import { findSlashTrigger, useSkillSlash } from './useSkillSlash'
import { skillDisplayTitle } from './skillDisplay'
import type { AvailableModel, ChatAttachmentMeta, ChatContextUsage, SessionContextRef, SessionLlmParams } from '../types/chat'
import type { ChatUserPromptPayload, UserPromptAnswerPayload } from '../types/chatProgress'
import type { WatchlistItem } from '../types/market'
import type { PublicAgentSkill } from '../api/client'
import {
  displayCodeFromInstrument,
  marketDisplayName,
  prepareWatchlistItemForStore,
  resolveWatchlistInstrument,
  watchlistItemKey,
} from '../market/instrument'
import {
  captureCaretRange,
  clearEditor,
  collectChipKeys,
  createChipElement,
  editorHasContent,
  focusEditorEnd,
  focusEditorStart,
  getCaretTextContext,
  getSendText,
  insertChipAtCaret,
  insertLineBreakAtCaret,
  insertMentionChip,
  insertSlashChip,
  insertTextAtCaret,
  normalizeEmptyEditor,
  setEditorText,
  type InlineChipData,
} from './composerEditor'
import { useComposerSpeech } from './useComposerSpeech'
import ComposerSpeechListeningBar from './ComposerSpeechListeningBar'
import ComposerMobileHoldSpeechLabel from './ComposerMobileHoldSpeechLabel'
import { useComposerMobileHoldSpeech } from './useComposerMobileHoldSpeech'
import { unlockChatCueSound } from '../platform/chatSound'
import { opptrixTokens, opptrixCssVars } from '../theme/tokens'
import { motion, primaryInteractive, ghostInteractive, interactiveTransition, fadeInUp } from '../theme/mixins'
import ComposerAttachmentStrip from './ComposerAttachmentStrip'
import { useComposerAttachments } from './useComposerAttachments'
import { resolveActiveModelMedia, modelAllowsAttachments, buildAcceptForMedia, isLegacyOfficeAttachment } from './mediaCapabilities'
import { listRowKey } from '../utils/listRowKey'
import { useOpptrixDialogAlert } from '../components/opptrix/OpptrixDialogAlert'

const LINE_HEIGHT = 1.45
const FONT_SIZE = 14
const ROW_PX = Math.round(FONT_SIZE * LINE_HEIGHT)
	/** 空态约一行；多行仍可长到 MAX */
	const MIN_TEXT_HEIGHT = ROW_PX
	const MAX_TEXT_HEIGHT = ROW_PX * 8
const ACTION_BTN = 32

const useStyles = makeStyles({
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    width: '100%',
    backgroundColor: 'transparent',
  },
  startersSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: `0 ${opptrixTokens.chatComposerPadding}`,
    boxSizing: 'border-box',
  },
  /** 空态入场；勿写死 opacity:0，否则常驻态关掉动画后会一直隐形 */
  startersSectionEnter: {
    ...fadeInUp,
    animationDuration: '420ms',
    animationDelay: '0.75s',
  },
  startersLabel: {
    fontSize: 'var(--opptrix-font-sm)',
    fontWeight: 400,
    color: opptrixCssVars.textTertiary,
    letterSpacing: '0.01em',
    paddingLeft: '2px',
  },
  starters: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    width: '100%',
  },
  /** 专家快捷：贴在 composer 输入区顶部；与「接下来」分区（无标题，省纵向空间） */
  expertStarterBar: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    boxSizing: 'border-box',
    margin: '0 0 2px',
    padding: '0 0 8px',
    borderBottom: `1px solid ${opptrixCssVars.separator}`,
    overflow: 'hidden',
  },
  expertStarterTrack: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    overflowX: 'hidden',
    overflowY: 'hidden',
  },
  starterChip: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    minHeight: 'unset',
    height: 'auto',
    justifyContent: 'flex-start',
    textAlign: 'left',
    borderRadius: opptrixTokens.radiusMd,
    fontWeight: 400,
    fontSize: 'var(--opptrix-font-md)',
    lineHeight: 1.45,
    padding: '8px 10px',
    border: 'none',
    backgroundColor: opptrixCssVars.inputBg,
    color: opptrixCssVars.textSecondary,
    whiteSpace: 'normal',
    transitionProperty: 'background-color, color, opacity',
    transitionDuration: motion.fast,
    ':hover': {
      backgroundColor: opptrixCssVars.inputBgHover,
      color: opptrixCssVars.textPrimary,
      border: 'none',
    },
    ':active': {
      backgroundColor: opptrixCssVars.inputBgFocus,
      transform: 'none',
    },
    ':focus-visible': {
      outline: `${opptrixTokens.focusRingWidth} solid ${opptrixCssVars.inputBorderFocus}`,
      outlineOffset: opptrixTokens.focusRingOffset,
    },
  },
  expertStarterChip: {
    backgroundColor: 'transparent',
  },
  panelWrap: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: 'transparent',
  },
  panel: {
    ...interactiveTransition,
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    boxSizing: 'border-box',
	    padding: '8px 12px',
	    gap: '8px',
    borderRadius: opptrixTokens.chatComposerRadius,
    border: 'none',
    backgroundColor: opptrixCssVars.canvasAlt,
    backdropFilter: 'blur(12px) saturate(180%)',
    boxShadow: 'none',
    '@media (prefers-reduced-transparency: reduce)': {
      backdropFilter: 'none',
    },
    ':hover': {
      backgroundColor: opptrixCssVars.canvasMuted,
      boxShadow: 'none',
    },
    ':focus-within': {
      backgroundColor: opptrixCssVars.canvas,
      boxShadow: `inset 0 0 0 1px ${opptrixCssVars.separator}`,
    },
  },
	  panelMobileCompact: {
	    padding: '8px 10px',
	    gap: '8px',
	  },
	  focusHint: {
	    position: 'absolute',
	    left: 0,
	    right: 0,
	    bottom: '100%',
	    zIndex: 2,
	    fontSize: 'var(--opptrix-font-sm)',
	    fontWeight: 400,
	    lineHeight: 1.35,
	    color: opptrixCssVars.textTertiary,
	    letterSpacing: '0.01em',
	    padding: '0 12px 4px',
	    boxSizing: 'border-box',
	    pointerEvents: 'none',
	    animationDuration: motion.normal,
	    animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
	    animationFillMode: 'both',
	    animationName: {
	      from: { opacity: 0, transform: 'translateY(2px)' },
	      to: { opacity: 1, transform: 'translateY(0)' },
	    },
	    '@media (prefers-reduced-motion: reduce)': {
	      animationName: {
	        from: { opacity: 0 },
	        to: { opacity: 1 },
	      },
	      transform: 'none',
	    },
	  },
	  inputRow: {
	    display: 'flex',
	    flexDirection: 'column',
	    gap: '8px',
	    width: '100%',
	  },
	  inputRowMobile: {
	    gap: '8px',
	  },
	  /** 空态单行：+ | editor | mic/send */
	  inputRowSingle: {
	    flexDirection: 'row',
	    alignItems: 'center',
	    gap: '8px',
	    minHeight: `${ACTION_BTN}px`,
	  },
	  /** 上行：全宽 editor（录音中仍可见已输入文字） */
	  editorRow: {
	    position: 'relative',
	    width: '100%',
	    minWidth: 0,
	    display: 'flex',
	    alignItems: 'center',
	  },
	  /** 空态单行内 editor：与 32px 按钮同高 */
	  editorRowInline: {
	    flex: '1 1 auto',
	    width: 'auto',
	    minHeight: `${ACTION_BTN}px`,
	  },
	  /** 手机紧凑态：editor 保留 DOM，供 focus / 草稿 / 转写 */
	  editorRowCollapsedMobile: {
	    display: 'none',
	  },
	  mentionAnchor: {
	    position: 'absolute',
	    left: 0,
	    bottom: '2px',
	    width: '24px',
	    height: '20px',
	    pointerEvents: 'none',
	  },
  editor: {
    position: 'relative',
    width: '100%',
    minWidth: 0,
    minHeight: `${MIN_TEXT_HEIGHT}px`,
    maxHeight: `${MAX_TEXT_HEIGHT}px`,
    overflowY: 'auto',
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontSize: `${FONT_SIZE}px`,
    lineHeight: LINE_HEIGHT,
    fontFamily: 'inherit',
	    color: opptrixCssVars.textPrimary,
	    padding: '4px 0 2px',
	    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    cursor: 'text',
  },
	  editorInline: {
	    padding: 0,
	    minHeight: `${ACTION_BTN}px`,
	    maxHeight: `${ACTION_BTN}px`,
	    overflowY: 'hidden',
	    display: 'flex',
	    alignItems: 'center',
	  },
	  editorMobile: {
	    fontSize: 'var(--opptrix-font-2xl)',
	  },
  /** 下行 toolbar：左 +/授权 | 中弹性空白 | 右 mic+send / stop；与 28px 按钮齐平 */
  toolbarRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    width: '100%',
    height: `${ACTION_BTN}px`,
    minHeight: `${ACTION_BTN}px`,
    padding: 0,
    boxSizing: 'border-box',
  },
  toolbarRowInline: {
    width: 'auto',
    flex: '0 0 auto',
  },
  toolbarStart: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flex: '0 0 auto',
    minWidth: 0,
    height: `${ACTION_BTN}px`,
  },
  toolbarStartMobile: {
    flex: '0 0 auto',
  },
  toolbarCenter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '1 1 auto',
    minWidth: 0,
    height: `${ACTION_BTN}px`,
    overflow: 'hidden',
  },
  toolbarCenterMobile: {
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
    height: 'auto',
    minHeight: `${ACTION_BTN}px`,
  },
  toolbarEnd: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '4px',
    flex: '0 1 auto',
    minWidth: 0,
    height: `${ACTION_BTN}px`,
  },
  toolbarEndMobile: {
    alignItems: 'center',
    height: `${ACTION_BTN}px`,
    minHeight: `${ACTION_BTN}px`,
    gap: '6px',
    flexShrink: 0,
  },
  /**
   * 录音/识别：纵向柱波叠在整个 panel 正中（非 toolbar 中缝）。
   * 轻遮罩挡住空态 placeholder / 底稿；overlay 不拦截点击，ListeningBar 自身 pointer-events:auto。
   */
	  speechListeningOverlay: {
	    position: 'absolute',
	    inset: 0,
	    zIndex: 2,
	    display: 'flex',
	    alignItems: 'center',
	    justifyContent: 'center',
	    pointerEvents: 'none',
	    padding: '8px 12px',
	    boxSizing: 'border-box',
	    borderRadius: opptrixTokens.chatComposerRadius,
	    backgroundColor: 'color-mix(in srgb, var(--opptrix-input-bg) 92%, transparent)',
	  },
	  /** 手机聆听：遮罩拦截触摸，避免穿透选中底稿 */
	  speechListeningOverlayMobileCapture: {
	    pointerEvents: 'auto',
	    touchAction: 'none',
	    WebkitUserSelect: 'none',
	    userSelect: 'none',
	    WebkitTouchCallout: 'none',
	  },
  /** 手机：柱波居中，右侧关闭 */
  speechListeningOverlayMobile: {
    justifyContent: 'flex-start',
    gap: '6px',
  },
  speechListeningCenter: {
    flex: '1 1 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    pointerEvents: 'none',
  },
  speechListeningDismiss: {
    ...ghostInteractive,
    pointerEvents: 'auto',
    flexShrink: 0,
    alignSelf: 'center',
    borderRadius: opptrixTokens.radiusFull,
    minWidth: `${ACTION_BTN}px`,
    maxWidth: `${ACTION_BTN}px`,
    width: `${ACTION_BTN}px`,
    minHeight: `${ACTION_BTN}px`,
    maxHeight: `${ACTION_BTN}px`,
    height: `${ACTION_BTN}px`,
    padding: 0,
    color: opptrixCssVars.textSecondary,
    backgroundColor: opptrixCssVars.surfaceMuted,
    ':hover': {
      backgroundColor: opptrixCssVars.surfaceHover,
      color: opptrixCssVars.textPrimary,
    },
  },
  /** 发送 / 停止：accent 实心圆 */
  sendBtn: {
    ...primaryInteractive,
    borderRadius: opptrixTokens.radiusFull,
    minWidth: `${ACTION_BTN}px`,
    maxWidth: `${ACTION_BTN}px`,
    width: `${ACTION_BTN}px`,
    minHeight: `${ACTION_BTN}px`,
    maxHeight: `${ACTION_BTN}px`,
    height: `${ACTION_BTN}px`,
    padding: 0,
    flexShrink: 0,
  },
	  /**
	   * 麦克风次级：透明图标；静止无实心底，hover 极轻 surfaceHover。
	   * 显式清背景与伪层，盖住 Fluent appearance 残留。
	   */
	  micBtnGhost: {
	    ...ghostInteractive,
	    borderRadius: opptrixTokens.radiusFull,
	    minWidth: `${ACTION_BTN}px`,
	    maxWidth: `${ACTION_BTN}px`,
	    width: `${ACTION_BTN}px`,
	    minHeight: `${ACTION_BTN}px`,
	    maxHeight: `${ACTION_BTN}px`,
	    height: `${ACTION_BTN}px`,
	    padding: 0,
	    flexShrink: 0,
	    color: opptrixCssVars.textSecondary,
	    backgroundColor: 'transparent',
	    backgroundImage: 'none',
	    /* 缩短背景过渡，减少从录音红圆切回时的残影感 */
	    transitionProperty: 'color, opacity, border-color, box-shadow',
	    transitionDuration: motion.fast,
	    ':hover': {
	      backgroundColor: opptrixCssVars.surfaceHover,
	      backgroundImage: 'none',
	      color: opptrixCssVars.textPrimary,
	    },
	    ':active': {
	      backgroundColor: opptrixCssVars.surfaceHover,
	      backgroundImage: 'none',
	      opacity: opptrixTokens.activeOpacity,
	    },
	    ':focus': {
	      backgroundColor: 'transparent',
	      backgroundImage: 'none',
	    },
	    '::after': {
	      backgroundColor: 'transparent',
	      backgroundImage: 'none',
	    },
	  },
  /** 录音中底座：与红圆叠加；不用 primaryInteractive，避免切态残留 accent */
  micBtnRecordingBase: {
    borderRadius: opptrixTokens.radiusFull,
    minWidth: `${ACTION_BTN}px`,
    maxWidth: `${ACTION_BTN}px`,
    width: `${ACTION_BTN}px`,
    minHeight: `${ACTION_BTN}px`,
    maxHeight: `${ACTION_BTN}px`,
    height: `${ACTION_BTN}px`,
    padding: 0,
    flexShrink: 0,
    border: 'none',
    backgroundImage: 'none',
  },
  stopBtn: {
    ...primaryInteractive,
    borderRadius: opptrixTokens.radiusFull,
    minWidth: `${ACTION_BTN}px`,
    maxWidth: `${ACTION_BTN}px`,
    width: `${ACTION_BTN}px`,
    minHeight: `${ACTION_BTN}px`,
    maxHeight: `${ACTION_BTN}px`,
    height: `${ACTION_BTN}px`,
    padding: 0,
    flexShrink: 0,
    backgroundColor: opptrixCssVars.textSecondary,
    ':hover': {
      backgroundColor: opptrixCssVars.textPrimary,
      color: opptrixCssVars.accentForeground,
    },
  },
  error: {
    fontSize: 'var(--opptrix-font-base)',
    color: opptrixCssVars.error,
    padding: `0 0 0 ${opptrixTokens.chatComposerPadding}`,
    animationDuration: motion.fast,
    animationName: {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
  },
  /**
   * 录音中：红色实心圆。须压过 Opptrix ghost / Fluent subtle 的 hover color（textPrimary），
   * 图标保持 accentForeground；背景仅略加深，勿变黑底。
   */
  micRecording: {
    backgroundColor: opptrixCssVars.error,
    color: opptrixCssVars.accentForeground,
    ':hover': {
      backgroundColor: `color-mix(in srgb, ${opptrixCssVars.error} 88%, ${opptrixCssVars.textPrimary})`,
      color: opptrixCssVars.accentForeground,
    },
    ':active': {
      backgroundColor: `color-mix(in srgb, ${opptrixCssVars.error} 80%, ${opptrixCssVars.textPrimary})`,
      color: opptrixCssVars.accentForeground,
    },
    ':focus': {
      color: opptrixCssVars.accentForeground,
    },
    ':focus-visible': {
      color: opptrixCssVars.accentForeground,
    },
    '& .fui-Button__icon': {
      color: opptrixCssVars.accentForeground,
    },
    '& svg': {
      color: opptrixCssVars.accentForeground,
      fill: 'currentColor',
    },
    ':hover .fui-Button__icon': {
      color: opptrixCssVars.accentForeground,
    },
    ':hover svg': {
      color: opptrixCssVars.accentForeground,
      fill: 'currentColor',
    },
    ':active .fui-Button__icon': {
      color: opptrixCssVars.accentForeground,
    },
    ':active svg': {
      color: opptrixCssVars.accentForeground,
      fill: 'currentColor',
    },
  },
  /**
   * 输入卡下方底栏：模型 + 上下文用量 + bottomInset。
   * 透明——消息淡出由 ChatView scrollViewport mask，底盘与主区同色/透底。
   */
  composerFooter: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: 'transparent',
    paddingBottom: '8px',
  },
  composerFooterMobile: {
    paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
  },
  /** 底栏单行：模型 | 上下文用量 */
  footerMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    minHeight: '22px',
    margin: '2px 0 0',
    padding: '0 12px',
    boxSizing: 'border-box',
  },
  footerMetaRowMobile: {
    margin: '2px 0 0',
    padding: '0 10px',
  },
  footerModel: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    flex: '0 1 auto',
    maxWidth: '168px',
    overflow: 'hidden',
  },
  streamStatusRow: {
    width: '100%',
    padding: '0 12px 4px',
    boxSizing: 'border-box',
  },
  streamStatusText: {
    fontSize: 'var(--opptrix-font-sm)',
    lineHeight: 1.35,
    color: opptrixCssVars.textTertiary,
    letterSpacing: '0.01em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  footerContextUsage: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: 'auto',
    width: '22px',
    height: '22px',
  },
})

interface ChatComposerProps {
  /** 父组件注入草稿（revision 递增时同步到输入框） */
  draftSync?: { revision: number; text: string }
  sessionId?: string | null
  loading: boolean
  error: string
  isEmpty: boolean
  /**
   * 为 true 时把 starters 挂到加号「快捷提问」次面板（专家对话）。
   * 普通对话仍仅在空态展示欢迎 chips。
   */
  alwaysShowStarters?: boolean
  isMobile?: boolean
  contextRef?: SessionContextRef | null
  starters: Array<{ label: string; text: string }>
  welcomeKey?: number
  availableModels: AvailableModel[]
  sessionModel?: string
  sessionLlmParams?: SessionLlmParams | null
  contextUsage?: ChatContextUsage | null
  onRefreshContextUsage?: () => void
  onSubmit: (text?: string, attachmentIds?: string[], attachmentMetas?: ChatAttachmentMeta[]) => void
  onStop?: () => void
  onModelChange?: (ref: string) => void
  onLlmParamsChange?: (patch: SessionLlmParamsPatch) => void
  artifactsEnabled?: boolean
  onToggleArtifacts?: (enabled: boolean) => void
  onClearContextRef?: () => void
  ensureSession?: () => Promise<string>
  userPrompt?: ChatUserPromptPayload | null
  userPromptSubmitting?: boolean
  onUserPromptSubmit?: (answer: UserPromptAnswerPayload) => void
  /** 当前会话待执行任务（pin 在 composer 上方） */
  promptQueue?: QueuedPrompt[]
  onPromptQueueRemove?: (id: string) => void
  onPromptQueueRunNow?: (id: string) => void
  /** 本会话未完成后台任务（位于 promptQueue 之上） */
  backgroundJobs?: SessionBackgroundJob[]
  onCancelBackgroundJob?: (jobId: string) => Promise<{ ok: boolean; error?: string }>
  /** 本会话协作任务（与 backgroundJobs 并列） */
  collaborationTasks?: SessionCollaborationTask[]
  onCancelCollaborationTask?: (runId: string) => Promise<{ ok: boolean; error?: string }>
  onDismissCollaborationTask?: (runId: string) => void
  /** 点协作任务条某项 → 切到对应协作 Tab */
  onSelectCollaborationRun?: (runId: string) => void
  onOpenPreview?: (sessionId: string, attachment: ChatAttachmentMeta) => void
  /**
   * 生成中且有协作任务时，placeholder 改为「发送补充说明」
   *（仍走 soft steer，不开启新对话）
   */
  collaborationSteerHint?: boolean
  /** 流式生成时与消息区 status 同步的一行提示 */
  streamStatusLabel?: string
}

/** 供 ChatView 在消息区 drop 时调用，避免重复 pin 状态 */
export type ChatComposerHandle = {
  addDroppedFiles: (files: FileList | File[]) => void
}

const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer({
  draftSync,
  sessionId = null,
  loading,
  error,
  isEmpty,
  alwaysShowStarters = false,
  isMobile = false,
  contextRef = null,
  starters,
  welcomeKey = 0,
  availableModels,
  sessionModel,
  sessionLlmParams,
  contextUsage,
  onRefreshContextUsage,
  onSubmit,
  onStop,
  onModelChange,
  onLlmParamsChange,
  artifactsEnabled = false,
  onToggleArtifacts,
  onClearContextRef,
  ensureSession,
  userPrompt = null,
  userPromptSubmitting = false,
  onUserPromptSubmit,
  promptQueue = [],
  onPromptQueueRemove,
  onPromptQueueRunNow,
  backgroundJobs = [],
  onCancelBackgroundJob,
  collaborationTasks = [],
  onCancelCollaborationTask,
  onDismissCollaborationTask,
  onSelectCollaborationRun,
  onOpenPreview,
  collaborationSteerHint = false,
  streamStatusLabel,
}, ref) {
  const s = useStyles()
  const editorRef = useRef<HTMLDivElement>(null)
  const mentionAnchorRef = useRef<HTMLSpanElement>(null)
  // composingRef: 中文/IME 输入合成期间，跳过 @ 提及检测，避免误触发与卡顿。
  const composingRef = useRef(false)
  // 最近一次编辑器内的光标快照：点菜单项插入 chip 时实时 selection 已被扰动，须用快照定位。
  const caretRangeRef = useRef<Range | null>(null)
  // 有无可发送内容（文字或 chip）；驱动发送按钮与 placeholder。
  const [hasContent, setHasContent] = useState(false)
  const [editorFocused, setEditorFocused] = useState(false)
  const [mobileInputExpanded, setMobileInputExpanded] = useState(false)
  const [speechError, setSpeechError] = useState('')
  const {
    pinned,
    uploading,
    toast: attachmentToast,
    fileInputRef,
    addFiles,
    removePinned,
    reconcileWithModel,
    clearPinned,
    openFilePicker,
    attachmentIds,
  } = useComposerAttachments(sessionId, ensureSession)

  const { confirm } = useOpptrixDialogAlert()

  const activeMedia = useMemo(
    () => resolveActiveModelMedia(availableModels, sessionModel),
    [availableModels, sessionModel],
  )

  const acceptTypes = useMemo(() => buildAcceptForMedia(activeMedia), [activeMedia])
  const attachmentsAllowed = modelAllowsAttachments(activeMedia)

  /** 选文件/拖拽上传前：旧格式确认；取消则跳过 .doc/.ppt，其余继续 */
  const offerFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files)
    if (!list.length) return
    const hasLegacy = list.some(isLegacyOfficeAttachment)
    if (!hasLegacy) {
      await addFiles(list, activeMedia)
      return
    }
    const ok = await confirm({
      title: '格式较旧',
      message: '这份文件格式较旧，请将其转换为PDF/DOCX格式后上传，否则文中的图片无法被识别。',
      confirmLabel: '仍要上传',
      cancelLabel: '取消',
    })
    const toUpload = ok ? list : list.filter(f => !isLegacyOfficeAttachment(f))
    if (toUpload.length) await addFiles(toUpload, activeMedia)
  }, [activeMedia, addFiles, confirm])

  useEffect(() => {
    reconcileWithModel(activeMedia)
  }, [activeMedia, reconcileWithModel])

  const { items: watchlistItems } = useWatchlist()

  const {
    state: mentionState,
    matches: mentionMatches,
    syncFromInput: syncMentionFromInput,
    close: closeMention,
    moveActive: moveMentionActive,
    clampActiveIndex,
    setMentionActiveIndex,
    universePrep: mentionUniversePrep,
    refreshingAfterPrep: mentionRefreshingAfterPrep,
  } = useStockMention(watchlistItems)

  const {
    state: slashState,
    matches: slashMatches,
    loading: slashLoading,
    loadError: slashLoadError,
    syncFromInput: syncSlashFromInput,
    close: closeSlash,
    moveActive: moveSlashActive,
    clampActiveIndex: clampSlashActiveIndex,
    setActiveIndex: setSlashActiveIndex,
  } = useSkillSlash()

  useEffect(() => {
    clampActiveIndex()
  }, [clampActiveIndex, mentionMatches.length])

  useEffect(() => {
    clampSlashActiveIndex()
  }, [clampSlashActiveIndex, slashMatches.length])

  // 从编辑器 DOM 刷新可发送状态；空态时去掉残留 <br>，避免光标落在 placeholder 右侧。
  const refreshContentState = useCallback(() => {
    const root = editorRef.current
    if (!root) {
      setHasContent(false)
      return
    }
    // IME 合成中不要清空 DOM，否则会打断拼音。
    if (!composingRef.current && normalizeEmptyEditor(root) && document.activeElement === root) {
      focusEditorStart(root)
    }
    setHasContent(editorHasContent(root))
  }, [])

  // 根据当前光标上下文，驱动 @ / 面板（互斥，同时只开一个）。
  const syncTriggers = useCallback(() => {
    if (composingRef.current) return
    const root = editorRef.current
    if (!root) return
    // 每次光标/输入变动都快照当前 Range，供随后「点菜单项」插入时定位。
    caretRangeRef.current = captureCaretRange(root)
    const { text, offset } = getCaretTextContext(root)
    // `/` 有效时优先技能面板，避免与 `@` 同时打开。
    if (findSlashTrigger(text, offset)) {
      syncSlashFromInput(text, offset)
      closeMention()
      return
    }
    closeSlash()
    syncMentionFromInput(text, offset)
  }, [closeMention, closeSlash, syncMentionFromInput, syncSlashFromInput])

  // 草稿同步（父组件注入）：重置编辑器为纯文本。
  useEffect(() => {
    if (!draftSync) return
    const root = editorRef.current
    if (!root) return
    setEditorText(root, draftSync.text)
    closeMention()
    closeSlash()
    refreshContentState()
    root.focus()
  }, [draftSync, closeMention, closeSlash, refreshContentState])

  const buildChipData = useCallback((item: WatchlistItem): InlineChipData | null => {
    const row = prepareWatchlistItemForStore(item)
    const ref = resolveWatchlistInstrument(row)
    if (!ref) return null
    const code = displayCodeFromInstrument(ref)
    const market = ref.market !== 'CN' ? marketDisplayName(ref.market) : null
    return {
      key: watchlistItemKey(row),
      sendText: `${row.name}(${code})`,
      name: row.name,
      code,
      market,
    }
  }, [])

  const insertStockChip = useCallback((item: WatchlistItem) => {
    const root = editorRef.current
    if (!root) return
    // 用光标快照定位，避免点菜单项时实时 selection 退化到编辑器末尾。
    const savedRange = caretRangeRef.current
    root.focus()
    const data = buildChipData(item)
    if (!data) {
      closeMention()
      return
    }
    if (collectChipKeys(root).includes(data.key)) {
      // 已存在同一标的：仅删除 @query 触发文本，不重复插入。
      const dup = createChipElement(data)
      insertMentionChip(root, dup, savedRange)
      dup.remove()
    } else {
      insertMentionChip(root, createChipElement(data), savedRange)
    }
    caretRangeRef.current = captureCaretRange(root)
    closeMention()
    closeSlash()
    refreshContentState()
  }, [buildChipData, closeMention, closeSlash, refreshContentState])

  const insertSkillChip = useCallback((skill: PublicAgentSkill, fromSlash = false) => {
    const root = editorRef.current
    if (!root) return
    const key = `skill:${skill.name}`
    const data: InlineChipData = {
      key,
      sendText: `@skill:${skill.name}`,
      name: skillDisplayTitle(skill),
    }
    root.focus()
    const savedRange = caretRangeRef.current
    if (collectChipKeys(root).includes(key)) {
      // 已引用同一技能：若来自 / 则仅删除触发段；否则聚焦末尾。
      if (fromSlash) {
        const dup = createChipElement(data)
        insertSlashChip(root, dup, savedRange)
        dup.remove()
      } else {
        focusEditorEnd(root)
      }
      closeSlash()
      closeMention()
      refreshContentState()
      return
    }
    if (fromSlash) {
      insertSlashChip(root, createChipElement(data), savedRange)
    } else {
      insertChipAtCaret(root, createChipElement(data), savedRange)
    }
    caretRangeRef.current = captureCaretRange(root)
    closeSlash()
    closeMention()
    refreshContentState()
  }, [closeMention, closeSlash, refreshContentState])

  const grantsRef = useRef<ChatWorkspaceGrantsHandle>(null)
  const pendingGrantsOpenRef = useRef(false)

  const handleSelectMention = useCallback((item: WatchlistItem) => {
    insertStockChip(item)
  }, [insertStockChip])

  const clearEditorContent = useCallback(() => {
    const root = editorRef.current
    if (root) {
      clearEditor(root)
      if (document.activeElement === root) focusEditorStart(root)
    }
    setHasContent(false)
  }, [])

  const handleSubmitMessage = useCallback((text?: string) => {
    const explicit = text?.trim()
    const metas = pinned.length ? pinned : undefined
    const ids = attachmentIds.length ? attachmentIds : undefined
    if (explicit) {
      onSubmit(explicit, ids, metas)
      clearEditorContent()
      clearPinned()
      return
    }
    const root = editorRef.current
    const composed = root ? getSendText(root).trim() : ''
    if ((!composed && !attachmentIds.length) || userPrompt || uploading) return
    onSubmit(composed || undefined, ids, metas)
    clearEditorContent()
    clearPinned()
  }, [attachmentIds, clearEditorContent, clearPinned, onSubmit, pinned, uploading, userPrompt])

  const hasSendPayload = hasContent || attachmentIds.length > 0
  const canEnqueueOrSend = hasSendPayload && !userPrompt && !uploading
  /** 生成中也可发送纯文字作为补充说明（soft steer） */
  const canSend = canEnqueueOrSend && (!loading || (hasContent && attachmentIds.length === 0))
  /** 仅 ask_user / 上传中锁定编辑；执行中仍可输入以补充或排队 */
  const composerLocked = Boolean(userPrompt) || uploading
  const showWelcomeStarters = starters.length > 0 && isEmpty && !alwaysShowStarters
  const plusMenuStarters = alwaysShowStarters && starters.length > 0 ? starters : []

  const handleAuthorizeFolders = useCallback(async () => {
    if (composerLocked) return
    if (!sessionId) {
      if (!ensureSession) return
      pendingGrantsOpenRef.current = true
      try {
        await ensureSession()
      } catch {
        pendingGrantsOpenRef.current = false
      }
      return
    }
    grantsRef.current?.open()
  }, [composerLocked, ensureSession, sessionId])

  useEffect(() => {
    if (!sessionId || !pendingGrantsOpenRef.current) return
    pendingGrantsOpenRef.current = false
    grantsRef.current?.open()
  }, [sessionId])

  const handleSpeechTranscript = useCallback((text: string) => {
    const root = editorRef.current
    if (!root) return
    insertTextAtCaret(root, text)
    refreshContentState()
    setSpeechError('')
  }, [refreshContentState])

  const {
    available: speechAvailable,
    phase: speechPhase,
    levelRms,
    isBusy: speechBusy,
    isRecording,
    toggle: toggleSpeech,
    start: startSpeech,
    stop: stopSpeech,
    cancel: cancelSpeech,
  } = useComposerSpeech({
    disabled: composerLocked || uploading,
    onTranscript: handleSpeechTranscript,
    onError: (message) => setSpeechError(message),
  })

  const mobileSpeechBaseEligible = isMobile
    && speechAvailable
    && !composerLocked
    && !uploading
    && !hasContent

  const openMobileInput = useCallback(() => {
    setMobileInputExpanded(true)
    window.requestAnimationFrame(() => {
      editorRef.current?.focus()
    })
  }, [])

  useEffect(() => {
    if (!isMobile) return
    if (hasContent || pinned.length > 0 || contextRef || speechBusy) {
      setMobileInputExpanded(true)
    }
  }, [contextRef, hasContent, isMobile, pinned.length, speechBusy])

  const showMobileEditorBlock = !isMobile
    || mobileInputExpanded
    || hasContent
    || pinned.length > 0
    || Boolean(contextRef)
    || speechBusy

  const {
    holdControlActive,
    holdPending,
    showMobileDismiss,
    handleHoldPointerDown,
    handleHoldPointerUp,
    handleMobileSpeechRelease,
    handleDismiss: handleMobileSpeechDismiss,
  } = useComposerMobileHoldSpeech({
    baseEligible: mobileSpeechBaseEligible,
    inputExpanded: mobileInputExpanded,
    editorFocused,
    mentionOpen: mentionState.open,
    slashOpen: slashState.open,
    composingRef,
    speechBusy,
    speechPhase,
    editorRef,
    startSpeech,
    stopSpeech,
    cancelSpeech,
    onTapToInput: openMobileInput,
  })

  const handleMicClick = useCallback(() => {
    if (isMobile) return
    unlockChatCueSound()
    toggleSpeech()
  }, [isMobile, toggleSpeech])

  const speechListening = speechBusy
  const speechListeningPhase = speechPhase !== 'idle' ? speechPhase : null

  /** 右侧：loading 或有进行中协作任务时显示停止；非 stop 时 mic / send */
  const hasActiveCollaboration = collaborationTasks.some((t) => isActiveCollaborationStatus(t.status))
  const showStop = loading || hasActiveCollaboration
  const stopAriaLabel = hasActiveCollaboration
    ? '停止生成与协作任务'
    : '停止生成'
  const showMic = !showStop && speechAvailable && !isMobile
  const showSend = canSend && !showStop

  const handleStopClick = useCallback(async () => {
    if (!onStop) return
    if (hasActiveCollaboration) {
      const ok = await confirm({
        title: '结束协作任务？',
        message: '将结束进行中的协作任务，结束后无法恢复。主对话若正在生成也会一并停止。',
        confirmLabel: '结束任务',
        cancelLabel: '继续等待',
        confirmTone: 'danger',
      })
      if (!ok) return
    }
    onStop()
  }, [confirm, hasActiveCollaboration, onStop])

  const mobileHoldLabel = holdPending ? '继续按住…' : '按住说话'
  const mobileHoldAriaLabel = holdPending
    ? '继续按住说话'
    : '按住说话；点按切换为文字输入'
  const editorPlaceholder = loading
    ? (collaborationSteerHint ? '发送补充说明…' : '继续输入…')
    : '输入问题…'
  const editorAriaLabel = '输入问题，@ 选择股票，/ 引用技能'
  const useSingleRowEmpty = !hasContent
    && pinned.length === 0
    && !contextRef
    && !speechListening
    && (!isMobile || showMobileEditorBlock)
  const showFocusHint = editorFocused
    && !hasContent
    && !speechListening
    && !loading
    && useSingleRowEmpty

  const handleInput = useCallback(() => {
    refreshContentState()
    syncTriggers()
  }, [refreshContentState, syncTriggers])

  const handleCompositionStart = useCallback(() => {
    composingRef.current = true
  }, [])

  const handleCompositionEnd = useCallback(() => {
    composingRef.current = false
    refreshContentState()
    syncTriggers()
  }, [refreshContentState, syncTriggers])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData.items
    const imageFiles: File[] = []
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const f = item.getAsFile()
        if (f) imageFiles.push(f)
      }
    }
    if (imageFiles.length) {
      e.preventDefault()
      void addFiles(imageFiles, activeMedia)
      return
    }
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    if (text) document.execCommand('insertText', false, text)
    refreshContentState()
    syncTriggers()
  }, [activeMedia, addFiles, refreshContentState, syncTriggers])

  useImperativeHandle(ref, () => ({
    addDroppedFiles: (files) => {
      if (composerLocked || uploading) return
      void offerFiles(files)
    },
  }), [composerLocked, offerFiles, uploading])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (composingRef.current) return

    if (slashState.open && slashMatches.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        moveSlashActive(1)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        moveSlashActive(-1)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const skill = slashMatches[slashState.activeIndex]
        if (skill) insertSkillChip(skill, true)
        return
      }
    }

    if (slashState.open && e.key === 'Escape') {
      e.preventDefault()
      closeSlash()
      return
    }

    if (mentionState.open && mentionMatches.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        moveMentionActive(1)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        moveMentionActive(-1)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const item = mentionMatches[mentionState.activeIndex]
        if (item) insertStockChip(item)
        return
      }
    }

    if (mentionState.open && e.key === 'Escape') {
      e.preventDefault()
      closeMention()
      return
    }

    if (e.key === 'Enter') {
      // Shift+Enter / Ctrl+Cmd+Enter: 插入换行。
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const root = editorRef.current
        if (root) {
          insertLineBreakAtCaret(root)
          refreshContentState()
        }
        return
      }
      // 普通 Enter：发送或加入排队。
      e.preventDefault()
      if (canEnqueueOrSend) handleSubmitMessage()
    }
  }

  const handleSelect = useCallback(() => {
    syncTriggers()
  }, [syncTriggers])

  // 失焦时延迟关闭面板，避免与菜单项点击（mousedown）产生时序竞争。
  const handleBlur = useCallback(() => {
    setEditorFocused(false)
    window.setTimeout(() => {
      if (composingRef.current) return
      closeMention()
      closeSlash()
      const root = editorRef.current
      const empty = !root || !editorHasContent(root)
      if (isMobile && empty && pinned.length === 0 && !contextRef && !speechBusy) {
        setMobileInputExpanded(false)
      }
    }, 120)
  }, [closeMention, closeSlash, contextRef, isMobile, pinned.length, speechBusy])

  const handleEditorFocus = useCallback(() => {
    setEditorFocused(true)
  }, [])

  return (
    <div className={s.wrap}>
      {showWelcomeStarters && (
        <div
          key={welcomeKey}
          className={mergeClasses(
            s.startersSection,
            s.startersSectionEnter,
          )}
        >
          <Text className={s.startersLabel}>你可以这样问</Text>
          <div className={s.starters}>
            {starters.map((st, index) => (
              <OpptrixButton
                key={listRowKey(index, st.label, st.text)}
                className={s.starterChip}
                variant="ghost"
                size="small"
                block
                disabled={Boolean(userPrompt) || uploading}
                onClick={() => onSubmit(st.text)}
              >
                {st.label}
              </OpptrixButton>
            ))}
          </div>
        </div>
      )}

      {error && <div className={s.error} role="alert">{error}</div>}
      {speechError && !error && (
        <div className={s.error} role="alert">{speechError}</div>
      )}
      {attachmentToast && !error && !speechError && (
        <div className={s.error} role="status">{attachmentToast}</div>
      )}

      <ComposerActiveWidgetChip />

      <div className={s.panelWrap}>
        {userPrompt && onUserPromptSubmit && (
          <ComposerAgentUserPromptPanel
            prompt={userPrompt}
            submitting={userPromptSubmitting}
            onSubmit={onUserPromptSubmit}
          />
        )}
        <div
          className={mergeClasses(
            s.panel,
            'opptrix-composer-shell',
            isMobile && !showMobileEditorBlock && s.panelMobileCompact,
          )}
          data-speech-listening={speechListening ? 'true' : undefined}
          data-hold-pending={holdPending ? 'true' : undefined}
          data-mobile-speech={mobileSpeechBaseEligible ? 'true' : undefined}
          data-mobile-compact={isMobile && !showMobileEditorBlock ? 'true' : undefined}
        >
          {showFocusHint && (
            <div className={s.focusHint} role="note">
              @ 选股票 · / 引用技能 · Enter 发送
            </div>
          )}
          {speechListening && speechListeningPhase && (
            <div
              className={mergeClasses(
                s.speechListeningOverlay,
                isMobile && s.speechListeningOverlayMobile,
                isMobile && s.speechListeningOverlayMobileCapture,
              )}
              onPointerUp={isMobile
                ? (e) => {
                    if ((e.target as HTMLElement).closest('button')) return
                    handleMobileSpeechRelease()
                  }
                : undefined}
              onPointerCancel={isMobile ? handleMobileSpeechRelease : undefined}
              onContextMenu={isMobile ? (e) => e.preventDefault() : undefined}
            >
              <div className={s.speechListeningCenter}>
                <ComposerSpeechListeningBar
                  phase={speechListeningPhase}
                  levelRms={levelRms}
                  onEnd={isRecording && !isMobile ? toggleSpeech : undefined}
                  holdToTalk={isMobile}
                />
              </div>
              {showMobileDismiss && (
                <OpptrixButton
                  className={mergeClasses(s.speechListeningDismiss, 'opptrix-round-icon-btn')}
                  variant="ghost"
                  icon={<DismissRegular fontSize={16} />}
                  aria-label="关闭麦克风"
                  title="关闭麦克风"
                  onClick={handleMobileSpeechDismiss}
                  onPointerUp={(e) => e.stopPropagation()}
                />
              )}
            </div>
          )}
          {backgroundJobs.length > 0 && (
            <ComposerBackgroundJobsBar
              jobs={backgroundJobs}
              onCancelJob={onCancelBackgroundJob}
            />
          )}
          {collaborationTasks.length > 0 && (
            <ComposerCollaborationTasksBar
              tasks={collaborationTasks}
              onCancelTask={onCancelCollaborationTask}
              onDismissTask={onDismissCollaborationTask}
              onSelectRun={onSelectCollaborationRun}
            />
          )}
          {promptQueue.length > 0 && onPromptQueueRemove && onPromptQueueRunNow && (
            <ComposerPromptQueuePanel
              items={promptQueue}
              runNowDisabled={Boolean(userPrompt)}
              waitingConfirmHint={Boolean(userPrompt)}
              onRunNow={onPromptQueueRunNow}
              onRemove={onPromptQueueRemove}
            />
          )}
          <input
            ref={fileInputRef}
            type="file"
            hidden
            multiple
            accept={acceptTypes || undefined}
            onChange={(e) => {
              const picked = e.target.files ? Array.from(e.target.files) : []
              e.target.value = ''
              if (picked.length) void offerFiles(picked)
            }}
          />
          <div
            className={mergeClasses(
              s.inputRow,
              isMobile && s.inputRowMobile,
              useSingleRowEmpty && s.inputRowSingle,
            )}
          >
            {!useSingleRowEmpty && showMobileEditorBlock && contextRef && (
              <ComposerContextRefTag
                contextRef={contextRef}
                onClear={onClearContextRef}
              />
            )}
            {!useSingleRowEmpty && showMobileEditorBlock && (
              <ComposerAttachmentStrip
                items={pinned}
                sessionId={sessionId}
                onRemove={removePinned}
                onPreview={onOpenPreview && sessionId ? (item) => onOpenPreview(sessionId, item) : undefined}
              />
            )}
            {useSingleRowEmpty && (
              <div className={mergeClasses(s.toolbarStart, isMobile && s.toolbarStartMobile)}>
                <ComposerPlusMenu
                  disabled={composerLocked || speechListening}
                  attachmentsAllowed={attachmentsAllowed && !uploading}
                  grantsAvailable={Boolean(sessionId || ensureSession)}
                  onAttach={openFilePicker}
                  onAuthorizeFolders={() => { void handleAuthorizeFolders() }}
                  onSelectSkill={(skill) => insertSkillChip(skill, false)}
                  starters={plusMenuStarters}
                  onSelectStarter={(text) => onSubmit(text)}
                  artifactsEnabled={artifactsEnabled}
                  onToggleArtifacts={onToggleArtifacts}
                />
                <ChatWorkspaceGrants
                  ref={grantsRef}
                  sessionId={sessionId ?? null}
                  variant="dialog-only"
                  disabled={composerLocked || speechListening}
                />
              </div>
            )}
            <div
              className={mergeClasses(
                s.editorRow,
                useSingleRowEmpty && s.editorRowInline,
                isMobile && !showMobileEditorBlock && s.editorRowCollapsedMobile,
              )}
            >
              <span ref={mentionAnchorRef} className={s.mentionAnchor} aria-hidden />
              <div
                ref={editorRef}
                className={mergeClasses(
                  s.editor,
                  useSingleRowEmpty && s.editorInline,
                  isMobile && s.editorMobile,
                  'opptrix-scroll',
                  'opptrix-composer-editor',
                )}
                contentEditable={!composerLocked && !speechListening}
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label={editorAriaLabel}
                data-placeholder={editorPlaceholder}
                data-empty={hasContent || speechListening ? undefined : 'true'}
                data-single-row={useSingleRowEmpty ? 'true' : undefined}
                data-speech-listening={speechListening ? 'true' : undefined}
                data-hold-pending={holdPending ? 'true' : undefined}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onKeyUp={handleSelect}
                onMouseUp={handleSelect}
                onPaste={handlePaste}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                onFocus={handleEditorFocus}
                onBlur={handleBlur}
              />
            </div>
            <div
              className={mergeClasses(
                s.toolbarRow,
                useSingleRowEmpty && s.toolbarRowInline,
              )}
            >
              {!useSingleRowEmpty && (
                <div className={mergeClasses(s.toolbarStart, isMobile && s.toolbarStartMobile)}>
                  <ComposerPlusMenu
                    disabled={composerLocked || speechListening}
                    attachmentsAllowed={attachmentsAllowed && !uploading}
                    grantsAvailable={Boolean(sessionId || ensureSession)}
                    onAttach={openFilePicker}
                    onAuthorizeFolders={() => { void handleAuthorizeFolders() }}
                    onSelectSkill={(skill) => insertSkillChip(skill, false)}
                    starters={plusMenuStarters}
                    onSelectStarter={(text) => onSubmit(text)}
                    artifactsEnabled={artifactsEnabled}
                    onToggleArtifacts={onToggleArtifacts}
                  />
                  <ChatWorkspaceGrants
                    ref={grantsRef}
                    sessionId={sessionId ?? null}
                    variant="dialog-only"
                    disabled={composerLocked || speechListening}
                  />
                </div>
              )}
              <div className={mergeClasses(s.toolbarCenter, isMobile && s.toolbarCenterMobile)}>
                {isMobile && (
                  <ComposerMobileHoldSpeechLabel
                    active={holdControlActive}
                    holdPending={holdPending}
                    label={mobileHoldLabel}
                    ariaLabel={mobileHoldAriaLabel}
                    onPointerDown={handleHoldPointerDown}
                    onPointerUp={handleHoldPointerUp}
                    onPointerCancel={handleHoldPointerUp}
                  />
                )}
              </div>
              <div className={mergeClasses(s.toolbarEnd, isMobile && s.toolbarEndMobile)}>
                {showStop && (
                  <OpptrixButton
                    className={mergeClasses(s.stopBtn, 'opptrix-round-icon-btn')}
                    variant="primary"
                    icon={<PauseFilled fontSize={14} />}
                    disabled={!onStop}
                    onClick={() => { void handleStopClick() }}
                    title={stopAriaLabel}
                    aria-label={stopAriaLabel}
                  />
                )}
                {showMic && (
                  <OpptrixButton
                    className={mergeClasses(
                      speechListening ? s.micBtnRecordingBase : s.micBtnGhost,
                      'opptrix-round-icon-btn',
                      !speechListening && 'opptrix-round-icon-btn-ghost',
                      speechListening && s.micRecording,
                      speechListening && 'opptrix-composer-mic-recording',
                    )}
                    variant={speechListening ? 'primary' : 'ghost'}
                    icon={speechListening
                      ? <MicFilled fontSize={16} />
                      : <MicRegular fontSize={16} />}
                    disabled={composerLocked || uploading || speechPhase === 'transcribing' || speechPhase === 'requesting'}
                    aria-label={isRecording ? '结束聆听' : speechBusy ? '正在识别' : '语音输入'}
                    aria-pressed={isRecording}
                    title={isRecording ? '点击或空格结束 · Esc 取消' : '语音输入'}
                    onClick={handleMicClick}
                  />
                )}
                {showSend && (
                  <OpptrixButton
                    className={mergeClasses(s.sendBtn, 'opptrix-round-icon-btn')}
                    variant="primary"
                    icon={<ArrowUpRegular fontSize={14} />}
                    disabled={!canSend}
                    onClick={() => handleSubmitMessage()}
                    aria-label={loading ? '补充说明' : '发送'}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
        <div
          data-composer-footer
          className={mergeClasses(
            s.composerFooter,
            isMobile && s.composerFooterMobile,
          )}
        >
          {streamStatusLabel && loading && (
            <div className={s.streamStatusRow} role="status">
              <Text className={s.streamStatusText} block>{streamStatusLabel}</Text>
            </div>
          )}
          <div className={mergeClasses(s.footerMetaRow, isMobile && s.footerMetaRowMobile)}>
            {onModelChange ? (
              <div className={s.footerModel}>
                <ModelSelector
                  models={availableModels}
                  value={sessionModel}
                  disabled={composerLocked}
                  isMobile={isMobile}
                  compact
                  showParams
                  llmParams={sessionLlmParams}
                  onLlmParamsChange={onLlmParamsChange}
                  onChange={onModelChange}
                  menuAlign="start"
                  contextUsage={contextUsage}
                  onPanelOpenChange={(open) => {
                    if (open) onRefreshContextUsage?.()
                  }}
                />
              </div>
            ) : null}
            {contextUsage ? (
              <div className={s.footerContextUsage}>
                <ContextUsageMeter usage={contextUsage} compact />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ComposerStockMentionList
        open={mentionState.open && !slashState.open}
        anchorRef={mentionAnchorRef}
        items={mentionMatches}
        activeIndex={mentionState.activeIndex}
        query={mentionState.query}
        universePrep={mentionUniversePrep}
        refreshingAfterPrep={mentionRefreshingAfterPrep}
        onSelect={handleSelectMention}
        onHover={setMentionActiveIndex}
        onClose={closeMention}
      />
      <ComposerSkillSlashList
        open={slashState.open}
        anchorRef={mentionAnchorRef}
        items={slashMatches}
        activeIndex={slashState.activeIndex}
        query={slashState.query}
        loading={slashLoading}
        loadError={slashLoadError}
        onSelect={(skill) => insertSkillChip(skill, true)}
        onHover={setSlashActiveIndex}
        onClose={closeSlash}
      />
    </div>
  )
})

export default ChatComposer
