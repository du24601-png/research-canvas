import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))

export const SKIP_CASE_IDS = []

const FIXED_SOURCE_FILES = [
  'manifest.json',
  'schema.json',
  'prompt.mjs',
  'judge.mjs',
  'match-chain.mjs',
  'constraints.mjs',
  'fixtures.mjs',
  'fixture-data.mjs',
  'loop.mjs',
]

export async function listPlanningSourceFiles() {
  const manifest = JSON.parse(await readFile(path.join(DIR, 'manifest.json'), 'utf8'))
  return [...FIXED_SOURCE_FILES, ...manifest.cases.map((rel) => path.basename(rel))]
}

export async function loadPlanningCases(opts = {}) {
  const skip = new Set(opts.skipIds ?? SKIP_CASE_IDS)
  const manifest = JSON.parse(await readFile(path.join(DIR, 'manifest.json'), 'utf8'))
  const cases = []
  for (const rel of manifest.cases) {
    const pack = JSON.parse(await readFile(path.join(DIR, path.basename(rel)), 'utf8'))
    for (const item of pack.cases) {
      if (skip.has(item.id)) continue
      if (opts.caseIds && !opts.caseIds.includes(item.id)) continue
      cases.push(item)
    }
  }
  return cases
}
