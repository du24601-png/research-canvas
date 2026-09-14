/**
 * 校验 Agent 组件评测测试集：可解析、id 唯一、工具名落在 catalog、计数与 manifest 一致。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listEvalSourceFiles } from '../eval/agent/component/load-cases.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'eval', 'agent', 'component')

async function readJson(file) {
  return JSON.parse(await readFile(path.join(DIR, file), 'utf8'))
}

test('component eval dataset is well-formed', async () => {
  const manifest = await readJson('manifest.json')
  const catalog = await readJson('tool-catalog.json')
  const names = new Set(catalog.tools.map((t) => t.name))
  assert.equal(catalog.id, manifest.default_toolset)
  assert.equal(catalog.tools.length, 16)

  const seen = new Set()
  const byFamily = {}
  let total = 0
  for (const rel of manifest.cases) {
    const pack = await readJson(path.basename(rel))
    assert.ok(Array.isArray(pack.cases) && pack.cases.length > 0, rel)
    for (const c of pack.cases) {
      total += 1
      assert.ok(c.id && !seen.has(c.id), `duplicate or missing id: ${c.id}`)
      seen.add(c.id)
      byFamily[c.family] = (byFamily[c.family] ?? 0) + 1
      assert.equal(c.toolset, 'component_v1')
      assert.ok(c.question.trim().length > 0, c.id)
      assert.ok(['must_call', 'must_not_call'].includes(c.gold.call_policy), c.id)
      if (c.gold.call_policy === 'must_not_call') {
        assert.equal(c.gold.expected.length, 0, c.id)
        assert.equal(c.gold.max_calls, 0, c.id)
        assert.equal(c.gold.tushare_via, 'none', c.id)
      } else {
        assert.ok(c.gold.expected.some((e) => e.required !== false), c.id)
        for (const e of c.gold.expected) {
          assert.ok(names.has(e.name), `${c.id} unknown expected tool ${e.name}`)
        }
      }
      for (const n of c.gold.forbidden ?? []) {
        if (n !== '*') assert.ok(names.has(n), `${c.id} unknown forbidden ${n}`)
      }
    }
  }

  assert.equal(total, 100)
  assert.equal(total, manifest.counts.total)
  assert.equal(byFamily.tushare_query_canvas, manifest.counts.query_canvas)
  assert.equal(byFamily.no_tool, manifest.counts.negative_no_tool)
  assert.equal(
    (byFamily.tushare_query_quotes ?? 0) + (byFamily.tushare_query_profile ?? 0),
    manifest.counts.query_quotes_profile,
  )
  assert.equal(byFamily.tushare_query_gate, manifest.counts.query_gates)
  assert.ok(manifest.counts.negative_ratio >= 0.25)
  for (const [prefix, max] of [['qc', 32], ['qq', 21], ['qg', 16], ['ng', 31]]) {
    for (let i = 1; i <= max; i += 1) {
      const id = `${prefix}-${String(i).padStart(3, '0')}`
      assert.ok(seen.has(id), `missing ${id}`)
    }
  }
  const sources = await listEvalSourceFiles()
  for (const rel of manifest.cases) {
    assert.ok(sources.includes(path.basename(rel)), rel)
  }
})
