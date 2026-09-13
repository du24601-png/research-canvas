import { Popover, PopoverSurface, PopoverTrigger } from '@fluentui/react-components'
import OpptrixButton from '../../components/opptrix/OpptrixButton'
import SourcesWidget from './SourcesWidget'
import { coverageLabel, datasetSubtitle } from './datasetLabels'
import { MOCK_GROSS_MARGIN_DATASET } from './mockGrossMarginDataset'
import type { Dataset } from './types'

export default function DatasetEvidence({ dataset }: { dataset: Dataset }) {
  const example = dataset.id === MOCK_GROSS_MARGIN_DATASET.id
  return (
    <Popover positioning="below-end" trapFocus>
      <PopoverTrigger disableButtonEnhancement>
        <OpptrixButton variant="ghost" size="small">查看依据</OpptrixButton>
      </PopoverTrigger>
      <PopoverSurface aria-label="数据依据" className="research-canvas-no-drag">
        <div style={{ width: 'min(320px, 75vw)', maxHeight: '55vh', overflow: 'auto', fontSize: 13 }}>
          <strong>{example ? '示例数据，不用于研究' : dataset.title}</strong>
          <p>{datasetSubtitle(dataset)} · 单位：{dataset.unit || '未记录'}</p>
          <p>{coverageLabel(dataset)}。缺失值显示为 —，不按零处理。</p>
          {example ? <p>仅用于演示图表操作，不代表公司的实际财务表现。</p> : (
            <>
              <SourcesWidget dataset={dataset} />
              <p>获取时间不等于报告披露时间。仅展示已记录的来源信息。</p>
            </>
          )}
        </div>
      </PopoverSurface>
    </Popover>
  )
}
