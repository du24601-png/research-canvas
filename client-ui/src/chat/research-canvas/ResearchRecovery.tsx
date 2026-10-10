import { useState } from 'react'
import OpptrixButton from '../../components/opptrix/OpptrixButton'
import { requestResearchRecovery } from './researchPreviewAdjust'
import { usePinBoard } from '../pin-board/PinBoardContext'

export default function ResearchRecovery({ title, missingData = false }: {
  title?: string
  missingData?: boolean
}) {
  const [prepared, setPrepared] = useState(false)
  const { chatFirst } = usePinBoard()
  const name = title || '这张图表'
  if (chatFirst) {
    return (
      <div className="finframe-recovery-note" data-testid="research-recovery-compact">
        <strong>{missingData ? `「${name}」的数据在本机读不到` : `「${name}」这次没能生成图表`}</strong>
        <span>
          {missingData
            ? '说「重新查一次」会用同样的口径重新取数，原来的结论不变。'
            : '说「再试一次」即可。'}
        </span>
      </div>
    )
  }
  return (
    <div style={{ padding: '12px 4px', fontSize: 13, lineHeight: 1.6 }}>
      <strong>{title || '研究视图暂不可用'}</strong>
      <p>{missingData ? '此浏览器暂时无法读取这份研究数据。' : '这次未能生成研究视图。'}</p>
      <p>可以重新查询，新的结果会先显示为预览，原图保持不变。</p>
      <OpptrixButton variant="secondary" size="small" onClick={() => {
        requestResearchRecovery(title)
        setPrepared(true)
      }}>准备重新查询</OpptrixButton>
      {prepared ? <p role="status">查询请求已填入输入框，请核对公司、指标和时间后发送。</p> : null}
    </div>
  )
}
