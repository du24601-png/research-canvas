/**
 * M5 研究者任务测试（没有真实用户）：Demo A/B/C 的脚本，以及「达成目标所需用户操作数」的计法。
 * 操作只数用户必须做的：发一句话 = 1，点一次按钮 = 1。界面怎么摆由条件决定：
 * - C1 旧双栏 / C2 对话优先 + 固定预览卡：每张预览卡单独「添加到画布 / 钉住」
 * - C3 对话优先 + 活报告：一个 ComparisonView 一次钉住它的全部数据集；Spec 不合规则回退到 C2 的算法
 */
export const CONDITIONS = {
  C1: { label: '旧双栏画布（开关关）', body: { canvas_edit: true } },
  C2: { label: '对话优先 + 固定预览卡（Composer 关）', body: {} },
  C3: { label: '对话优先 + 活报告（Composer 开）', body: { ui_composer: true } },
}

/** 每个 Demo：若干轮；reply(turn) 决定是否需要用户补一句（如澄清） */
export const DEMOS = {
  A: {
    goal: '看到两家公司近五年净利率与 ROE 的对比，并把结果留在看板 / 画布上；找出变化最大的年份',
    turns: [{ text: '对比贵州茅台和五粮液最近五个已披露完整财年的净利率与 ROE。' }],
    wantsLargestChange: true,
  },
  B: {
    goal: '在 Demo A 基础上只看近三年，并得到「为什么一家变化更明显」的数据与待核验原因',
    turns: [
      { text: '对比贵州茅台和五粮液最近五个已披露完整财年的净利率与 ROE。' },
      { text: '只看近三年，为什么其中一家的净利率变化比另一家更明显？' },
    ],
  },
  C: {
    goal: '歧义简称「平安」不被猜错；澄清后看到对应公司的 ROE；不出现错误数值',
    turns: [{ text: '看一下平安近五年的 ROE' }],
    clarify: { when: /[？?]|哪一家|哪家|是指|请确认|选择/, text: '中国平安' },
  },
}

function proposals(steps) {
  return steps.filter(s => s.tool === 'propose_widget' && s.status === 'done')
}

/** C3 Spec 里覆盖所有图表数据集所需的最少钉住次数（贪心：先挑覆盖最多的组件） */
export function minPinsForSpec(spec) {
  const blocks = (spec?.blocks ?? []).filter(b => b.component === 'ComparisonView' || b.component === 'TrendView')
  const need = new Set(blocks.flatMap(b => b.datasetIds ?? [b.datasetId]))
  let pins = 0
  while (need.size) {
    const best = blocks.map(b => (b.datasetIds ?? [b.datasetId]).filter(id => need.has(id))).sort((a, b) => b.length - a.length)[0]
    if (!best?.length) break
    for (const id of best) need.delete(id)
    pins += 1
  }
  return pins
}

/** 一轮回答后，达成「结果留在看板」所需点击数 */
export function pinActions(turn, condition) {
  if (condition === 'C3' && turn.spec) return minPinsForSpec(turn.spec)
  return proposals(turn.steps).length
}

/** Demo A 的「变化最大的年份」：C3 Spec 带高亮动作 = 点 1 次；否则要再发一句话 */
export function largestChangeActions(turn, condition) {
  const hasHighlight = condition === 'C3' && (turn.spec?.blocks ?? []).some(b => (b.actions ?? []).includes('highlight_largest_change'))
  return { actions: 1, kind: hasHighlight ? 'click' : 'message', needsAgentTurn: !hasHighlight }
}
