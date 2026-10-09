/**
 * M4 Composer 评测（插件，不是新 runner）：对产生了数据集的种子题，用生产 composeResearchUi
 * 跑一次真实模型调用，按三项打分：Spec 合规率、组件选择是否符合题目 ui_expect、Spec 里零数值。
 * 数据集覆盖度尽量换成 snapshot-v1 的真实值（Composer 只看元数据，看不到数值）。
 */
import { composeResearchUi } from '../../packages/agent/dist/research-ui-composer.js'
import { joinCompletionsUrl } from '../agent/component/llm-client.mjs'
import { withSnapshotValues } from './snapshot-data.mjs'

export function makeComposerChat(llm) {
  return async (messages) => {
    const resp = await fetch(joinCompletionsUrl(llm.baseUrl), {
      method: 'POST',
      headers: { Authorization: `Bearer ${llm.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: llm.model, messages, temperature: 0, max_tokens: 800 }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!resp.ok) throw new Error(`LLM HTTP ${resp.status}`)
    const data = await resp.json()
    return String(data?.choices?.[0]?.message?.content ?? '')
  }
}

/** Spec 里除 datasetId、年份外不得出现数字 */
export function specNumbers(spec) {
  const text = JSON.stringify(spec ?? {})
    .replace(/research-ds-[\w-]+/g, '')
    .replace(/"version":\s*1/g, '')
    .replace(/(?:19|20)\d{2}/g, '')
  return text.match(/\d+(?:\.\d+)?/g) ?? []
}

function blockComponents(spec) {
  return (spec?.blocks ?? []).map(b => b.component)
}

export function scoreComposer(evalCase, result) {
  const expect = evalCase.ui_expect
  if (!expect) return { scorer: 'composer', applicable: false, pass: null, reasons: [] }
  if (result.error) return { scorer: 'composer', applicable: true, pass: false, valid: false, reasons: [`Spec 不合规或失败：${result.error}`] }
  const components = blockComponents(result.spec)
  const actions = (result.spec.blocks ?? []).flatMap(b => b.actions ?? [])
  const numbers = specNumbers(result.spec)
  const reasons = [
    ...(expect.any_of.some(c => components.includes(c)) ? [] : [`缺少图表组件（应含 ${expect.any_of.join(' / ')}）`]),
    ...(expect.highlight && !actions.includes('highlight_largest_change') ? ['问了变化明显的年份，却没给高亮动作'] : []),
    ...(expect.missing && !components.includes('MissingData') ? ['数据有缺口却没放 MissingData'] : []),
    ...(expect.evidence && !components.includes('EvidencePanel') ? ['没放来源与口径'] : []),
    ...(numbers.length ? [`Spec 里出现数字：${numbers.join(', ')}`] : []),
  ]
  return { scorer: 'composer', applicable: true, pass: reasons.length === 0, valid: true, components, numbers: numbers.length, reasons }
}

export async function runComposerForCase(evalCase, datasets, chat) {
  if (!evalCase.ui_expect || !datasets.length) return null
  const swapped = datasets.map(withSnapshotValues)
  const started = Date.now()
  const result = await composeResearchUi({ task: evalCase.task, datasets: swapped.map(s => s.dataset), chat })
  return {
    ...result,
    snapshot_hits: swapped.reduce((n, s) => n + s.hits, 0),
    duration_ms: Date.now() - started,
    score: scoreComposer(evalCase, result),
  }
}
