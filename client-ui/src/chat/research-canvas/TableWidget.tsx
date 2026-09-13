import { useCallback, useMemo, useState, memo } from 'react'
import { makeStyles, mergeClasses, Text } from '@fluentui/react-components'
import { opptrixCssVars } from '../../theme/tokens'
import SourceCitationBar from './SourceCitationBar'
import { buildTableView } from './views'
import type { Dataset } from './types'

const useStyles = makeStyles({
  wrap: {
    height: '100%',
    minHeight: 0,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontVariantNumeric: 'tabular-nums',
    '& td': {
      padding: '8px 10px',
      textAlign: 'right',
      whiteSpace: 'nowrap',
      borderBottom: `1px solid ${opptrixCssVars.separator}`,
    },
    '& td:first-child': { textAlign: 'left' },
    '& th:not(:first-child)': { textAlign: 'right' },
    color: opptrixCssVars.textPrimary,
  },
  th: {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    textAlign: 'left',
    fontWeight: 590,
    fontSize: 'var(--opptrix-font-base)',
    padding: '8px 10px',
    backgroundColor: opptrixCssVars.canvasAlt,
    borderBottom: `1px solid ${opptrixCssVars.separatorStrong}`,
    whiteSpace: 'nowrap',
  },
  entityCell: {
    fontWeight: 590,
    fontSize: 'var(--opptrix-font-base)',
  },
  valueCell: {
    fontSize: 'var(--opptrix-font-lg)',
    fontWeight: 550,
    cursor: 'pointer',
    ':hover': {
      backgroundColor: opptrixCssVars.surfaceHover,
    },
  },
  valueCellSelected: {
    backgroundColor: opptrixCssVars.accentSoft,
    outline: `1px solid ${opptrixCssVars.borderStrong}`,
    outlineOffset: '-1px',
  },
  valueCellMissing: {
    color: opptrixCssVars.textTertiary,
    cursor: 'pointer',
  },
})

interface Props {
  dataset: Dataset
}

export default memo(function TableWidget({ dataset }: Props) {
  const s = useStyles()
  const view = useMemo(() => buildTableView(dataset), [dataset])
  const [selected, setSelected] = useState<{ entityId: string; period: string } | null>(null)

  const selectCell = useCallback((entityId: string, period: string) => {
    setSelected(current => (
      current?.entityId === entityId && current.period === period
        ? null
        : { entityId, period }
    ))
  }, [])

  return (
    <div className={s.wrap}>
      {selected ? (
        <SourceCitationBar
          dataset={dataset}
          entityId={selected.entityId}
          period={selected.period}
          onDismiss={() => setSelected(null)}
        />
      ) : null}
      <table className={s.table}>
        <thead>
          <tr>
            {view.headers.map(header => (
              <th key={header} className={s.th}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.rows.map((row, rowIndex) => {
            const entity = dataset.entities[rowIndex]
            return (
              <tr key={row[0]}>
                {row.map((cell, index) => {
                  if (index === 0 || !entity) {
                    return (
                      <td key={`${row[0]}-${index}`} className={s.entityCell}>
                        {cell}
                      </td>
                    )
                  }
                  const period = dataset.periods[index - 1]
                  if (!period) {
                    return <td key={`${row[0]}-${index}`}>{cell}</td>
                  }
                  const isSelected = selected?.entityId === entity.id && selected.period === period
                  const missing = cell === '—'
                  return (
                    <td
                      key={`${row[0]}-${index}`}
                      className={mergeClasses(
                        s.valueCell,
                        missing && s.valueCellMissing,
                        isSelected && s.valueCellSelected,
                      )}
                      title="点击查看数据依据"
                      onClick={(event) => {
                        event.stopPropagation()
                        selectCell(entity.id, period)
                      }}
                    >
                      {cell}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      <Text size={200} style={{ display: 'block', color: opptrixCssVars.textTertiary }}>
        单位：{view.unit}
      </Text>
    </div>
  )
})
