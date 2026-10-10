import { useCallback, type ReactNode } from 'react'
import { makeStyles, Text } from '@fluentui/react-components'
import type { ResearchUiBlock } from '@opptrix/shared/research-ui-spec'
import OpptrixButton from '../../components/opptrix/OpptrixButton'
import type { Dataset } from '../../chat/research-canvas/types'
import { opptrixCssVars } from '../../theme/tokens'
import type { ReportFollowupValue } from './ReportFollowupContext'
import ReportVersionSwitcher from './ReportVersionSwitcher'
import { describeBlockForQuote, followupOrigin } from './reportVersions'

const useStyles = makeStyles({
  origin: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', margin: '4px 0' },
  note: { fontSize: 'var(--opptrix-font-md)', color: opptrixCssVars.textSecondary },
})

/** 报告追问开启时的一轮回答：组件可追问；有追问时显示版本切换与并排对比；追问的回答标明它是哪段报告的第几版 */
export default function ReportFollowupTurn({ followup, turnIndex, datasets, children }: {
  followup: ReportFollowupValue
  turnIndex: number
  datasets: readonly Dataset[]
  children: ReactNode
}) {
  const s = useStyles()
  const { messages, versions, quote, scrollTo } = followup
  const origin = followupOrigin(versions, turnIndex)
  const stepsOf = useCallback((index: number) => messages[index]?.toolSteps ?? [], [messages])
  const onFollowup = useCallback((block: ResearchUiBlock, getDataset: (id: string) => Dataset | undefined) => {
    quote({ text: describeBlockForQuote(block, getDataset), messageIndex: turnIndex, messageRole: 'assistant' })
  }, [quote, turnIndex])
  return (
    <>
      {origin ? (
        <div className={s.origin} data-report-followup-origin={origin.version}>
          <Text className={s.note}>这次追问的结果已记为上方报告的 v{origin.version}，原来的版本仍保留。</Text>
          <OpptrixButton variant="ghost" size="small" onClick={() => scrollTo(origin.sourceIndex)}>回到那段报告</OpptrixButton>
        </div>
      ) : null}
      <ReportVersionSwitcher
        versions={versions.get(turnIndex) ?? [{ version: 1, messageIndex: turnIndex }]}
        stepsOf={stepsOf}
        datasets={datasets}
        fallback={children}
        onFollowup={onFollowup}
      />
    </>
  )
}
