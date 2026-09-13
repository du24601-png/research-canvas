import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const pkgRoot = path.join(scriptDir, '..')
const src = path.join(pkgRoot, 'src', 'providers', 'akshare', 'worker', 'fetch.py')
const destDir = path.join(pkgRoot, 'dist', 'providers', 'akshare', 'worker')
const dest = path.join(destDir, 'fetch.py')

if (!fs.existsSync(src)) {
  console.error('[copy-akshare-worker] missing source:', src)
  process.exit(1)
}

fs.mkdirSync(destDir, { recursive: true })
fs.copyFileSync(src, dest)
console.log('[copy-akshare-worker] copied to', dest)
