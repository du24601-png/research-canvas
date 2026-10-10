import { useMemo } from 'react'
import { makeStyles, mergeClasses, shorthands } from '@fluentui/react-components'
import type { ChatToolStep } from '../../types/chatProgress'
import { opptrixTokens, opptrixCssVars } from '../../theme/tokens'
import { motion } from '../../theme/mixins'
import { readPersistedCanvasState } from '../research-canvas/layoutStorage'
import type { Dataset } from '../research-canvas/types'
import { buildTraceSummary } from './progressSummary'

const useStyles = makeStyles({
  line: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '6px 8px',
    width: '100%',
    margin: 0,
    padding: '9px 14px',
    border: `1px solid ${opptrixCssVars.separator}`,
    borderRadius: opptrixTokens.radiusLg,
    backgroundColor: 'transparent',
    boxSizing: 'border-box',
    textAlign: 'left',
    fontFamily: 'inherit',
    fontSize: 'var(--opptrix-font-sm)',
    lineHeight: 1.45,
    color: opptrixCssVars.textTertiary,
  },
  clickable: {
    cursor: 'pointer',
    transitionProperty: 'border-color',
    transitionDuration: motion.fast,
    ':hover': {
      ...shorthands.borderColor(opptrixCssVars.separatorStrong),
    },
  },
  tag: {
    fontFamily: 'var(--opptrix-font-mono)',
    fontSize: 'var(--opptrix-font-sm)',
    padding: '0 6px',
    borderRadius: opptrixTokens.radiusSm,
    backgroundColor: opptrixCssVars.canvasAlt,
    color: opptrixCssVars.textSecondary,
    whiteSpace: 'nowrap',
  },
  missing: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    color: opptrixCssVars.warning,
    whiteSpace: 'nowrap',
    '::before': {
      content: '""',
      width: '5px',
      height: '5px',
      borderRadius: '50%',
      backgroundColor: 'currentColor',
    },
  },
})

interface Props {
  steps: ChatToolStep[]
  sessionId?: string | null
  /** 有详细过程可看时，整行可点开 / 收起 */
  onToggle?: () => void
  expanded?: boolean
}

/** 每次步骤变化时重读本地已存的数据集，用于精确到「公司 年份」的缺失说明 */
function useTraceSummary(sessionId: string | null | undefined, steps: ChatToolStep[]) {
  return useMemo(() => {
    const datasets = new Map<string, Dataset>()
    for (const dataset of readPersistedCanvasState(sessionId).datasets) datasets.set(dataset.id, dataset)
    return buildTraceSummary(steps, id => datasets.get(id))
  }, [sessionId, steps])
}

/** 回答完成后的一行取数摘要：「已查完」+ 公司 / 指标年份 / 口径标签 + 缺失项 */
export default function TraceSummaryLine({ steps, sessionId, onToggle, expanded = false }: Props) {
  const s = useStyles()
  const summary = useTraceSummary(sessionId, steps)
  const hasToolSteps = steps.some(step => step.status !== 'running')
  const content = (
    <>
      <span>{hasToolSteps ? '已查完' : '思考过程'}</span>
      {summary.tags.map(tag => <span key={tag} className={s.tag}>{tag}</span>)}
      {summary.missing ? <span className={s.missing}>{summary.missing}</span> : null}
    </>
  )
  if (!onToggle) {
    return <div className={s.line} data-trace-summary>{content}</div>
  }
  return (
    <button
      type="button"
      className={mergeClasses(s.line, s.clickable)}
      onClick={onToggle}
      aria-expanded={expanded}
      title={expanded ? '收起取数过程' : '查看取数过程'}
      data-trace-summary
    >
      {content}
    </button>
  )
}
