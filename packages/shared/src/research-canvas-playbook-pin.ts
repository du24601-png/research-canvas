/**
 * M2-E4：create_widget / update_widget / delete_widget 移到可选包 research_canvas_edit（默认不加载）。
 * 未加载时，研究画布 playbook 去掉这三个工具的规则与顺带提及，改为「看板只由用户操作」一条。
 */
const EDIT_TOOL_RE = /create_widget|update_widget|delete_widget/

/** 整条只为编辑工具服务的规则：未加载编辑包时删除 */
const EDIT_ONLY_LINE = /^- (右侧已有组件改图种|仅当用户明确说「直接加入右侧|仅当用户明确要求改右侧已有图|delete_widget 按 id 删除)/

export const PIN_ONLY_RULE =
  '- 看板里的图只由用户操作：用户要把预览加入看板 → 告诉他点预览上的「钉住」；要改看板里已有图的图种或范围 → 重新 propose_widget 一张新预览供他钉住，或请他在看板里切换视图；不要声称已经替他改好'

function stripMentions(line: string): string {
  return line
    .replace(/ \/ create_widget \/ update_widget \/ delete_widget/, '')
    .replace(/；不要 create_widget 偷偷写入右侧，不要 update_widget \/ delete_widget/, '')
    .replace(/[，；]\s*不要 update_widget/g, '')
    .replace('propose_widget / create_widget 传', 'propose_widget 传')
}

/** widgetEditing=false：删去编辑类规则、去掉顺带提及，并补一条「钉住」规则 */
export function adaptCanvasPlaybookLines(lines: readonly string[], widgetEditing: boolean): string[] {
  if (widgetEditing) return [...lines]
  const out = lines.filter(line => !EDIT_ONLY_LINE.test(line)).map(stripMentions)
  const leftover = out.filter(line => EDIT_TOOL_RE.test(line))
  if (leftover.length) throw new Error(`playbook 仍提及编辑工具：${leftover[0]}`)
  return [...out, PIN_ONLY_RULE]
}

/** 证据纪律里「加入右侧 / 改成折线 / 删图 → 三件套」那一句：未加载编辑包时改为「钉住」 */
const EPISTEMIC_EDIT_CLAUSE = /；「直接加入右侧[^；]*?delete_widget/

export function pinOnlyEpistemicLines(lines: readonly string[], widgetEditing: boolean): string[] {
  if (widgetEditing) return [...lines]
  return lines.map(line => line.replace(EPISTEMIC_EDIT_CLAUSE, '；「放进看板 / 加到画布」→ 告诉用户点预览上的「钉住」，看板里的图由用户自己切换或删除'))
}
