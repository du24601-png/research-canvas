import { makeStyles, mergeClasses } from '@fluentui/react-components'
import { useRef } from 'react'
import { switcherViews } from '@opptrix/shared/research-view-recommendation'
import { buildResearchViewTitle } from '@opptrix/shared/research-view-title'
import OpptrixSegmentedControl from '../../components/opptrix/OpptrixSegmentedControl'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { opptrixCssVars } from '../../theme/tokens'
import type { Dataset, WidgetType } from './types'

const SWITCHABLE = new Set<WidgetType>(['line_chart', 'bar_chart', 'grouped_bar', 'heatmap_table', 'table'])
const ORIGINAL_LABELS: Partial<Record<WidgetType, string>> = {
  stacked_bar: '堆积柱', stacked_bar_percent: '百分比堆积', combo_bar_line: '柱线混合',
  pie_chart: '饼图', donut_chart: '圆环', grouped_bar: '分组柱',
}

export interface ViewSwitchValue {
  type: WidgetType
  period?: string
  topN?: number
  title: string
}

interface Props {
  dataset: Dataset
  type: WidgetType
  period?: string
  onChange: (next: ViewSwitchValue) => void
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
    minWidth: 0,
    marginTop: '8px',
  },
  segmented: {
    width: 'auto',
    maxWidth: '100%',
    flex: '0 1 auto',
  },
  year: {
    height: '30px',
    flexShrink: 0,
    maxWidth: '120px',
    border: `1px solid ${opptrixCssVars.border}`,
    borderRadius: '6px',
    backgroundColor: opptrixCssVars.surface,
    color: opptrixCssVars.textSecondary,
    fontSize: '12px',
    padding: '0 8px',
  },
})

function titleFor(dataset: Dataset, type: WidgetType, period?: string): string {
  return buildResearchViewTitle({
    entityCount: dataset.entities.length,
    entityNames: dataset.entities.map(entity => entity.name),
    metric: dataset.metric,
    type,
    period,
    periods: dataset.periods,
  })
}

function buildViewOptions(dataset: Dataset, originalType: WidgetType) {
  const recommended = switcherViews(dataset).filter(item => SWITCHABLE.has(item.type as WidgetType))
  const options: { type: string; label: string; params: { period?: string; topN?: number } }[] = dataset.metric === 'kline'
    ? [
      { type: 'candlestick', label: 'K 线', params: {} },
      { type: 'line_chart', label: '收盘价', params: {} },
      { type: 'table', label: '表格', params: {} },
    ] satisfies { type: WidgetType; label: string; params: { period?: string; topN?: number } }[]
    : recommended
  if (ORIGINAL_LABELS[originalType] && !options.some(item => item.type === originalType)) {
    options.push({ type: originalType, label: ORIGINAL_LABELS[originalType] ?? '原图表', params: {} })
  }
  return options
}

export function ViewSwitcher({ dataset, type, period, onChange }: Props) {
  const s = useStyles()
  const isMobile = useBreakpoint() === 'mobile'
  const originalType = useRef(type).current
  const options = buildViewOptions(dataset, originalType)
  if (options.length < 2) return null

  const years = dataset.periods.filter(item => (
    dataset.data.some(point => point.period === item && point.value != null)
  ))
  const showYear = type === 'bar_chart'
  const useSelectForViews = isMobile || options.length > 5

  const apply = (nextType: WidgetType, nextPeriod?: string) => {
    const match = options.find(item => item.type === nextType)
    const paramsPeriod = nextType === 'bar_chart'
      ? (nextPeriod ?? match?.params.period ?? period)
      : undefined
    onChange({
      type: nextType,
      period: paramsPeriod,
      topN: match?.params.topN,
      title: titleFor(dataset, nextType, paramsPeriod),
    })
  }

  const yearValue = period && years.includes(period) ? period : (years[years.length - 1] ?? '')
  const useSelectForYears = years.length > 4

  return (
    <div className={`${s.root} research-canvas-no-drag`}>
      {useSelectForViews ? (
        <select className={s.year} aria-label="图表视图" value={type}
          onChange={event => apply(event.target.value as WidgetType)}>
          {!options.some(item => item.type === type) ? <option value={type}>当前视图</option> : null}
          {options.map(item => <option key={item.type} value={item.type}>{item.label}</option>)}
        </select>
      ) : (
        <OpptrixSegmentedControl
          className={mergeClasses(s.segmented, 'research-canvas-view-switcher')}
          variant="embedded"
          aria-label="图表视图"
          value={options.some(item => item.type === type) ? type : options[0]?.type ?? type}
          options={options.map(item => ({ value: item.type, label: item.label }))}
          onChange={next => apply(next as WidgetType)}
        />
      )}
      {showYear && years.length > 1 ? (
        useSelectForYears ? (
          <select
            className={s.year}
            aria-label="对比年份"
            value={yearValue}
            onChange={event => apply(type, event.target.value)}
          >
            {years.map(year => (
              <option key={year} value={year}>{year}年</option>
            ))}
          </select>
        ) : (
          <OpptrixSegmentedControl
            className={s.segmented}
            variant="embedded"
            aria-label="对比年份"
            value={yearValue}
            options={years.map(year => ({ value: year, label: `${year}年` }))}
            onChange={next => apply(type, next)}
          />
        )
      ) : null}
    </div>
  )
}
