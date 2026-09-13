#!/usr/bin/env node
/**
 * Fast gate: research canvas + branding + data-root + hub disk cache.
 * Full suite remains `npm run test:ci`.
 */
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const GATE = [
  'tests/research-canvas-tools.test.mjs',
  'tests/research-query-data.test.mjs',
  'tests/research-refine-dataset.test.mjs',
  'tests/mcp-tool-route-accuracy.test.mjs',
  'tests/session-artifacts-opt-in.test.mjs',
  'tests/session-tools-freeze.test.mjs',
  'tests/user-data-root.test.mjs',
  'tests/repo-branding.test.mjs',
  'tests/branding-surface.test.mjs',
  'tests/committed-docs.test.mjs',
  'tests/market-dynamics-cache.test.mjs',
  'tests/right-panel-cache.test.mjs',
]

const stripTypes = new Set([
  'branding-surface.test.mjs',
  'repo-branding.test.mjs',
])

const failures = []
for (const file of GATE) {
  const label = path.basename(file)
  const nodeArgs = ['--test', '--test-force-exit', file]
  if (stripTypes.has(label)) nodeArgs.unshift('--experimental-strip-types')
  const result = spawnSync(process.execPath, nodeArgs, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    timeout: 90_000,
    killSignal: 'SIGKILL',
    env: process.env,
  })
  if (result.status !== 0) {
    failures.push(label)
    console.error(`\n[test:gate] FAIL ${label}\n`)
  }
}

if (failures.length) {
  console.error('[test:gate] failures:')
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log(`[test:gate] ${GATE.length} files passed`)
