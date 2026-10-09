/**
 * Action Bridge（M4）：把 Spec 组件上的动作接到现有能力，不新增写画布的路径。
 * - pin：用户点击才执行，走原 widget_adopted → adoptProposal；优先用本轮对应的预览提案
 * - open_sources：滚到本段回答里的「来源与口径」
 * - rerun：把一句重新查询放进输入框，用户发送后走正常对话流程
 * - highlight_largest_change：TrendView 本地处理，不到这里
 */
import type { ResearchUiAction, ResearchUiBlock } from '@opptrix/shared/research-ui-spec'
import type { ChatToolStep } from '../types/chatProgress'
import { publishResearchCanvasEvent } from '../chat/research-canvas/researchCanvasBus'
import { proposalMetaFromToolStep } from '../chat/research-canvas/proposalFromToolStep'
import { requestComposerDraft } from '../chat/research-canvas/researchFetchPlanAdjust'
import { researchMetricLabel } from '../chat/research-canvas/sourcePresentation'
import type { Dataset } from '../chat/research-canvas/types'
import { periodRange } from './types'

export function blockDatasetIds(block: ResearchUiBlock): string[] {
  return 'datasetIds' in block ? block.datasetIds : [block.datasetId]
}

/** 每个数据集对应一个要钉住的提案：本轮有预览提案就用它，否则按数据集合成一个折线提案 */
export function pinProposals(block: ResearchUiBlock, steps: readonly ChatToolStep[], datasets: readonly Dataset[]) {
  return blockDatasetIds(block).flatMap((datasetId) => {
    const step = steps.find(item => item.tool === 'propose_widget' && item.status === 'done' && proposalMetaFromToolStep(item)?.datasetId === datasetId)
    const meta = step ? proposalMetaFromToolStep(step) : null
    if (step && meta) return [{ id: step.id, type: meta.type, title: meta.title, datasetId, ...(meta.view ? { view: meta.view } : {}) }]
    const dataset = datasets.find(item => item.id === datasetId)
    return dataset ? [{ id: `spec-pin-${datasetId}`, type: 'line_chart' as const, title: dataset.title, datasetId }] : []
  })
}

export function rerunText(block: ResearchUiBlock, datasets: readonly Dataset[]): string {
  const parts = blockDatasetIds(block)
    .map(id => datasets.find(dataset => dataset.id === id))
    .filter((dataset): dataset is Dataset => Boolean(dataset))
    .map(dataset => `${dataset.entities.map(entity => entity.name).join('、')} ${periodRange(dataset)} ${researchMetricLabel(dataset.metric)}`)
  return `再查一次：${parts.join('；')}`
}

export function makeActionBridge(input: {
  steps: readonly ChatToolStep[]
  datasets: readonly Dataset[]
  root: () => HTMLElement | null
}) {
  return (action: ResearchUiAction, block: ResearchUiBlock): void => {
    if (action === 'pin') {
      for (const proposal of pinProposals(block, input.steps, input.datasets)) {
        publishResearchCanvasEvent({ type: 'widget_adopted', proposal })
      }
      return
    }
    if (action === 'open_sources') {
      input.root()?.querySelector('[data-generative-ui-block="EvidencePanel"]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      return
    }
    if (action === 'rerun') requestComposerDraft(rerunText(block, input.datasets))
  }
}
