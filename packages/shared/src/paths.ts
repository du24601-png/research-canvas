import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const USER_DATA_ROOT_DIRNAME = 'research-canvas'
export const LEGACY_USER_DATA_ROOT_DIRNAME = 'opptrix'

export function resolveUserDataHomeDir(): string {
  return os.homedir()
}

export function resolveDefaultUserDataRoot(): string {
  return path.join(resolveUserDataHomeDir(), `.${USER_DATA_ROOT_DIRNAME}`)
}

export function resolveLegacyUserDataRoot(): string {
  return path.join(resolveUserDataHomeDir(), `.${LEGACY_USER_DATA_ROOT_DIRNAME}`)
}

/** Explicit data dir from env — `RESEARCH_CANVAS_DATA_DIR` wins over `OPPTRIX_DATA_DIR`. */
export function resolveUserDataDirFromEnv(): string | undefined {
  const fromNew = process.env.RESEARCH_CANVAS_DATA_DIR?.trim()
  const fromLegacy = process.env.OPPTRIX_DATA_DIR?.trim()
  const chosen = fromNew || fromLegacy
  return chosen ? path.resolve(chosen) : undefined
}

/**
 * User data root.
 * Env overrides; else legacy `~/.opptrix` when present (upgrade safety);
 * else `~/.research-canvas` for fresh installs.
 */
export function resolveUserDataRoot(): string {
  const fromEnv = resolveUserDataDirFromEnv()
  if (fromEnv) return fromEnv
  const legacyRoot = resolveLegacyUserDataRoot()
  const newRoot = resolveDefaultUserDataRoot()
  if (fs.existsSync(legacyRoot)) return legacyRoot
  if (fs.existsSync(newRoot)) return newRoot
  return newRoot
}

/** Installed provider plugins */
export function resolveProvidersDir(): string {
  return path.join(resolveUserDataRoot(), 'providers')
}

/** 托管 Python 运行时根目录 */
export function resolvePythonRuntimeRoot(): string {
  return path.join(resolveUserDataRoot(), 'runtimes', 'python')
}

/** 扩展平台：插件私有数据根 */
export function resolvePluginDataRoot(): string {
  return path.join(resolveUserDataRoot(), 'plugin-data')
}

/** 单个扩展的数据目录 */
export function resolvePluginDataDir(pluginId: string): string {
  const safe = pluginId.trim().replace(/[^a-zA-Z0-9._-]/g, '_')
  if (!safe) {
    throw new Error('invalid plugin id')
  }
  // `.` / `..` survive the character allowlist — they would resolve to the
  // plugin-data root itself or its parent (user data root), letting an
  // uninstall recurse-delete far beyond one extension's directory.
  if (safe === '.' || safe === '..' || safe.startsWith('..') || safe.includes('/')) {
    throw new Error('invalid plugin id')
  }
  return path.join(resolvePluginDataRoot(), safe)
}

/** 已安装扩展目录 */
export function resolveExtensionsDir(): string {
  return path.join(resolveUserDataRoot(), 'extensions')
}

export function isDesktopRuntime(): boolean {
  return process.env.OPPTRIX_DESKTOP === '1' || process.env.RESEARCH_CANVAS_DESKTOP === '1'
}

/** 向上查找 monorepo 根目录（含 workspaces 的 package.json） */
export function resolveProjectRoot(start = process.cwd()): string {
  let dir = path.resolve(start)
  for (let i = 0; i < 10; i++) {
    const pkgPath = path.join(dir, 'package.json')
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { name?: string; workspaces?: unknown }
        if (pkg.name === 'research-canvas' || pkg.name === 'opptrix' || pkg.workspaces) return dir
      } catch { /* continue */ }
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}

/**
 * 产品版本（Agent / health / get_project_info）。
 * 优先 `RESEARCH_CANVAS_APP_VERSION` / `OPPTRIX_APP_VERSION`；否则读 monorepo package.json。
 */
export function resolveOpptrixAppVersion(): string {
  const fromEnv = (
    process.env.RESEARCH_CANVAS_APP_VERSION?.trim()
    || process.env.OPPTRIX_APP_VERSION?.trim()
  )
  if (fromEnv) return fromEnv

  try {
    for (const rel of ['apps/server/package.json', 'package.json']) {
      const pkgPath = path.join(resolveProjectRoot(), ...rel.split('/'))
      if (!fs.existsSync(pkgPath)) continue
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: unknown }
      if (typeof pkg.version === 'string') {
        const v = pkg.version.trim()
        if (v) return v
      }
    }
  } catch {
    /* fall through */
  }
  return 'unknown'
}
