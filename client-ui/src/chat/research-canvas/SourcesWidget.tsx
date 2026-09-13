import { makeStyles, Text } from '@fluentui/react-components'
import { memo } from 'react'
import { opptrixCssVars } from '../../theme/tokens'
import type { Dataset } from './types'
import { readableFetchTime, safeSourceUrl, sourceProviderLabel } from './sourcePresentation'
import { MOCK_GROSS_MARGIN_DATASET } from './mockGrossMarginDataset'

const useStyles = makeStyles({
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    height: '100%',
    minHeight: 0,
    overflow: 'auto',
  },
  item: {
    padding: '8px 10px',
    borderRadius: '8px',
    backgroundColor: opptrixCssVars.canvasAlt,
    border: `1px solid ${opptrixCssVars.separator}`,
  },
  title: {
    fontSize: '13px',
    fontWeight: 590,
    color: opptrixCssVars.textPrimary,
  },
  note: {
    display: 'block',
    marginTop: '4px',
    fontSize: '12px',
    overflowWrap: 'anywhere',
    color: opptrixCssVars.textSecondary,
    lineHeight: 1.45,
  },
})

interface Props {
  dataset: Dataset
}

function entityName(dataset: Dataset, entityId: string): string {
  return dataset.entities.find(entity => entity.id === entityId)?.name ?? entityId
}

function sourceTitle(dataset: Dataset, index: number): string {
  const source = dataset.sources[index]
  if (!source) return '来源未标注'
  const name = entityName(dataset, source.entityId)
  return `${name} · ${sourceProviderLabel(source.provider)}`
}

export default memo(function SourcesWidget({ dataset }: Props) {
  const s = useStyles()

  if (dataset.id === MOCK_GROSS_MARGIN_DATASET.id) {
    return <Text className={s.note}>示例数据，不用于研究。仅演示图表操作，不代表公司的实际财务表现。</Text>
  }

  if (!dataset.sources.length) {
    return <Text className={s.note}>这份数据尚未记录来源。请在对话中重新查询，再核对来源。</Text>
  }

  return (
    <div className={s.list}>
      {dataset.sources.map((source, index) => (
        <div key={`${source.entityId}-${source.metric}-${source.fetchedAt}-${index}`} className={s.item}>
          <Text className={s.title}>{sourceTitle(dataset, index)}</Text>
          <Text className={s.note}>
            {readableFetchTime(source.fetchedAt)}
          </Text>
          {source.period ? <Text className={s.note}>数据期间：{source.period}</Text> : null}
          {safeSourceUrl(source.sourceUrl) ? (
            <a href={safeSourceUrl(source.sourceUrl)} target="_blank" rel="noopener noreferrer">打开原文</a>
          ) : <Text className={s.note}>未提供原文链接，可按公司和指标核对公开报告。</Text>}
        </div>
      ))}
    </div>
  )
})
