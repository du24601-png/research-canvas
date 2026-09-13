import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveUserDataRoot } from '@opptrix/shared'

const LEGACY_AAASHARE_CACHE = path.join(os.homedir(), '.aaashare', 'cache.json')

/** Default persist path: data dir from env or `~/.research-canvas/cache.json`. */
export function resolveDefaultCacheFilePath(): string {
  return path.join(resolveUserDataRoot(), 'cache.json')
}

export function resolveLegacyCacheFilePath(): string {
  return LEGACY_AAASHARE_CACHE
}

function hasIsolatedDataDir(): boolean {
  return Boolean(
    process.env.RESEARCH_CANVAS_DATA_DIR?.trim()
    || process.env.OPPTRIX_DATA_DIR?.trim(),
  )
}

/**
 * Isolated runs (explicit data dir env) never touch the real home cache.
 * Existing dest wins; otherwise seed memory from the old aaashare file.
 */
export function shouldImportLegacyCache(dest: string): boolean {
  if (hasIsolatedDataDir()) return false
  if (fs.existsSync(dest)) return false
  return fs.existsSync(LEGACY_AAASHARE_CACHE)
}
