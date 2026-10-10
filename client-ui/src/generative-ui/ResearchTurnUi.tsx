import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ChatToolStep } from '../types/chatProgress'
import { readPersistedCanvasState } from '../chat/research-canvas/layoutStorage'
import { subscribeResearchCanvasEvents } from '../chat/research-canvas/researchCanvasBus'
import { usePinBoard } from '../chat/pin-board/PinBoardContext'
import { COMPOSER_STORAGE_KEY, resolveUiComposer } from '../chat/pin-board/chatFirstLayout'
import { makeActionBridge } from './actionBridge'
import SpecRenderer from './SpecRenderer'
import { specFromSteps } from './specFromSteps'
import { useReportFollowup, useTurnIndex } from './report-followup/ReportFollowupContext'
import ReportFollowupTurn from './report-followup/ReportFollowupTurn'
import { REPORT_FOLLOWUP_STORAGE_KEY, resolveReportFollowup } from './report-followup/reportVersions'

export { COMPOSE_STEP_TOOL, specFromSteps } from './specFromSteps'

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/** 数据集落盘后（dataset_created）重新读，保证 Spec 引用的数据集可见 */
function usePersistedDatasets(sessionId: string | null) {
  const [epoch, setEpoch] = useState(0)
  useEffect(() => subscribeResearchCanvasEvents((event) => {
    const type = typeof event === 'object' && event !== null ? (event as { type?: unknown }).type : null
    if (type === 'dataset_created') window.setTimeout(() => setEpoch(value => value + 1), 0)
  }), [])
  return useMemo(() => readPersistedCanvasState(sessionId).datasets, [sessionId, epoch])
}

/**
 * 一轮回答里的研究界面：对话优先 + Composer 开启且本轮有 Spec 时，用 SpecRenderer 替换预览卡；
 * 其他情况（没有 Spec、Spec 不合规、数据集不在本浏览器）一律显示原预览卡。
 * 报告追问（M4b，默认关）开启时交给 ReportFollowupTurn：可追问组件、显示版本与对比。
 */
export default function ResearchTurnUi({ steps, sessionId, children }: {
  steps: readonly ChatToolStep[]
  sessionId: string | null
  children: ReactNode
}) {
  const { chatFirst } = usePinBoard()
  const followup = useReportFollowup()
  const turnIndex = useTurnIndex()
  const rootRef = useRef<HTMLDivElement>(null)
  const datasets = usePersistedDatasets(sessionId)
  const spec = useMemo(() => specFromSteps(steps), [steps])
  const enabled = resolveUiComposer(chatFirst, readStored(COMPOSER_STORAGE_KEY))
  const onAction = useMemo(
    () => makeActionBridge({ steps, datasets, root: () => rootRef.current }),
    [steps, datasets],
  )
  if (!enabled) return <>{children}</>
  if (followup && turnIndex != null && resolveReportFollowup(enabled, readStored(REPORT_FOLLOWUP_STORAGE_KEY))) {
    return <ReportFollowupTurn followup={followup} turnIndex={turnIndex} datasets={datasets}>{children}</ReportFollowupTurn>
  }
  if (spec == null) return <>{children}</>
  return (
    <div ref={rootRef}>
      <SpecRenderer spec={spec} datasets={datasets} fallback={children} onAction={onAction} />
    </div>
  )
}
