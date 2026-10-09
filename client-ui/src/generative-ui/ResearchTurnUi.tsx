import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ChatToolStep } from '../types/chatProgress'
import { readPersistedCanvasState } from '../chat/research-canvas/layoutStorage'
import { subscribeResearchCanvasEvents } from '../chat/research-canvas/researchCanvasBus'
import { usePinBoard } from '../chat/pin-board/PinBoardContext'
import { COMPOSER_STORAGE_KEY, resolveUiComposer } from '../chat/pin-board/chatFirstLayout'
import { makeActionBridge } from './actionBridge'
import SpecRenderer from './SpecRenderer'

export const COMPOSE_STEP_TOOL = 'compose_research_ui'

/** 本轮 Composer 步骤里的原始 Spec（未校验；SpecRenderer 负责校验） */
export function specFromSteps(steps: readonly ChatToolStep[]): unknown {
  const step = [...steps].reverse().find(item => item.tool === COMPOSE_STEP_TOOL && item.status === 'done')
  if (!step?.resultDetail) return null
  try {
    return (JSON.parse(step.resultDetail) as { spec?: unknown }).spec ?? null
  } catch {
    return null
  }
}

function readComposerOverride(): string | null {
  try {
    return window.localStorage.getItem(COMPOSER_STORAGE_KEY)
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
 */
export default function ResearchTurnUi({ steps, sessionId, children }: {
  steps: readonly ChatToolStep[]
  sessionId: string | null
  children: ReactNode
}) {
  const { chatFirst } = usePinBoard()
  const rootRef = useRef<HTMLDivElement>(null)
  const datasets = usePersistedDatasets(sessionId)
  const spec = useMemo(() => specFromSteps(steps), [steps])
  const enabled = resolveUiComposer(chatFirst, readComposerOverride())
  const onAction = useMemo(
    () => makeActionBridge({ steps, datasets, root: () => rootRef.current }),
    [steps, datasets],
  )
  if (!enabled || spec == null) return <>{children}</>
  return (
    <div ref={rootRef}>
      <SpecRenderer spec={spec} datasets={datasets} fallback={children} onAction={onAction} />
    </div>
  )
}
