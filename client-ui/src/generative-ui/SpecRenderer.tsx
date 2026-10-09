import { useMemo, type ReactNode } from 'react'
import type { Dataset } from '../chat/research-canvas/types'
import { renderBlock, validateSpec } from './registry'
import type { SpecActionHandler } from './types'

export interface SpecRendererProps {
  /** 模型给的原始 Spec（未校验） */
  spec: unknown
  /** 本轮可用的 Dataset；Spec 只能引用这里的 id */
  datasets: readonly Dataset[]
  /** Spec 不合规时显示的原预览卡 */
  fallback: ReactNode
  onAction?: SpecActionHandler
}

/**
 * 按 Spec 组装回答里的组件。校验失败整份回退到 fallback，不渲染部分组件、不补值。
 * 渲染本身不发画布事件、不写看板；钉住等动作只通过 onAction 交给宿主。
 */
export default function SpecRenderer({ spec, datasets, fallback, onAction }: SpecRendererProps) {
  const result = useMemo(() => validateSpec(spec, datasets), [spec, datasets])
  const byId = useMemo(() => new Map(datasets.map(dataset => [dataset.id, dataset])), [datasets])
  if (!result.ok) {
    return <div data-generative-ui="fallback" data-spec-errors={result.errors.length}>{fallback}</div>
  }
  const getDataset = (id: string) => byId.get(id)
  return (
    <div data-generative-ui="spec">
      {result.spec.blocks.map((block, i) => renderBlock(block, `${block.component}-${i}`, getDataset, onAction))}
    </div>
  )
}
