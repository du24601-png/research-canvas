import { makeStyles, Text } from '@fluentui/react-components'
import { memo, useMemo } from 'react'
import { opptrixCssVars } from '../../theme/tokens'
import { buildTableView } from './views'
import type { Dataset } from './types'

const useStyles = makeStyles({
  wrap: {
    height: '100%',
    minHeight: 0,
    overflow: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
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
    padding: '8px 10px',
    backgroundColor: opptrixCssVars.canvasAlt,
    borderBottom: `1px solid ${opptrixCssVars.separatorStrong}`,
    whiteSpace: 'nowrap',
  },
  entityCell: {
    fontWeight: 590,
  },
})

interface Props {
  dataset: Dataset
}

export default memo(function TableWidget({ dataset }: Props) {
  const s = useStyles()
  const view = useMemo(() => buildTableView(dataset), [dataset])

  return (
    <div className={s.wrap}>
      <table className={s.table}>
        <thead>
          <tr>
            {view.headers.map(header => (
              <th key={header} className={s.th}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.rows.map(row => (
            <tr key={row[0]}>
              {row.map((cell, index) => (
                <td
                  key={`${row[0]}-${index}`}
                  className={index === 0 ? s.entityCell : undefined}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <Text size={200} style={{ display: 'block', marginTop: '8px', color: opptrixCssVars.textTertiary }}>
        单位：{view.unit}
      </Text>
    </div>
  )
})
