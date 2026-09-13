import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 审阅者常看的入口文件 — 不应出现 Opptrix 产品品牌 */
const REVIEWER_ENTRY_FILES = [
  'README.md',
  'SECURITY.md',
  'package.json',
  '.env.example',
  'client-ui/package.json',
  'client-ui/index.html',
  'client-ui/public/manifest.webmanifest',
  'packages/shared/src/product-brand.ts',
  'client-ui/src/pages/settings/aboutLinks.ts',
]

const ALLOW = [
  /@opptrix\//,
  /--opptrix-/,
  /OPPTRIX_/,
  /opptrix-theme-preference/,
  /research-canvas-client/,
  /selfhost/,
  /pack-opptrix-runtime/,
  /@opptrix\/selfhost/,
  /github\.com\/Travisun\/Opptrix/,
]

test('reviewer entry files do not expose Opptrix product brand', () => {
  const leaks = []
  for (const rel of REVIEWER_ENTRY_FILES) {
    const file = path.join(repoRoot, rel)
    const raw = fs.readFileSync(file, 'utf8')
    for (const [i, line] of raw.split(/\r?\n/).entries()) {
      if (!/\bOpptrix\b/i.test(line)) continue
      if (ALLOW.some(re => re.test(line))) continue
      leaks.push(`${rel}:${i + 1}: ${line.trim()}`)
    }
  }
  assert.deepEqual(leaks, [], leaks.join('\n'))
})

test('Research Canvas handoff does not describe itself as an Opptrix fork', () => {
  const handoff = fs.readFileSync(path.join(repoRoot, 'Research Canvas/HANDOFF.md'), 'utf8')
  assert.doesNotMatch(handoff, /fork\s+Opptrix/i)
  assert.doesNotMatch(handoff, /个人 fork/i)
  assert.doesNotMatch(handoff, /魔改/)
})
