import { useState } from 'react'
import { Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions } from '@fluentui/react-components'
import OpptrixButton from '../../components/opptrix/OpptrixButton'
import LineChartWidget from './LineChartWidget'
import { MOCK_GROSS_MARGIN_DATASET } from './mockGrossMarginDataset'

export default function CanvasEmptyState() {
  const [showExample, setShowExample] = useState(false)
  return (
    <div className="research-canvas-empty">
      <strong>这里保存你确认过的研究图表</strong>
      <p>在左侧提出问题，预览后选择「添加到画布」。</p>
      <OpptrixButton variant="ghost" size="small" onClick={() => setShowExample(true)}>查看示例</OpptrixButton>
      <Dialog open={showExample} onOpenChange={(_, data) => setShowExample(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>图表示例</DialogTitle>
            <DialogContent>
              <p>示例数据，不用于研究，也不会添加到你的画布。</p>
              <div style={{ height: 280 }}><LineChartWidget dataset={MOCK_GROSS_MARGIN_DATASET} /></div>
            </DialogContent>
            <DialogActions><OpptrixButton onClick={() => setShowExample(false)}>返回研究</OpptrixButton></DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  )
}
