import { makeStyles, mergeClasses, Text } from '@fluentui/react-components'
import { DismissRegular } from '@fluentui/react-icons'
import type { CSSProperties } from 'react'
import { opptrixCssVars, opptrixTokens } from '../../theme/tokens'
import { MOCK_GROSS_MARGIN_DATASET } from './mockGrossMarginDataset'
import {
  cellNumericValue,
  entityNameForId,
  findSourceForCell,
  formatCellValue,
} from './sourceLookup'
import { readableFetchTime, safeSourceUrl, sourceProviderLabel, researchMetricLabel, formatSourcePeriodLabel } from './sourcePresentation'
import type { Dataset } from './types'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: 'min(240px, 72vw)',
    maxWidth: 'min(320px, 86vw)',
    padding: '10px 12px',
    borderRadius: opptrixTokens.radiusMd,
    border: `1px solid ${opptrixCssVars.borderStrong}`,
    backgroundColor: opptrixCssVars.surface,
    boxShadow: opptrixTokens.shadowPanel,
    boxSizing: 'border-box',
  },
  head: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '8px',
  },
  title: {
    fontSize: 'var(--opptrix-font-base)',
    fontWeight: 600,
    lineHeight: 1.35,
    color: opptrixCssVars.textPrimary,
  },
  value: {
    fontSize: 'var(--opptrix-font-lg)',
    fontWeight: 650,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.2,
    color: opptrixCssVars.textPrimary,
  },
  meta: {
    fontSize: 'var(--opptrix-font-sm)',
    lineHeight: 1.45,
    color: opptrixCssVars.textSecondary,
  },
  dismiss: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: '22px',
    height: '22px',
    padding: 0,
    border: 'none',
    borderRadius: opptrixTokens.radiusFull,
    backgroundColor: 'transparent',
    color: opptrixCssVars.textTertiary,
    cursor: 'pointer',
    ':hover': {
      backgroundColor: opptrixCssVars.surfaceHover,
      color: opptrixCssVars.textSecondary,
    },
  },
  link: {
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textPrimary,
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
})

interface Props {
  dataset: Dataset
  entityId: string
  period: string
  className?: string
  style?: CSSProperties
  onDismiss?: () => void
}

export default function SourceCitationBar({
  dataset,
  entityId,
  period,
  className,
  style,
  onDismiss,
}: Props) {
  const s = useStyles()
  const example = dataset.id === MOCK_GROSS_MARGIN_DATASET.id
  const entityName = entityNameForId(dataset, entityId)
  const value = cellNumericValue(dataset, entityId, period)
  const source = findSourceForCell(dataset, entityId, period)
  const metricLabel = researchMetricLabel(dataset.metric, source?.fieldLabel)
  const periodLabel = formatSourcePeriodLabel(dataset.metric, period)
  const href = safeSourceUrl(source?.sourceUrl)

  return (
    <div
      className={mergeClasses(s.root, className, 'research-canvas-no-drag')}
      style={style}
      data-research-citation="true"
      role="dialog"
      aria-label={`${entityName} ${period} 数据依据`}
    >
      <div className={s.head}>
        <div>
          <Text className={s.title} block>
            {entityName} · {metricLabel} · {periodLabel}
          </Text>
          <Text className={s.value} block>
            {formatCellValue(dataset, value)}
          </Text>
        </div>
        {onDismiss ? (
          <button type="button" className={s.dismiss} aria-label="关闭依据" onClick={onDismiss}>
            <DismissRegular fontSize={12} />
          </button>
        ) : null}
      </div>
      {value == null ? (
        <Text className={s.meta} block>
          这一格没有记录数值，不按零处理。可在对话里调整公司、指标或时间范围后重新查询。
        </Text>
      ) : null}
      {example ? (
        <Text className={s.meta} block>示例数据，不用于研究，也不代表公司的实际财务表现。</Text>
      ) : source ? (
        <>
          <Text className={s.meta} block>
            来源：{sourceProviderLabel(source.provider)}
          </Text>
          <Text className={s.meta} block>{readableFetchTime(source.fetchedAt)}</Text>
          {href ? (
            <a className={s.link} href={href} target="_blank" rel="noopener noreferrer">
              打开原文
            </a>
          ) : (
            <Text className={s.meta} block>未提供原文链接，可按公司和指标核对公开报告。</Text>
          )}
        </>
      ) : (
        <Text className={s.meta} block>
          这条没有单独来源。请在对话中重新查询后再核对。
        </Text>
      )}
    </div>
  )
}
