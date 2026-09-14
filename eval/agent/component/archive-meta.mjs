import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export function readGitMeta(cwd) {
  const sha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' })
  const dirty = spawnSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' })
  return {
    commit: sha.status === 0 ? sha.stdout.trim() : '',
    dirty: dirty.status === 0 ? dirty.stdout.trim().length > 0 : null,
  }
}

export async function hashEvalSources(dir, relativePaths) {
  const hashes = {}
  for (const rel of relativePaths) {
    const raw = await readFile(path.join(dir, rel), 'utf8')
    hashes[rel] = createHash('sha256').update(raw).digest('hex').slice(0, 16)
  }
  return hashes
}
