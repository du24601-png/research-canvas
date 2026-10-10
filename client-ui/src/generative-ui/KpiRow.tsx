import { makeStyles, Text } from '@fluentui/react-components'
import type { ResearchUiBlock } from '@opptrix/shared/research-ui-spec'
import { opptrixCssVars } from '../theme/tokens'
import { BlockFrame } from './BlockFrame'
import { kpiFigures, MISSING } from './numberText'
import type { BlockProps } from './types'

type KpiBlock = Extract<ResearchUiBlock, { component: 'KpiRow' }>

const useStyles = makeStyles({
  row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' },
  figure: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
  label: { fontSize: 'var(--opptrix-font-md)', color: opptrixCssVars.textSecondary },
  value: {
    fontFamily: 'var(--opptrix-font-mono)',
    fontSize: '28px',
    fontWeight: 600,
    lineHeight: 1.15,
    color: opptrixCssVars.textPrimary,
    fontVariantNumeric: 'tabular-nums',
  },
  unit: { fontSize: '15px', fontWeight: 500, marginLeft: '2px', color: opptrixCssVars.textSecondary },
  delta: { fontSize: 'var(--opptrix-font-md)', color: opptrixCssVars.textSecondary, fontFamily: 'var(--opptrix-font-mono)' },
})

/** 至多三个大数字：数值与较上年变化都由 numberText 从 Dataset 取/算，缺值显示「—」 */
export default function KpiRow({ block, getDataset }: BlockProps<KpiBlock>) {
  const s = useStyles()
  const dataset = getDataset(block.datasetId)
  if (!dataset) return null
  const figures = kpiFigures(dataset, block.period)
  if (!figures.length) return null
  return (
    <BlockFrame title={block.title ?? '关键数字'} kind="KpiRow">
      <div className={s.row}>
        {figures.map(figure => (
          <div key={figure.entityId} className={s.figure} data-kpi-entity={figure.entityId}>
            <Text className={s.label}>{figure.label}</Text>
            <span className={s.value} aria-label={figure.value === MISSING ? '暂无数据' : undefined}>
              {figure.value}
              {figure.unit ? <span className={s.unit}>{figure.unit}</span> : null}
            </span>
            {figure.delta ? <Text className={s.delta}>{figure.delta}</Text> : null}
          </div>
        ))}
      </div>
    </BlockFrame>
  )
}
