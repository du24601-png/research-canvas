import { useState } from 'react'
import OpptrixButton from '../../components/opptrix/OpptrixButton'
import { requestResearchRecovery } from './researchPreviewAdjust'

export default function ResearchRecovery({ title, missingData = false }: {
  title?: string
  missingData?: boolean
}) {
  const [prepared, setPrepared] = useState(false)
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
