import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import type { Plugin } from 'vite'

const require = createRequire(import.meta.url)
const PDFJS_ROOT = path.dirname(require.resolve('pdfjs-dist/package.json'))
const ASSET_DIRS = ['cmaps', 'standard_fonts', 'wasm', 'iccs']
const URL_PREFIX = '/pdfjs/'

const CONTENT_TYPES: Record<string, string> = {
  '.wasm': 'application/wasm',
  '.js': 'text/javascript',
}

function resolveAssetFile(urlPath: string): string | null {
  const parts = decodeURIComponent(urlPath.split('?')[0] ?? '').replace(/^\/+/, '').split('/')
  if (parts.length !== 2) return null
  const [dir, file] = parts
  if (!dir || !file || !ASSET_DIRS.includes(dir) || file.startsWith('.')) return null
  const abs = path.join(PDFJS_ROOT, dir, file)
  return fs.existsSync(abs) ? abs : null
}

/**
 * pdf.js 按目录 URL 拉取 CMap / 标准字体 / 解码器 wasm（中文 CID 字体缺 CMap 时字形画不出来）。
 * 开发期直接读 node_modules；构建时原样拷进 dist/pdfjs/，与已装 pdfjs-dist 版本一致。
 */
export function pdfjsAssets(): Plugin {
  return {
    name: 'finframe-pdfjs-assets',
    configureServer(server) {
      server.middlewares.use(URL_PREFIX, (req, res, next) => {
        const abs = resolveAssetFile(req.url ?? '')
        if (!abs) return next()
        res.setHeader('Content-Type', CONTENT_TYPES[path.extname(abs)] ?? 'application/octet-stream')
        res.setHeader('Cache-Control', 'public, max-age=86400')
        fs.createReadStream(abs).pipe(res)
      })
    },
    generateBundle() {
      for (const dir of ASSET_DIRS) {
        for (const file of fs.readdirSync(path.join(PDFJS_ROOT, dir))) {
          this.emitFile({
            type: 'asset',
            fileName: `pdfjs/${dir}/${file}`,
            source: fs.readFileSync(path.join(PDFJS_ROOT, dir, file)),
          })
        }
      }
    },
  }
}
