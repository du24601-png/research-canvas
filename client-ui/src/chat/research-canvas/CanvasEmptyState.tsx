import { usePinBoard } from '../pin-board/PinBoardContext'
import LineChartWidget from './LineChartWidget'
import { MOCK_GROSS_MARGIN_DATASET } from './mockGrossMarginDataset'

/** 中性线框：无公司名、无数值刻度，只示意「图表会放在这里」。 */
function Wireframe() {
  return (
    <svg className="finframe-wireframe" viewBox="0 0 240 120" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.35">
      <path d="M16 12v96h216" />
      <path d="M16 84l48-24 48 12 56-44 56 20" strokeDasharray="4 4" />
    </svg>
  )
}

export default function CanvasEmptyState({ muted = false }: { muted?: boolean }) {
  const { chatFirst } = usePinBoard()
  const hint = chatFirst
    ? '在对话里提问，图表满意后点「钉住」，它就会出现在这里。'
    : '在左侧问一句，预览满意后点「添加到画布」。示例仅供感受布局，不会写入你的画布。'
  return (
    <div className="research-canvas-empty" data-muted={muted || undefined}>
      <div className="research-canvas-empty__stage" aria-hidden>
        <div className="research-canvas-empty__grid" />
        <div className="research-canvas-empty__sample">
          {chatFirst ? <Wireframe /> : <LineChartWidget dataset={MOCK_GROSS_MARGIN_DATASET} />}
        </div>
      </div>
      <strong>确认过的研究图表会保存在这里</strong>
      {!muted ? (
        <p>{hint}</p>
      ) : null}
    </div>
  )
}
