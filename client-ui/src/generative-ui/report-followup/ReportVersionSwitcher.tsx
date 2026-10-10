import { useMemo, useRef, useState, type ReactNode } from 'react'
import { makeStyles, Text } from '@fluentui/react-components'
import OpptrixButton from '../../components/opptrix/OpptrixButton'
import type { Dataset } from '../../chat/research-canvas/types'
import type { ChatToolStep } from '../../types/chatProgress'
import { opptrixCssVars } from '../../theme/tokens'
import { makeActionBridge } from '../actionBridge'
import { specFromSteps } from '../specFromSteps'
import SpecRenderer, { type SpecRendererProps } from '../SpecRenderer'
import type { ReportVersion } from './reportVersions'

const useStyles = makeStyles({
  bar: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', margin: '4px 0' },
  label: { fontSize: 'var(--opptrix-font-md)', color: opptrixCssVars.textSecondary },
  compare: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px', alignItems: 'start' },
  column: { minWidth: 0 },
  empty: { fontSize: 'var(--opptrix-font-md)', color: opptrixCssVars.textSecondary, lineHeight: 1.6 },
})

type Followup = SpecRendererProps['onFollowup']

function versionLabel(version: ReportVersion): string {
  if (version.version === 1) return 'v1 原始'
  const q = version.question ?? ''
  return `v${version.version} 追问：${q.length > 12 ? `${q.slice(0, 12)}…` : q}`
}

/** 某一版的报告：用那一轮自己的步骤与 Spec；那一轮没有图表时说明去哪里看 */
function VersionBody({ version, steps, datasets, fallback, onFollowup }: {
  version: ReportVersion
  steps: readonly ChatToolStep[]
  datasets: readonly Dataset[]
  fallback: ReactNode
  onFollowup?: Followup
}) {
  const s = useStyles()
  const rootRef = useRef<HTMLDivElement>(null)
  const spec = useMemo(() => specFromSteps(steps), [steps])
  const onAction = useMemo(() => makeActionBridge({ steps, datasets, root: () => rootRef.current }), [steps, datasets])
  if (spec == null) {
    return version.version === 1
      ? <>{fallback}</>
      : <Text className={s.empty} block>这一版没有新的图表，文字回答在下方追问的那段里。</Text>
  }
  return (
    <div ref={rootRef} data-report-version={version.version}>
      <SpecRenderer spec={spec} datasets={datasets} fallback={fallback} onAction={onAction} onFollowup={onFollowup} />
    </div>
  )
}

/**
 * 一段报告的多个版本：默认显示最新一版，可切回旧版或并排对比（v1 与当前选中的一版）。
 * 旧版本原样保留，不改写。
 */
export default function ReportVersionSwitcher({ versions, stepsOf, datasets, fallback, onFollowup }: {
  versions: readonly ReportVersion[]
  stepsOf: (messageIndex: number) => readonly ChatToolStep[]
  datasets: readonly Dataset[]
  fallback: ReactNode
  onFollowup?: Followup
}) {
  const s = useStyles()
  const latest = versions[versions.length - 1] ?? versions[0]
  const [selected, setSelected] = useState<number>(latest?.version ?? 1)
  const [comparing, setComparing] = useState(false)
  const current = versions.find(item => item.version === selected) ?? latest
  const first = versions[0]
  if (!current || !first || !latest) return <>{fallback}</>
  /** 对比时左边固定 v1；右边是选中的版本，选中 v1 时用最新一版 */
  const other = current.version === 1 ? latest : current
  const body = (version: ReportVersion) => (
    <VersionBody version={version} steps={stepsOf(version.messageIndex)} datasets={datasets} fallback={fallback} onFollowup={onFollowup} />
  )
  if (versions.length < 2) return body(first)
  return (
    <div data-report-versions={versions.length}>
      <div className={s.bar} role="group" aria-label="报告版本">
        <Text className={s.label}>报告版本</Text>
        {versions.map(version => (
          <OpptrixButton
            key={version.version}
            variant="ghost"
            size="small"
            aria-pressed={!comparing && version.version === current.version}
            onClick={() => { setSelected(version.version); setComparing(false) }}
          >
            {versionLabel(version)}
          </OpptrixButton>
        ))}
        <OpptrixButton variant="ghost" size="small" aria-pressed={comparing} onClick={() => setComparing(value => !value)}>
          并排对比
        </OpptrixButton>
      </div>
      {comparing ? (
        <div className={s.compare} data-report-compare="true">
          <div className={s.column}><Text className={s.label} block>{versionLabel(first)}</Text>{body(first)}</div>
          <div className={s.column}><Text className={s.label} block>{versionLabel(other)}</Text>{body(other)}</div>
        </div>
      ) : body(current)}
    </div>
  )
}
