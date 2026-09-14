/**
 * 规划评测集：24 题、id 连续、约束类型合法、与 manifest 计数一致。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listPlanningSourceFiles, loadPlanningCases } from '../eval/agent/planning/load-cases.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'eval', 'agent', 'planning')

async function readJson(file) {
  return JSON.parse(await readFile(path.join(DIR, file), 'utf8'))
}

test('planning eval dataset is well-formed', async () => {
  const manifest = await readJson('manifest.json')
  const catalog = JSON.parse(await readFile(path.join(DIR, '..', 'component', 'tool-catalog.json'), 'utf8'))
  const names = new Set(catalog.tools.map((t) => t.name))
  assert.equal(manifest.counts.total, 24)
  const seen = new Set()
  const byFamily = {}
  for (const rel of manifest.cases) {
    const pack = await readJson(path.basename(rel))
    for (const c of pack.cases) {
      assert.ok(c.id && !seen.has(c.id), c.id)
      seen.add(c.id)
      byFamily[c.family] = (byFamily[c.family] ?? 0) + 1
      assert.equal(c.toolset, 'component_v1')
      assert.ok(c.task.trim().length > 0, c.id)
      assert.ok(Array.isArray(c.gold.chain), c.id)
      assert.ok(Number.isInteger(c.gold.max_decisions), c.id)
      for (const step of c.gold.chain) {
        assert.ok(names.has(step.name), `${c.id} unknown chain tool ${step.name}`)
      }
      for (const n of c.gold.optional ?? []) assert.ok(names.has(n), `${c.id} optional ${n}`)
      for (const cons of c.constraints) {
        assert.ok(['forbid_tool', 'forbid_args', 'forbid_tool_until'].includes(cons.type), c.id)
        for (const t of cons.tools ?? []) assert.ok(names.has(t), `${c.id} ${cons.id} ${t}`)
        if (cons.name) assert.ok(names.has(cons.name), `${c.id} ${cons.name}`)
        if (cons.until) assert.ok(names.has(cons.until), `${c.id} ${cons.until}`)
      }
    }
  }
  assert.equal(seen.size, 24)
  for (const [family, count] of Object.entries(manifest.counts)) {
    if (family === 'total') continue
    assert.equal(byFamily[family], count, family)
  }
  for (let i = 1; i <= 24; i += 1) {
    assert.ok(seen.has(`pl-${String(i).padStart(3, '0')}`))
  }
  const loaded = await loadPlanningCases()
  assert.equal(loaded.length, 24)
  const sources = await listPlanningSourceFiles()
  for (const rel of manifest.cases) assert.ok(sources.includes(path.basename(rel)))
})
