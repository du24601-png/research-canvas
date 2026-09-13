import { useCallback, useState } from 'react'
import { makeStyles, Text } from '@fluentui/react-components'
import type { ChatToolStep } from '../../types/chatProgress'
import OpptrixButton from '../../components/opptrix/OpptrixButton'
import { opptrixCssVars, opptrixTokens } from '../../theme/tokens'
import { steerSessionChat } from '../../api/client'
import {
  buildQueryDataConfirmSteer,
} from '@opptrix/shared/research-query-plan'
import { fetchPlanFromToolStep } from './fetchPlanFromToolStep'
import { requestAdjustResearchFetchPlan } from './researchFetchPlanAdjust'

const steeredPlanStepIds = new Set<string>()

const useStyles = makeStyles({
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    margin: '8px 0 12px',
    padding: '14px 16px 12px',
    borderRadius: opptrixTokens.radiusLg,
    backgroundColor: opptrixCssVars.surface,
    border: `1px solid ${opptrixCssVars.separator}`,
    boxShadow: opptrixCssVars.composerFloatShadow,
  },
  label: {
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textSecondary,
    lineHeight: 1.4,
  },
  statement: {
    fontSize: 'var(--opptrix-font-xl)',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    color: opptrixCssVars.textPrimary,
    lineHeight: 1.35,
  },
  hint: {
    display: 'block',
    fontSize: 'var(--opptrix-font-md)',
    color: opptrixCssVars.textSecondary,
    lineHeight: 1.45,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
})

interface Props {
  step: ChatToolStep
  sessionId?: string | null
  live?: boolean
  isLatest?: boolean
}

export default function ResearchFetchPlanCard({
  step,
  sessionId = null,
  live = false,
  isLatest = false,
}: Props) {
  const s = useStyles()
  const parsed = fetchPlanFromToolStep(step)
  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const confirmPlan = useCallback(async () => {
    if (!parsed || !sessionId || busy || dismissed || steeredPlanStepIds.has(step.id)) return
    steeredPlanStepIds.add(step.id)
    setBusy(true)
    try {
      await steerSessionChat(sessionId, buildQueryDataConfirmSteer(parsed.plan, parsed.query))
      setDismissed(true)
    } finally {
      setBusy(false)
    }
  }, [busy, dismissed, parsed, sessionId, step.id])

  const editPlan = useCallback(() => {
    if (!parsed || dismissed) return
    steeredPlanStepIds.add(step.id)
    setDismissed(true)
    requestAdjustResearchFetchPlan(parsed.plan.statement)
  }, [dismissed, parsed])

  if (!parsed || dismissed) return null

  const hint = live && isLatest
    ? '确认后将按此计划取数'
    : '已等待确认取数'

  const showActions = live && isLatest && Boolean(sessionId)

  return (
    <div className={s.card} role="region" aria-label="取数计划">
      <Text className={s.label} block>取数计划</Text>
      <Text className={s.statement} block>{parsed.plan.statement}</Text>
      <Text className={s.hint} block>{hint}</Text>
      {showActions ? (
        <div className={s.footer}>
          <div className={s.actions}>
            <OpptrixButton
              variant="secondary"
              size="medium"
              disabled={busy}
              onClick={editPlan}
            >
              改一下
            </OpptrixButton>
            <OpptrixButton
              variant="primary"
              size="medium"
              disabled={busy}
              onClick={() => { void confirmPlan() }}
            >
              确认取数
            </OpptrixButton>
          </div>
        </div>
      ) : null}
    </div>
  )
}
