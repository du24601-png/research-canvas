/**
 * 数据层 v3.5（P5）—— 死工具零残留锁（防复活）。
 *
 * 锁定的架构不变量：
 *   以下 Agent/MCP 工具已在 v3.5 清理中永久删除（PD 完成），等价数据需求一律
 *   改由标准 capability 管道承接（market-data-core 登记 → provider binding →
 *   queryInstrumentData / queryMarketCapability → Tool Pack Router 选型）：
 *     - get_sector_list           —— 死路由能力 sector_list（仅历史已下线源实现）
 *     - get_instrument_money_flow —— 死路由能力 money_flow（无内置 binding）
 *     - get_macro_series          —— 非 CN 宏观 scope 已下线（Hub 降级项）
 *     - get_instrument_notices    —— 死路由能力 notices（无内置 binding）
 *     - provider_invoke_custom    —— 任意自定义方法直通，违反 capability 白名单原则
 *
 * 谁负责让它保持绿：
 *   - 本测试递归扫描 packages/agent/src、packages/research-hub/src、
 *     packages/shared/src 的全部源码文本，任何文件出现这些名字即打红；
 *   - 若未来确需等价能力：先过架构评审论证 → 走 capability 标准管道新增工具
 *     （tools.ts handler → TOOL_META → TOOL_PACK_MEMBERSHIP → INTENT_RULES →
 *     黄金用例 → docs/AGENT-GUIDE.md），并同步移除本测试对应条目——
 *     不允许改名绕过。
 *
 * 状态：即时绿（PD 已完成删除，本测试仅防复活）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const SCAN_ROOTS = [
  'packages/agent/src',
  'packages/research-hub/src',
  'packages/shared/src',
]

/** 已永久删除的工具名（零容忍，出现即违例）。 */
const DEAD_TOOLS = [
  'get_sector_list',
  'get_instrument_money_flow',
  'get_macro_series',
  'get_instrument_notices',
  'provider_invoke_custom',
]

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs'])
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git'])

/** 递归收集扫描面内的源码文件（不含注释剥离——死工具名连注释里也不应残留）。 */
function walkSources(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walkSources(full, out)
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(full)
    }
  }
  return out
}

const scannedFiles = SCAN_ROOTS.flatMap(rel => walkSources(path.join(root, rel)))

test('扫描面非空（三个 src 目录均存在且含源码，防止扫描静默失效）', () => {
  for (const rel of SCAN_ROOTS) {
    assert.ok(fs.existsSync(path.join(root, rel)), `扫描根目录缺失：${rel}`)
  }
  assert.ok(
    scannedFiles.length >= 50,
    `扫描面仅 ${scannedFiles.length} 个源码文件，疑似目录结构变动导致扫描失效`,
  )
})

for (const tool of DEAD_TOOLS) {
  test(`死工具零残留：${tool}`, () => {
    const hits = []
    for (const file of scannedFiles) {
      const lines = fs.readFileSync(file, 'utf8').split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(tool)) hits.push(`${path.relative(root, file)}:${i + 1}`)
      }
    }
    assert.deepEqual(
      hits,
      [],
      `已删除工具 ${tool} 出现残留（能力需求请走 capability 标准管道）：\n  ${hits.join('\n  ')}`,
    )
  })
}
