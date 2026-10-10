import { makeStyles } from '@fluentui/react-components'
import type { ResearchUiBlock } from '@opptrix/shared/research-ui-spec'
import { opptrixCssVars } from '../theme/tokens'
import { SentenceContent } from './CitationChip'
import { sentenceParts } from './numberText'
import type { BlockProps } from './types'

type SentenceBlock = Extract<ResearchUiBlock, { component: 'NumberSentence' }>

const useStyles = makeStyles({
  sentence: { margin: '4px 0 12px', fontSize: '19px', lineHeight: 1.7, color: opptrixCssVars.textPrimary },
})

/** 一句结论：文字来自模板，每个数字是代码从 Dataset 取/算的引用 chip，悬停或聚焦看来源 */
export default function NumberSentence({ block, getDataset }: BlockProps<SentenceBlock>) {
  const s = useStyles()
  const dataset = getDataset(block.datasetId)
  if (!dataset) return null
  return (
    <p className={s.sentence} data-generative-ui-block="NumberSentence">
      <SentenceContent parts={sentenceParts(dataset, block.template)} />
    </p>
  )
}
