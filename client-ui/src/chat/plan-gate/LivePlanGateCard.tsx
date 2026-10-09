import { useEffect, useState, useSyncExternalStore } from 'react'
import { makeStyles, Text } from '@fluentui/react-components'
import OpptrixButton from '../../components/opptrix/OpptrixButton'
import { steerSessionChat } from '../../api/client'
import { opptrixCssVars, opptrixTokens } from '../../theme/tokens'
import type { ChatToolStep } from '../../types/chatProgress'
import { requestComposerDraft } from '../research-canvas/researchFetchPlanAdjust'
import { readPlanGate, subscribePlanGate } from './planGateBus'

const useStyles = makeStyles({
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    margin: '8px 0 12px',
    padding: '12px 16px',
    borderRadius: opptrixTokens.radiusLg,
    backgroundColor: opptrixCssVars.surface,
    border: `1px solid ${opptrixCssVars.separator}`,
  },
  label: { fontSize: 'var(--opptrix-font-sm)', color: opptrixCssVars.textSecondary },
  statement: { fontSize: 'var(--opptrix-font-xl)', fontWeight: 600, color: opptrixCssVars.textPrimary },
  actions: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' },
})

export const PLAN_CANCEL_STEER = '先别查，我要调整取数计划。'

function useSecondsLeft(receivedAt: number, totalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [receivedAt])
  return Math.max(0, Math.ceil((receivedAt + totalMs - now) / 1000))
}

/**
 * 取数前的计划卡（方案 B，默认关）：倒计时结束自动按计划取数；
 * 「先别查」经现有 soft steer 告诉 Agent 停下；「修改」同样先让 Agent 停下，再把计划放进输入框供改写。
 */
export default function LivePlanGateCard({ sessionId, steps }: { sessionId: string | null; steps: readonly ChatToolStep[] }) {
  const s = useStyles()
  const gate = useSyncExternalStore(subscribePlanGate, () => readPlanGate(sessionId), () => null)
  const secondsLeft = useSecondsLeft(gate?.receivedAt ?? 0, gate?.autoContinueMs ?? 0)
  const [sent, setSent] = useState<string | null>(null)
  if (!gate || !sessionId) return null
  const stepDone = steps.some(step => step.id === gate.stepId && step.status !== 'running')
  if (stepDone || (secondsLeft === 0 && !sent)) return null
  const stop = async (note: string) => {
    setSent(note)
    const result = await steerSessionChat(sessionId, PLAN_CANCEL_STEER).catch(() => ({ ok: false }))
    if (!result.ok) setSent('没能送出，取数可能已经开始；可以等结果出来后再调整。')
  }
  const edit = () => {
    requestComposerDraft(`我想调整取数计划（${gate.plan.statement}）：`)
    void stop('已请 AI 先停下，计划已放进输入框：写好调整后发送。')
  }
  return (
    <div className={s.card} role="region" aria-label="取数计划" data-plan-gate>
      <Text className={s.label}>即将取数</Text>
      <Text className={s.statement}>{gate.plan.statement}</Text>
      {sent ? <Text className={s.label}>{sent}</Text> : (
        <div className={s.actions}>
          <Text className={s.label}>{secondsLeft} 秒后自动开始</Text>
          <OpptrixButton variant="ghost" size="small" onClick={() => { void stop('已请 AI 先停下，等你说明怎么调整。') }}>先别查</OpptrixButton>
          <OpptrixButton variant="primary" size="small" onClick={edit}>修改</OpptrixButton>
        </div>
      )}
    </div>
  )
}
