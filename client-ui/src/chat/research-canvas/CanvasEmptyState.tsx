import LineChartWidget from './LineChartWidget'
import { MOCK_GROSS_MARGIN_DATASET } from './mockGrossMarginDataset'

export default function CanvasEmptyState({ muted = false }: { muted?: boolean }) {
  return (
    <div className="research-canvas-empty" data-muted={muted || undefined}>
      <div className="research-canvas-empty__stage" aria-hidden>
        <div className="research-canvas-empty__grid" />
        <div className="research-canvas-empty__sample">
          <LineChartWidget dataset={MOCK_GROSS_MARGIN_DATASET} />
        </div>
      </div>
      <strong>确认过的研究图表会保存在这里</strong>
      {!muted ? (
        <p>在左侧问一句，预览满意后点「添加到画布」。示例仅供感受布局，不会写入你的画布。</p>
      ) : null}
    </div>
  )
}
