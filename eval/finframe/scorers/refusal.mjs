/**
 * 评分器 3：该拒绝时拒绝、该澄清时澄清、该回答时不误拒。
 * expect:
 * - answer：须提出至少一个指向有效数据集的预览（不误拒）
 * - answer_with_gap：同上，且正文说明缺失
 * - refuse：正文说明做不到，工具调用不超过 max_calls（防反复重试）；
 *   简报 Demo C 允许给「可查询的替代范围」，所以说明做不到之后出替代预览不算错
 * - clarify：不出预览，调用 ask_user 或正文向用户提问
 */
const REFUSE_RE = /不支持|暂不|无法|没有|未能|不提供|缺少|缺失|不可用|查不到|拿不到|尚未|未披露|暂无|做不到|不能/
const GAP_RE = /缺|空缺|没有|未披露|暂无|—|不可用|未能/
const QUESTION_RE = /[？?]|请(?:确认|选择|告诉|指明|说明)|哪一家|哪家|是指/
const DEFAULT_MAX_CALLS = 4

function validProposals(calls, datasets) {
  const ids = new Set(datasets.map((d) => d.id))
  return calls.filter((c) => c.name === 'propose_widget' && ids.has(String(c.args?.datasetId ?? '')))
}

function judge(expect, ctx) {
  const { calls, reply, proposed, maxCalls } = ctx
  if (expect === 'answer') return proposed ? [] : ['应给出研究预览却没有（误拒或中途停手）']
  if (expect === 'answer_with_gap') {
    return [
      ...(proposed ? [] : ['应给出含缺口的研究预览却没有']),
      ...(GAP_RE.test(reply) ? [] : ['未向用户说明数据缺口']),
    ]
  }
  if (expect === 'refuse') {
    return [
      ...(REFUSE_RE.test(reply) ? [] : [proposed ? '出了预览却未说明所问数据不可用' : '未明确说明做不到/数据不可用']),
      ...(calls.length > maxCalls ? [`工具调用 ${calls.length} 次，超过 ${maxCalls}（反复重试）`] : []),
    ]
  }
  if (expect === 'clarify') {
    const asked = calls.some((c) => c.name === 'ask_user') || QUESTION_RE.test(reply)
    return [
      ...(proposed ? ['歧义未澄清就出了预览'] : []),
      ...(asked ? [] : ['未向用户澄清']),
    ]
  }
  return [`未知 expect ${expect}`]
}

export function scoreRefusal({ evalCase, calls, texts, datasets }) {
  const expect = evalCase?.expect ?? 'answer'
  const reasons = judge(expect, {
    calls,
    reply: texts.join('\n'),
    proposed: validProposals(calls, datasets).length > 0,
    maxCalls: evalCase?.max_calls ?? DEFAULT_MAX_CALLS,
  })
  const alternative = expect === 'refuse' && validProposals(calls, datasets).length > 0
  return { scorer: 'refusal', applicable: true, expect, pass: reasons.length === 0, reasons, ...(alternative ? { alternative_offered: true } : {}) }
}
