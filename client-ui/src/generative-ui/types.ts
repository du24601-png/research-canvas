import type { ResearchUiAction, ResearchUiBlock } from '@opptrix/shared/research-ui-spec'
import type { Dataset, WidgetType } from '../chat/research-canvas/types'
import type { BlockAction } from './BlockFrame'

/** 组件里用户切换后的视图（图种 / 年份），只是看法变化，数据不变 */
export interface BlockView {
  type: WidgetType
  period?: string
  title?: string
}

/** 动作只回调给宿主（钉住 / 打开来源 / 再查一次），组件自身不写画布或看板；view 为当前视图 */
export type SpecActionHandler = (action: ResearchUiAction, block: ResearchUiBlock, view?: BlockView) => void

export interface BlockProps<B extends ResearchUiBlock> {
  block: B
  getDataset: (id: string) => Dataset | undefined
  onAction?: SpecActionHandler
}

const ACTION_LABELS: Partial<Record<ResearchUiAction, string>> = {
  pin: '钉住',
  open_sources: '查看来源',
  rerun: '再查一次',
  adjust: '调整',
}

/** 把 Spec 里声明的通用动作变成按钮；highlight_largest_change 由 TrendView 自己处理 */
export function hostActions(block: ResearchUiBlock, onAction?: SpecActionHandler, view?: BlockView): BlockAction[] {
  const declared = 'actions' in block ? block.actions ?? [] : []
  return declared
    .filter(action => ACTION_LABELS[action])
    .map(action => ({
      key: action,
      label: ACTION_LABELS[action] ?? action,
      onClick: () => onAction?.(action, block, view),
    }))
}

export function periodRange(dataset: Dataset): string {
  const first = dataset.periods[0] ?? ''
  const last = dataset.periods[dataset.periods.length - 1] ?? first
  return first === last ? first : `${first}–${last}`
}
