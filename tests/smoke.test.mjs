import assert from 'node:assert/strict'
import test from 'node:test'
import { ToolRegistry } from '../packages/agent/dist/tools.js'

test('ToolRegistry exposes OpenAI function schemas', () => {
  const tools = new ToolRegistry({ dispatch: async () => ({ success: true, data: {}, message: '', elapsed: 0 }) })
  const openAi = tools.openAiTools()
  assert.ok(openAi.length >= 30, `expected >=30 tools, got ${openAi.length}`)
  for (const t of openAi) {
    assert.equal(t.type, 'function')
    assert.ok(t.function.name)
    assert.ok(t.function.parameters?.type === 'object')
  }
})
