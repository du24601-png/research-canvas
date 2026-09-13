import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    // React 由根 overrides 钉为全仓唯一 19.2.8（位于仓库根 node_modules），
    // 无需再为测试钉别名；只保留仓库图标别名。
    alias: {
      '@opptrix-icons': path.resolve(__dirname, '../icons'),
    },
  },
  define: {
    __OPPTRIX_CLIENT_VERSION__: JSON.stringify(
      (JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8')) as { version?: string }).version ?? '',
    ),
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // globals 开启后 @testing-library/react 会自动注册 afterEach(cleanup)，
    // 否则多次渲染叠留在 document.body，screen 查询会串测试。
    globals: true,
    server: {
      deps: {
        // tabster@8.8 打包缺陷：type=module 但 main 指向 .cjs 且无 exports 映射，
        // node ESM 具名导出探测必失败（createTabster）。必须把 @fluentui→tabster
        // 整条链纳入 vite 转换（路径正则匹配解析后文件）。
        inline: [/@fluentui[\\/]/, /[\\/]node_modules[\\/]tabster[\\/]/],
      },
    },
  },
})
