/**
 * 读取 O6-A 真实快照（snapshot-v1），按「代码 + 指标 + 年份」查值。
 * 供 Composer 评测把夹具数据集换成真实覆盖度（哪些格有值 / 为空）；查不到的格保留合成值。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/snapshot-v1')
const METRICS = ['net_margin', 'roe', 'gross_margin']

let cache = null

function load() {
  if (cache) return cache
  cache = new Map()
  for (const metric of METRICS) {
    const ds = JSON.parse(readFileSync(path.join(DIR, `${metric}.json`), 'utf8'))
    for (const entity of ds.entities) {
      const code = String(entity.ticker).split('.')[0]
      for (const point of ds.data.filter(p => p.entityId === entity.id)) {
        cache.set(`${code}|${metric}|${point.period}`, point.value)
      }
    }
  }
  return cache
}

export const SNAPSHOT_VERSION = 'finframe-snapshot-v1'

/** 返回 { hit, value }：hit=false 表示快照没覆盖这一格（不是空值） */
export function snapshotLookup(ticker, metric, year) {
  const key = `${String(ticker).split('.')[0]}|${metric}|${year}`
  const table = load()
  return table.has(key) ? { hit: true, value: table.get(key) } : { hit: false, value: null }
}

/** 用快照值覆盖数据集里能查到的格；返回新数据集和命中数 */
export function withSnapshotValues(dataset) {
  let hits = 0
  const byId = new Map(dataset.entities.map(e => [e.id, e.ticker]))
  const data = dataset.data.map((point) => {
    const found = snapshotLookup(byId.get(point.entityId), dataset.metric, point.period)
    if (!found.hit) return point
    hits += 1
    return { ...point, value: found.value }
  })
  return { dataset: { ...dataset, data }, hits }
}
