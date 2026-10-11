import type { ReactNode } from 'react'
import { makeStyles, Text } from '@fluentui/react-components'
import OpptrixButton from '../components/opptrix/OpptrixButton'
import { opptrixCssVars, opptrixTokens } from '../theme/tokens'

export const useBlockStyles = makeStyles({
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    margin: '8px 0 12px',
    padding: '14px 16px 12px',
    minWidth: 0,
    borderRadius: opptrixTokens.radiusLg,
    backgroundColor: opptrixCssVars.surface,
    border: `1px solid ${opptrixCssVars.separator}`,
  },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' },
  title: { fontSize: 'var(--opptrix-font-xl)', fontWeight: 600, color: opptrixCssVars.textPrimary },
  actions: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  note: { fontSize: 'var(--opptrix-font-md)', color: opptrixCssVars.textSecondary, lineHeight: 1.5 },
  plot: {
    // 随列宽等比放大（宽屏不再扁平），220–360px 之间
    aspectRatio: '3 / 1',
    minHeight: '220px',
    maxHeight: '360px',
    minWidth: 0,
    borderRadius: opptrixTokens.radiusMd,
    backgroundColor: opptrixCssVars.canvasAlt,
    border: `1px solid ${opptrixCssVars.separator}`,
    overflow: 'hidden',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' },
  rows: { display: 'grid', gridTemplateColumns: '6.5em minmax(0, 1fr)', gap: '4px 8px', fontSize: 'var(--opptrix-font-md)' },
  label: { color: opptrixCssVars.textSecondary },
})

export interface BlockAction {
  key: string
  label: string
  pressed?: boolean
  onClick: () => void
}

/** 组件外壳：标题 + 已注册动作按钮。动作只回调，不在这里产生副作用。 */
export function BlockFrame({ title, kind, actions = [], children }: {
  title: string
  kind: string
  actions?: BlockAction[]
  children: ReactNode
}) {
  const s = useBlockStyles()
  return (
    <section className={s.card} data-generative-ui-block={kind} aria-label={title}>
      <div className={s.head}>
        <Text className={s.title}>{title}</Text>
        {actions.length ? (
          <div className={s.actions}>
            {actions.map(action => (
              <OpptrixButton key={action.key} variant="ghost" size="small" aria-pressed={action.pressed} onClick={action.onClick}>
                {action.label}
              </OpptrixButton>
            ))}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  )
}
