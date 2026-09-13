import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const REQUIRED = [
  'docs/README.md',
  'docs/ARCHITECTURE.md',
  'docs/SELF-HOSTING.md',
  'docs/DATA-LAYER.md',
  'docs/AGENT-GUIDE.md',
  'CONTRIBUTING.md',
  'packages/README.md',
  'packages/selfhost/README.md',
  'Research Canvas/HANDOFF.md',
]

test('committed docs exist for README links', () => {
  const missing = REQUIRED.filter(rel => !fs.existsSync(path.join(repoRoot, rel)))
  assert.deepEqual(missing, [], missing.join('\n'))
})

test('README documentation table only links to files that exist', () => {
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8')
  const hrefs = [...readme.matchAll(/\]\(([^)]+)\)/g)].map(m => m[1])
  const missing = []
  for (const href of hrefs) {
    if (/^https?:\/\//.test(href)) continue
    const clean = href.split('#')[0].replace(/%20/g, ' ')
    if (!clean) continue
    const target = path.join(repoRoot, clean)
    if (!fs.existsSync(target)) missing.push(href)
  }
  assert.deepEqual(missing, [], missing.join('\n'))
})

test('research-hub does not depend on user-store', () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'packages/research-hub/package.json'), 'utf8'),
  )
  assert.equal(pkg.dependencies['@opptrix/user-store'], undefined)
})

