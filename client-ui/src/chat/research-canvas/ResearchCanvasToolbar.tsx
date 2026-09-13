import { useState } from 'react'
import { mergeClasses } from '@fluentui/react-components'
import {
  ArrowExportRegular,
  DismissRegular,
  ShareRegular,
  SlideLayoutRegular,
} from '@fluentui/react-icons'
import OpptrixButton from '../../components/opptrix/OpptrixButton'
import { copyTextToClipboard } from '../../platform/clipboard'
import { latestBoardSnapshotPeriod } from '@opptrix/shared/research-board-snapshot'
import { publishResearchBoardSnapshot } from '../../api/client'
import { buildBoardSnapshotShareUrl } from '../../utils/boardSnapshotDeepLink'
import {
  boardExportFooterLabel,
  exportResearchBoardPng,
  type BoardExportRatio,
} from './boardExport'
import type { Dataset } from './types'

interface Props {
  boardRoot: HTMLElement | null
  boardTitle: string
  sessionId: string | null
  datasets: readonly Dataset[]
  presentMode: boolean
  readonly?: boolean
  onEnterPresent: () => void
  onExitPresent: () => void
  buildPublishPayload: (title: string) => Record<string, unknown>
}

export default function ResearchCanvasToolbar({
  boardRoot,
  boardTitle,
  sessionId,
  datasets,
  presentMode,
  readonly = false,
  onEnterPresent,
  onExitPresent,
  buildPublishPayload,
}: Props) {
  const [busy, setBusy] = useState<'export' | 'publish' | null>(null)
  const [notice, setNotice] = useState('')

  const runExport = async (ratio: BoardExportRatio) => {
    if (!boardRoot || busy) return
    setBusy('export')
    setNotice('')
    try {
      await exportResearchBoardPng({
        boardRoot,
        boardTitle,
        footerText: boardExportFooterLabel(latestBoardSnapshotPeriod(datasets)),
        ratio,
      })
      setNotice(ratio === '16:9' ? '横版图片已下载' : '竖版图片已下载')
    } catch {
      setNotice('导出失败，请稍后再试')
    } finally {
      setBusy(null)
    }
  }

  const runPublish = async () => {
    if (!sessionId || busy || readonly) return
    setBusy('publish')
    setNotice('')
    try {
      const payload = buildPublishPayload(boardTitle)
      const result = await publishResearchBoardSnapshot(sessionId, payload)
      const url = buildBoardSnapshotShareUrl(result.id)
      const copied = await copyTextToClipboard(url)
      setNotice(copied
        ? '已复制本机只读链接，仅当前部署可打开'
        : '发布成功，请手动复制地址栏链接（仅当前部署可打开）')
    } catch {
      setNotice('发布失败，请稍后再试')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={mergeClasses('research-canvas-board-toolbar', 'research-canvas-no-drag')}>
      {!readonly ? (
        <>
          {!presentMode ? (
            <OpptrixButton variant="secondary" size="small" onClick={onEnterPresent}>
              <SlideLayoutRegular /> 演示
            </OpptrixButton>
          ) : (
            <OpptrixButton variant="secondary" size="small" onClick={onExitPresent}>
              <DismissRegular /> 退出演示
            </OpptrixButton>
          )}
          <OpptrixButton
            variant="secondary"
            size="small"
            disabled={!boardRoot || busy != null}
            onClick={() => { void runExport('16:9') }}
          >
            <ArrowExportRegular /> 导出横版
          </OpptrixButton>
          <OpptrixButton
            variant="secondary"
            size="small"
            disabled={!boardRoot || busy != null}
            onClick={() => { void runExport('9:16') }}
          >
            <ArrowExportRegular /> 导出竖版
          </OpptrixButton>
          <OpptrixButton
            variant="secondary"
            size="small"
            disabled={!sessionId || busy != null}
            title="生成本机部署上的只读快照，不是公网分享服务"
            onClick={() => { void runPublish() }}
          >
            <ShareRegular /> 发布
          </OpptrixButton>
        </>
      ) : null}
      {notice ? <span className="research-canvas-board-toolbar__notice">{notice}</span> : null}
      {presentMode && !readonly ? (
        <span className="research-canvas-board-toolbar__hint">按 Esc 退出演示</span>
      ) : null}
    </div>
  )
}
