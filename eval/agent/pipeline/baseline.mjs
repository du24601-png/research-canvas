import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

function resolvePath(dir, name) {
  return path.resolve(dir, name)
}

export async function findLatestOfficial(recordsDir, layer, opts = {}) {
  const exclude = new Set((opts.excludePaths ?? []).map((p) => path.resolve(p)))
  const names = await readdir(recordsDir)
  const candidates = []
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    const filePath = resolvePath(recordsDir, name)
    if (exclude.has(filePath)) continue
    let rec
    try {
      rec = JSON.parse(await readFile(filePath, 'utf8'))
    } catch {
      continue
    }
    if (rec?.kind !== 'official') continue
    if (rec.layer !== layer) continue
    candidates.push({ path: filePath, at: rec.at ?? '', record: rec })
  }
  candidates.sort((a, b) => String(b.at).localeCompare(String(a.at)))
  return candidates[0] ?? null
}

export async function loadLayerBaselines(recordsDir, excludePaths = {}) {
  const layers = ['component', 'planning', 'prompt']
  const out = {}
  for (const layer of layers) {
    const hit = await findLatestOfficial(recordsDir, layer, {
      excludePaths: excludePaths[layer] ? [excludePaths[layer]] : [],
    })
    out[layer] = hit?.record ?? null
  }
  return out
}

export function emptyBaselines() {
  return { component: null, planning: null, prompt: null }
}
