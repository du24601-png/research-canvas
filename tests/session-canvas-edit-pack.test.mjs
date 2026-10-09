/**
 * M2 follow-up：旧双栏布局（对话优先关闭）自动加载 research_canvas_edit；对话优先布局不加载；
 * 勾选 artifacts 不会连带打开改画布三件套（E4 之后 allToolPackIds 的漏洞）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveFullSessionPackIds, resolveFullSessionToolNames } from '../packages/agent/dist/mcp/session-frozen-tools.js'
import { buildAgentSystemRules } from '../packages/shared/dist/index.js'

const EDIT = ['create_widget', 'update_widget', 'delete_widget']

test('chat-first default: no edit tools, no artifacts', () => {
  const packs = resolveFullSessionPackIds({})
  assert.equal(packs.includes('research_canvas_edit'), false)
  assert.equal(packs.includes('artifacts'), false)
  const names = resolveFullSessionToolNames({})
  for (const t of EDIT) assert.equal(names.includes(t), false, t)
})

test('artifacts on does not bring the edit tools along', () => {
  const packs = resolveFullSessionPackIds({ artifactsEnabled: true })
  assert.ok(packs.includes('artifacts'))
  assert.equal(packs.includes('research_canvas_edit'), false)
})

test('old two-column layout (canvasEdit) loads the edit pack and its prompt rules', () => {
  const packs = resolveFullSessionPackIds({ canvasEdit: true })
  assert.ok(packs.includes('research_canvas_edit'))
  const names = resolveFullSessionToolNames({ canvasEdit: true })
  for (const t of EDIT) assert.ok(names.includes(t), t)
  const rules = buildAgentSystemRules({ activePacks: packs })
  assert.match(rules, /右侧已有组件改图种或标题 → update_widget/)
  const pinOnly = buildAgentSystemRules({ activePacks: resolveFullSessionPackIds({}) })
  assert.doesNotMatch(pinOnly, /create_widget|update_widget|delete_widget/)
})
