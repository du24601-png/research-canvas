/**
 * artifacts pack 默认不进会话 tools；仅用户勾选后加载。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  defaultSessionPackIds,
  optInPackIds,
  isOptInToolPack,
} from '../packages/shared/dist/index.js'
import {
  resolveFullSessionPackIds,
  resolveFullSessionToolNames,
  ToolPackSessionStore,
  resolveActivePackIds,
  unloadedToolHint,
  resolveSeedPacks,
  resolveToolRoutePlan,
  buildRoundRoutePlaybook,
} from '../packages/agent/dist/index.js'

test('artifacts is the only opt-in pack', () => {
  assert.deepEqual(optInPackIds(), ['artifacts'])
  assert.equal(isOptInToolPack('artifacts'), true)
  assert.equal(isOptInToolPack('news'), false)
  assert.equal(defaultSessionPackIds().includes('artifacts'), false)
})

test('default frozen packs exclude artifacts tools', () => {
  const packs = resolveFullSessionPackIds()
  assert.equal(packs.includes('artifacts'), false)
  const names = resolveFullSessionToolNames()
  assert.equal(names.includes('create_canvas'), false)
  assert.equal(names.includes('create_mindmap'), false)
  assert.equal(names.includes('create_web'), false)
  assert.ok(names.includes('propose_widget'))
})

test('enabled frozen packs include artifacts tools', () => {
  const packs = resolveFullSessionPackIds({ artifactsEnabled: true })
  assert.ok(packs.includes('artifacts'))
  const names = resolveFullSessionToolNames({ artifactsEnabled: true })
  assert.ok(names.includes('create_canvas'))
  assert.ok(names.includes('create_mindmap'))
  assert.ok(names.includes('create_web'))
})

test('message heuristics do not seed artifacts', () => {
  assert.equal(resolveSeedPacks({ message: '画个脑图梳理产业链' }).includes('artifacts'), false)
  assert.equal(resolveSeedPacks({ message: '做一份可视化报告' }).includes('artifacts'), false)
  const store = new ToolPackSessionStore()
  const packs = resolveActivePackIds(store, 'opt-in-1', { message: '画个思维导图' })
  assert.equal(packs.includes('artifacts'), false)
})

test('store.activate skips artifacts unless allowOptIn', () => {
  const store = new ToolPackSessionStore()
  const blocked = store.activate('s1', ['artifacts', 'news'])
  assert.ok(blocked.activated.includes('news'))
  assert.ok(blocked.skipped.includes('artifacts'))
  assert.equal(store.getActivated('s1').has('artifacts'), false)
  store.activate('s1', ['artifacts'], { allowOptIn: true })
  assert.ok(store.getActivated('s1').has('artifacts'))
  store.deactivate('s1', ['artifacts'])
  assert.equal(store.getActivated('s1').has('artifacts'), false)
})

test('unloaded artifacts tools tell user to use plus menu', () => {
  const hint = unloadedToolHint('create_canvas')
  assert.match(hint, /报告与脑图/)
  assert.match(hint, /加号/)
  assert.doesNotMatch(hint, /请先调用 activate_tool_pack/)
})

test('route playbook forbids artifacts tools when they are missing', () => {
  const plan = resolveToolRoutePlan({ message: '做一份可视化报告' })
  assert.equal(plan.intent, 'create_canvas')
  const card = buildRoundRoutePlaybook(plan, ['query_data', 'propose_widget'])
  assert.match(card, /报告与脑图/)
  assert.match(card, /禁止 activate_tool_pack 加载 artifacts/)
  assert.doesNotMatch(card, /首选调用顺序：create_canvas/)
})

test('opt-in freeze exposes artifacts primaries', () => {
  const names = resolveFullSessionToolNames({ artifactsEnabled: true })
  assert.ok(names.includes('create_canvas'))
  assert.ok(names.includes('create_mindmap'))
  assert.ok(names.includes('create_web'))
  const card = buildRoundRoutePlaybook(
    resolveToolRoutePlan({ message: '做一份可视化报告' }),
    names,
  )
  assert.match(card, /首选调用顺序：create_canvas/)
})
