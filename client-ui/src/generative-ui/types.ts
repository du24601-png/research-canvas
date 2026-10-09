import type { ResearchUiAction, ResearchUiBlock } from '@opptrix/shared/research-ui-spec'
import type { Dataset } from '../chat/research-canvas/types'
import type { BlockAction } from './BlockFrame'

/** 动作只回调给宿主（M4 接到钉住 / 打开来源），组件自身不写画布或看板 */
export type SpecActionHandler = (action: ResearchUiAction, block: ResearchUiBlock) => void

export interface BlockProps<B extends ResearchUiBlock> {
  block: B
  getDataset: (id: string) => Dataset | undefined
  onAction?: SpecActionHandler
}

const ACTION_LABELS: Partial<Record<ResearchUiAction, string>> = {
  pin: '钉住',
  open_sources: '查看来源',
}

/** 把 Spec 里声明的通用动作变成按钮；highlight_largest_change 由 TrendView 自己处理 */
export function hostActions(block: ResearchUiBlock, onAction?: SpecActionHandler): BlockAction[] {
  const declared = 'actions' in block ? block.actions ?? [] : []
  return declared
    .filter(action => ACTION_LABELS[action])
    .map(action => ({
      key: action,
      label: ACTION_LABELS[action] ?? action,
      onClick: () => onAction?.(action, block),
    }))
}

export function periodRange(dataset: Dataset): string {
  const first = dataset.periods[0] ?? ''
  const last = dataset.periods[dataset.periods.length - 1] ?? first
  return first === last ? first : `${first}–${last}`
}
