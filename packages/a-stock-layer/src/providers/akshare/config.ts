import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePythonRuntimeRoot } from '@opptrix/shared'
import { aksharePythonPathFromSettings } from './settings.js'

const PROXY_KEYS = [
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'http_proxy',
  'https_proxy',
  'all_proxy',
] as const

/** 侧车进程环境 — 清除易破坏 TLS 的本地代理变量 */
export function akshareSidecarEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const key of PROXY_KEYS) delete env[key]
  env.NO_PROXY = '*'
  return env
}

function managedPythonCandidates(): string[] {
  const root = resolvePythonRuntimeRoot()
  const isWin = process.platform === 'win32'
  return [
    path.join(root, 'current', isWin ? 'python.exe' : 'bin/python3'),
    path.join(root, 'current', 'python.exe'),
    path.join(root, 'current', 'python3'),
  ]
}

/** Python 可执行文件：设置 → 环境变量 → 托管运行时 → 系统 PATH */
export function resolveAksharePython(): string {
  const fromSettings = aksharePythonPathFromSettings()
  if (fromSettings) return fromSettings
  const fromEnv = process.env.OPPTRIX_PYTHON_PATH?.trim()
    || process.env.OPPTRIX_PYTHON?.trim()
  if (fromEnv) return fromEnv
  for (const candidate of managedPythonCandidates()) {
    if (fs.existsSync(candidate)) return candidate
  }
  return process.platform === 'win32' ? 'python' : 'python3'
}

/** fetch.py 绝对路径（dev / dist 均可解析） */
export function akshareWorkerScriptPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.join(here, 'worker', 'fetch.py'),
    path.join(here, '..', 'worker', 'fetch.py'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return candidates[0]
}
