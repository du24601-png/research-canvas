#!/usr/bin/env node
/**
 * O6-A 冻结快照：用应用自己的取数路径（ResearchHub + query_data）取一次真实数据并落盘。
 * 不读 .env / 密钥：Provider 配置由应用按平时方式自行解析。快照是时点数据（point-in-time），
 * 之后不随上游更新。用法：node eval/finframe/snapshot/fetch-snapshot.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ResearchHub } from '@opptrix/research-hub'
import { createHubDiskCache } from '@opptrix/user-store'
import { buildResearchCanvasTools, extractResearchCanvasEvent } from '../../../packages/agent/dist/research-canvas-tools.js'
import { runInToolSession } from '../../../packages/agent/dist/mcp/tool-session-context.js'
import { beginResearchCanvasTurn, endResearchCanvasTurn } from '../../../packages/agent/dist/research-canvas-turn-state.js'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(DIR, '../fixtures/snapshot-v1')
const SESSION = 'finframe-snapshot-v1'
export const SNAPSHOT_VERSION = 'finframe-snapshot-v1'

/** seed-v1 用到的 A 股 + Demo C 的「平安」两家候选 */
const ENTITIES = ['贵州茅台', '五粮液', '泸州老窖', '招商银行', '平安银行', '中国平安', '海天味业', '宁德时代', '比亚迪', '中芯国际', '688347']
const METRICS = ['net_margin', 'roe', 'gross_margin']
const START = '2021'
const END = '2025'
const PAUSE_MS = 65_000

async function fetchMetric(tools, metric) {
  const result = await tools.query_data.handler({ entities: ENTITIES, metric, start: START, end: END, confirmed: true })
  const dataset = extractResearchCanvasEvent(result)?.dataset
  if (!dataset) return { metric, error: result?.error ?? '没有返回数据集' }
  return { metric, dataset }
}

async function main() {
  const hub = new ResearchHub({ diskCache: createHubDiskCache() })
  const tools = Object.fromEntries(buildResearchCanvasTools(hub).map(tool => [tool.name, tool]))
  beginResearchCanvasTurn(SESSION, { widgets: [], datasetRecords: [] })
  let results
  try {
    // 逐个指标串行并间隔，避免上游限频导致整片缺值
    results = await runInToolSession(SESSION, async () => {
      const out = []
      for (const metric of METRICS) {
        if (out.length) await new Promise(resolve => setTimeout(resolve, PAUSE_MS))
        out.push(await fetchMetric(tools, metric))
      }
      return out
    })
  } finally {
    endResearchCanvasTurn(SESSION)
  }
  await mkdir(OUT, { recursive: true })
  const manifest = { version: SNAPSHOT_VERSION, kind: 'real_point_in_time', fetchedAt: new Date().toISOString(), start: START, end: END, entities: ENTITIES, metrics: [] }
  for (const row of results) {
    if (row.error) {
      manifest.metrics.push({ metric: row.metric, error: row.error })
      continue
    }
    const ds = row.dataset
    const filled = ds.data.filter(p => p.value != null).length
    const providers = [...new Set(ds.sources.map(s => s.provider))]
    manifest.metrics.push({ metric: row.metric, file: `${row.metric}.json`, periods: ds.periods, entities: ds.entities.map(e => e.name), filled, total: ds.data.length, providers })
    await writeFile(path.join(OUT, `${row.metric}.json`), `${JSON.stringify(ds, null, 2)}\n`, 'utf8')
  }
  await writeFile(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(manifest.metrics.map(({ metric, filled, total, providers, error }) => ({ metric, filled, total, providers, error })), null, 2))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
