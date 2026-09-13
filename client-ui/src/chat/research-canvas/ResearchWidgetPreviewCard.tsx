import { useEffect, useMemo, useState } from 'react'
import { makeStyles, Skeleton, SkeletonItem, Text } from '@fluentui/react-components'
import { CheckmarkRegular } from '@fluentui/react-icons'
import type { ChatToolStep } from '../../types/chatProgress'
import OpptrixButton from '../../components/opptrix/OpptrixButton'
import { opptrixCssVars, opptrixTokens } from '../../theme/tokens'
import BarChartWidget from './BarChartWidget'
import GroupedBarChartWidget from './GroupedBarChartWidget'
import LineChartWidget from './LineChartWidget'
import SourcesWidget from './SourcesWidget'
import TableWidget from './TableWidget'
import {
  CandlestickChartWidget,
  ComboBarLineChartWidget,
  PieDonutChartWidget,
  StackedBarChartWidget,
} from './ExtraChartWidgets'
import HeatmapWidget from './HeatmapWidget'
import { ViewSwitcher } from './ViewSwitcher'
import { publishResearchCanvasEvent, subscribeResearchCanvasEvents } from './researchCanvasBus'
import { coverageLabel, datasetSubtitle } from './datasetLabels'
import DatasetEvidence from './DatasetEvidence'
import ResearchRecovery from './ResearchRecovery'
import { readPersistedCanvasState, resolveLiveResearchDataset } from './layoutStorage'
import { hasLiveWidgetForProposal } from './proposalCanvasLink'
import { requestAdjustResearchProposal } from './researchPreviewAdjust'
import { compactChartStyle, sanitizeChartStyle } from '@opptrix/shared/research-chart-style'
import { compactResearchWidgetView, sanitizeResearchWidgetView } from '@opptrix/shared/research-view-params'
import { previewLoadingStageLabel } from '../toolLiveStatus'
import { asWidgetType, proposalMetaFromToolStep, toolStepHasProposalError, type PreviewProposalMeta } from './proposalFromToolStep'
import type { Dataset, Widget, WidgetType } from './types'

const useStyles = makeStyles({
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    margin: '8px 0 12px',
    padding: '14px 16px 12px',
    borderRadius: opptrixTokens.radiusLg,
    backgroundColor: opptrixCssVars.canvasAlt,
    border: 'none',
  },
  cardAccepted: {
    backgroundColor: opptrixCssVars.successSoft,
  },
  title: {
    fontSize: 'var(--opptrix-font-xl)',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    color: opptrixCssVars.textPrimary,
    lineHeight: 1.35,
  },
  subtitle: {
    display: 'block',
    marginTop: '2px',
    fontSize: 'var(--opptrix-font-md)',
    color: opptrixCssVars.textSecondary,
    lineHeight: 1.45,
  },
  plot: {
    height: '240px',
    minHeight: '220px',
    borderRadius: opptrixTokens.radiusMd,
    backgroundColor: opptrixCssVars.canvasAlt,
    overflow: 'hidden',
  },
  skeletonPlot: {
    height: '240px',
    borderRadius: opptrixTokens.radiusMd,
    overflow: 'hidden',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  meta: {
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  accepted: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: 'var(--opptrix-font-sm)',
    fontWeight: 600,
    color: opptrixCssVars.success,
  },
  loadingLabel: {
    display: 'block',
    marginTop: '8px',
    fontSize: 'var(--opptrix-font-md)',
    color: opptrixCssVars.textSecondary,
    lineHeight: 1.45,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '10px',
  },
  headerBody: {
    flex: '1 1 auto',
    minWidth: 0,
  },
})

interface Props {
  step: ChatToolStep
}

function PreviewPlot({ type, dataset, period, topN, style }: {
  type: WidgetType
  dataset: Dataset
  period?: string
  topN?: number
  style?: Widget['style']
}) {
  if (type === 'line_chart') return <LineChartWidget dataset={dataset} topN={topN} style={style} />
  if (type === 'bar_chart') return <BarChartWidget dataset={dataset} period={period} style={style} />
  if (type === 'grouped_bar') return <GroupedBarChartWidget dataset={dataset} style={style} />
  if (type === 'stacked_bar') return <StackedBarChartWidget dataset={dataset} percent={false} />
  if (type === 'stacked_bar_percent') return <StackedBarChartWidget dataset={dataset} percent />
  if (type === 'combo_bar_line') return <ComboBarLineChartWidget dataset={dataset} />
  if (type === 'pie_chart') return <PieDonutChartWidget dataset={dataset} donut={false} period={period} />
  if (type === 'donut_chart') return <PieDonutChartWidget dataset={dataset} donut period={period} />
  if (type === 'candlestick') return <CandlestickChartWidget dataset={dataset} />
  if (type === 'heatmap_table') return <HeatmapWidget dataset={dataset} />
  if (type === 'table') return <TableWidget dataset={dataset} />
  return <SourcesWidget dataset={dataset} />
}

