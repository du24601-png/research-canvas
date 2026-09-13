import { useEffect, useState } from 'react'
import { Spinner, Text } from '@fluentui/react-components'
import { sanitizeResearchBoardSnapshotPayload } from '@opptrix/shared/research-board-snapshot'
import { fetchResearchBoardSnapshot } from '../../api/client'
import ResearchCanvas from './ResearchCanvas'
import type { CanvasLayoutItem, Dataset, PersistedCanvasState, Widget } from './types'

interface Props {
  snapshotId: string
}

export default function ResearchBoardSnapshotPage({ snapshotId }: Props) {
  const [state, setState] = useState<{
    title: string
    frozenState: PersistedCanvasState
    createdAt: string
  } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void fetchResearchBoardSnapshot(snapshotId)
      .then((result) => {
        if (cancelled) return
        const payload = sanitizeResearchBoardSnapshotPayload(result.payload)
        if (!payload) {
          setError('看板内容无效或已损坏')
          return
        }
        setState({
          title: result.title,
          createdAt: result.createdAt,
          frozenState: {
            version: 2,
            widgets: payload.widgets as Widget[],
            layout: payload.layout as CanvasLayoutItem[],
            datasets: payload.datasets as Dataset[],
          },
        })
      })
      .catch(() => {
        if (!cancelled) setError('看板不存在或已失效')
      })
    return () => {
      cancelled = true
    }
  }, [snapshotId])

  if (error) {
    return (
      <div className="research-board-snapshot-page">
        <Text block role="alert">{error}</Text>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="research-board-snapshot-page">
        <Spinner size="medium" label="正在加载看板…" />
      </div>
    )
  }

  return (
    <div className="research-board-snapshot-page">
      <div className="research-board-snapshot-page__meta">
        <Text block>{state.title}</Text>
        <Text block size={200}>发布于 {new Date(state.createdAt).toLocaleString()}</Text>
      </div>
      <ResearchCanvas
        sessionTitle={state.title}
        readonly
        frozenState={state.frozenState}
      />
    </div>
  )
}
