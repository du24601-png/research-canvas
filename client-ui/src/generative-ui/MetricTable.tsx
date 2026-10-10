import { makeStyles, mergeClasses } from '@fluentui/react-components'
import type { ResearchUiBlock } from '@opptrix/shared/research-ui-spec'
import { opptrixCssVars } from '../theme/tokens'
import type { Dataset } from '../chat/research-canvas/types'
import { BlockFrame } from './BlockFrame'
import { WithCitation } from './CitationChip'
import { metricTableModel, shadeAlpha, SPARK_HEIGHT, SPARK_WIDTH, type MetricRow } from './metricTableModel'
import { citationFor, MISSING } from './numberText'
import type { BlockProps } from './types'

type TableBlock = Extract<ResearchUiBlock, { component: 'MetricTable' }>

const useStyles = makeStyles({
  scroll: { overflowX: 'auto', maxWidth: '100%' },
  table: {
    borderCollapse: 'collapse',
    minWidth: '100%',
    fontSize: 'var(--opptrix-font-md)',
    color: opptrixCssVars.textPrimary,
  },
  caption: { textAlign: 'left', padding: '4px 0 6px', fontWeight: 600, color: opptrixCssVars.textSecondary },
  th: {
    padding: '4px 8px',
    textAlign: 'right',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    color: opptrixCssVars.textSecondary,
    borderBottom: `1px solid ${opptrixCssVars.separator}`,
  },
  name: { padding: '4px 8px 4px 0', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 500 },
  cell: {
    padding: '4px 8px',
    textAlign: 'right',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--opptrix-font-mono)',
    fontVariantNumeric: 'tabular-nums',
    cursor: 'help',
    ':focus-visible': { outline: '2px solid rgba(10, 132, 255, 0.6)', outlineOffset: '-2px' },
  },
  missing: { color: opptrixCssVars.textSecondary },
  spark: { padding: '4px 8px', color: opptrixCssVars.textSecondary },
  stack: { display: 'flex', flexDirection: 'column', gap: '14px' },
})

function shadeStyle(shade: number | null) {
  const pct = Math.round(shadeAlpha(shade) * 100)
  return pct ? { backgroundColor: `color-mix(in srgb, ${opptrixCssVars.textPrimary} ${pct}%, transparent)` } : undefined
}

function Row({ dataset, row }: { dataset: Dataset; row: MetricRow }) {
  const s = useStyles()
  return (
    <tr data-entity={row.entityId}>
      <th scope="row" className={s.name}>{row.name}</th>
      {row.cells.map(cell => (
        <WithCitation key={cell.period} citation={citationFor(dataset, [row.entityId], cell.period)}>
          <td
            className={mergeClasses(s.cell, cell.value == null && s.missing)}
            style={shadeStyle(cell.shade)}
            tabIndex={0}
            aria-label={cell.value == null ? `${row.name} ${cell.period} 年暂无数据` : undefined}
            data-period={cell.period}
          >
            {cell.text}
          </td>
        </WithCitation>
      ))}
      <td className={s.spark} aria-hidden>
        {row.spark ? (
          <svg width={SPARK_WIDTH} height={SPARK_HEIGHT + 2} viewBox={`0 -1 ${SPARK_WIDTH} ${SPARK_HEIGHT + 2}`}>
            <path d={row.spark} fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        ) : null}
      </td>
      <td className={mergeClasses(s.cell, row.change === MISSING && s.missing)} data-change>{row.change}</td>
    </tr>
  )
}

function DatasetTable({ dataset }: { dataset: Dataset }) {
  const s = useStyles()
  const model = metricTableModel(dataset)
  return (
    <div className={s.scroll} data-metric-table={dataset.id}>
      <table className={s.table}>
        <caption className={s.caption}>{model.caption}</caption>
        <thead>
          <tr>
            <th className={s.th} scope="col" aria-label="公司" />
            {model.periods.map(period => <th key={period} className={s.th} scope="col">{period}</th>)}
            <th className={s.th} scope="col">走势</th>
            <th className={s.th} scope="col" title="首年到末年的变化">{model.changeHeader}</th>
          </tr>
        </thead>
        <tbody>
          {model.rows.map(row => <Row key={row.entityId} dataset={dataset} row={row} />)}
        </tbody>
      </table>
    </div>
  )
}

/** 数值明细表：每个数据集一张小表，数字全部由 metricTable 从 Dataset 取/算，悬停或聚焦看来源 */
export default function MetricTable({ block, getDataset }: BlockProps<TableBlock>) {
  const s = useStyles()
  const datasets = block.datasetIds.map(getDataset).filter((d): d is Dataset => Boolean(d))
  if (!datasets.length) return null
  return (
    <BlockFrame title={block.title ?? '数值明细'} kind="MetricTable">
      <div className={s.stack}>
        {datasets.map(dataset => <DatasetTable key={dataset.id} dataset={dataset} />)}
      </div>
    </BlockFrame>
  )
}