export default function ResearchWidgetPreviewCard({ step }: Props) {
  const s = useStyles()
  const [persistEpoch, setPersistEpoch] = useState(0)
  const [liveProposal, setLiveProposal] = useState<PreviewProposalMeta | null>(null)
  const [override, setOverride] = useState<Pick<PreviewProposalMeta, 'type' | 'title' | 'view'> | null>(null)
  const [adoptedHere, setAdoptedHere] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => subscribeResearchCanvasEvents((event) => {
    if (typeof event !== 'object' || event === null) return
    const record = event as Record<string, unknown>
    if (record.type === 'dataset_created') {
      setPersistEpoch(value => value + 1)
    }
    if (record.type === 'widget_adopted' && typeof record.proposal === 'object' && record.proposal) {
      const proposal = record.proposal as Record<string, unknown>
      if (proposal.id === step.id) {
        setAdoptedHere(true)
        setPersistEpoch(value => value + 1)
      }
    }
    if (record.type === 'widget_deleted' || record.type === 'canvas_restored') {
      setPersistEpoch(value => value + 1)
    }
    if (record.type !== 'widget_proposed' || typeof record.proposal !== 'object' || !record.proposal) {
      return
    }
    const proposal = record.proposal as Record<string, unknown>
    if (proposal.id !== step.id) return
    const type = asWidgetType(proposal.type)
    const title = typeof proposal.title === 'string' ? proposal.title.trim() : ''
    const datasetId = typeof proposal.datasetId === 'string' ? proposal.datasetId.trim() : ''
    if (!type || !title || !datasetId) return
    const view = compactResearchWidgetView(sanitizeResearchWidgetView(proposal.view))
    const style = compactChartStyle(sanitizeChartStyle(proposal.style))
    setLiveProposal({
      id: step.id,
      type,
      title,
      datasetId,
      ...(view ? { view } : {}),
      ...(style ? { style } : {}),
    })
    setOverride(null)
  }), [step.id])

  const parsed = proposalMetaFromToolStep(step)
  const base = liveProposal ?? (parsed ? { ...parsed, id: step.id } : null)
  const meta = base && override ? { ...base, ...override } : base
  const persist = useMemo(() => readPersistedCanvasState(), [persistEpoch, liveProposal, step.status])
  const markedAccepted = adoptedHere || Boolean(
    persist.acceptedProposalIds?.includes(step.id)
    || (meta && persist.acceptedProposalIds?.includes(meta.id)),
  )
  const onCanvas = meta ? hasLiveWidgetForProposal(persist, meta) : false
  const accepted = markedAccepted && onCanvas
  const dataset = meta?.datasetId
    ? resolveLiveResearchDataset(persist, meta.datasetId)
    : undefined
  const errored = toolStepHasProposalError(step) || (step.status === 'done' && !dataset)
  const loading = !errored && (step.status === 'running') && (!liveProposal || !dataset)

  if (dismissed && !accepted) return null

  if (loading) {
    const loadingLabel = previewLoadingStageLabel({
      hasProposal: Boolean(liveProposal),
      hasDataset: Boolean(dataset),
    })
    return (
      <div className={s.card} data-research-preview="loading">
        <Skeleton>
          <SkeletonItem className={s.skeletonPlot} />
        </Skeleton>
        <Text className={s.loadingLabel}>{loadingLabel}</Text>
      </div>
    )
  }

  if (!meta || errored || !dataset) {
    return (
      <div className={s.card} data-research-preview="error">
        <ResearchRecovery title={meta?.title} missingData={Boolean(meta && !dataset && !toolStepHasProposalError(step))} />
      </div>
    )
  }

  const coverage = coverageLabel(dataset)

  const focusOnCanvas = () => {
    publishResearchCanvasEvent({
      type: 'focus_widget',
      proposal: {
        id: meta.id,
        type: meta.type,
        title: meta.title,
        datasetId: meta.datasetId,
      },
    })
  }

  return (
    <div
      className={accepted ? `${s.card} ${s.cardAccepted}` : s.card}
      data-research-preview={accepted ? 'accepted' : 'ready'}
    >
      <div className={s.headerRow}>
        <div className={s.headerBody}>
          <Text className={s.title}>{meta.title}</Text>
          <Text className={s.subtitle}>{datasetSubtitle(dataset)}</Text>
        </div>
        <DatasetEvidence dataset={dataset} />
      </div>
      <ViewSwitcher
          dataset={dataset}
          type={meta.type}
          period={meta.view?.period}
          onChange={next => setOverride({
            type: next.type,
            title: next.title,
            view: {
              ...(meta.view ?? {}),
              ...(next.period ? { period: next.period } : {}),
              ...(next.topN ? { topN: next.topN } : {}),
            },
          })}
        />
      <div className={s.plot}>
        <PreviewPlot
          type={meta.type}
          dataset={dataset}
          period={meta.view?.period}
          topN={meta.view?.topN}
          style={meta.style}
        />
      </div>
      <div className={s.footer}>
        <Text className={s.meta}>
          {coverage}
        </Text>
        {accepted ? (
          <div className={s.actions}>
            <Text className={s.accepted}>
              <CheckmarkRegular fontSize={14} aria-hidden />
              已添加到画布
            </Text>
            <OpptrixButton
              variant="primary"
              size="small"
              onClick={focusOnCanvas}
            >
              在画布中定位
            </OpptrixButton>
          </div>
        ) : (
          <div className={s.actions}>
            <OpptrixButton
              variant="ghost"
              size="small"
              onClick={() => setDismissed(true)}
            >
              取消
            </OpptrixButton>
            <OpptrixButton
              variant="ghost"
              size="small"
              onClick={() => requestAdjustResearchProposal({
                proposalId: meta.id,
                type: meta.type,
                title: meta.title,
                datasetId: meta.datasetId,
              })}
            >
              调整
            </OpptrixButton>
            <OpptrixButton
              variant="primary"
              size="small"
              onClick={() => {
                setAdoptedHere(true)
                publishResearchCanvasEvent({
                  type: 'widget_adopted',
                  proposal: {
                    id: step.id,
                    type: meta.type,
                    title: meta.title,
                    datasetId: meta.datasetId,
                    ...(meta.view ? { view: meta.view } : {}),
                    ...(meta.style ? { style: meta.style } : {}),
                  },
                })
                focusOnCanvas()
                setPersistEpoch(value => value + 1)
              }}
            >
              添加到画布
            </OpptrixButton>
          </div>
        )}
      </div>
    </div>
  )
}
