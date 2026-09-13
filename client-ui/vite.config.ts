import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const brandIconsDir = path.join(repoRoot, 'icons')
const clientPkg = JSON.parse(
  readFileSync(path.join(__dirname, 'package.json'), 'utf8'),
) as { version?: string }

const API_TARGET = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8711'
const WEB_PORT = Number(process.env.WEB_PORT ?? 5173)
/** 默认仅本机；设 WEB_HOST=0.0.0.0 可局域网访问 */
const WEB_HOST = process.env.WEB_HOST ?? '127.0.0.1'
/** 开发服务器默认 HTTPS（自签名）；设 WEB_HTTPS=0 可回退 HTTP */
const WEB_HTTPS = process.env.WEB_HTTPS !== '0'
/** React Compiler（组件自动 memo 化）；设 OPPTRIX_REACT_COMPILER=0 可整体回退 */
const ENABLE_REACT_COMPILER = process.env.OPPTRIX_REACT_COMPILER !== '0'

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ENABLE_REACT_COMPILER ? [['babel-plugin-react-compiler', {}]] : [],
      },
    }),
    ...(WEB_HTTPS ? [basicSsl()] : []),
  ],
  base: '/',
  resolve: {
    alias: {
      /** Repo brand PNGs (`icons/logo@*.png`) — single source for UI chrome marks. */
      '@opptrix-icons': brandIconsDir,
    },
  },
  define: {
    __OPPTRIX_CLIENT_VERSION__: JSON.stringify(clientPkg.version ?? ''),
  },
  optimizeDeps: {
    include: [
      'react-markdown',
      'remark-gfm',
      'remark-math',
      'rehype-katex',
      'rehype-raw',
      'rehype-sanitize',
      'katex',
      'mermaid',
      'pdfjs-dist',
    ],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        /**
         * 静态重库分包。只对确定「静态导入」的大依赖建 chunk；
         * 其余一律返回 undefined 交还 Rollup 默认策略——
         * 动态依赖（mermaid/pdfjs/katex/qrcode 等）必须保持按需加载，不可拽入静态 chunk。
         */
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@fluentui')) return 'vendor-fluentui'
          if (id.includes('lightweight-charts')) return 'vendor-charts'
          if (id.includes('codemirror') || id.includes('@uiw')) return 'vendor-editor'
          if (id.includes('jspdf') || id.includes('html-to-image') || id.includes('html2canvas')) {
            return 'vendor-capture'
          }
          return undefined
        },
      },
    },
  },
  server: {
    host: WEB_HOST,
    port: WEB_PORT,
    strictPort: true,
    https: WEB_HTTPS,
    fs: {
      allow: [repoRoot],
    },
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
      '/opptrix-vendor': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: WEB_HOST,
    port: WEB_PORT,
    strictPort: true,
    https: WEB_HTTPS,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
      '/opptrix-vendor': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
})
