import type { ChartStyle, ChartStyleSeriesItem } from './research-chart-style.js'

export interface ChartStyleEntityRef {
  id: string
  name?: string
  ticker?: string
}

function normName(value: string): string {
  return value.trim().toLowerCase().replace(/股份有限公司|有限公司|集团/g, '')
}

function tickerKey(value: string): string {
  return value.trim().toUpperCase()
}

function tickerBase(value: string): string {
  const key = tickerKey(value)
  const dot = key.indexOf('.')
  return dot > 0 ? key.slice(0, dot) : key
}

function uniqueMatch(
  entities: readonly ChartStyleEntityRef[],
  test: (entity: ChartStyleEntityRef) => boolean,
): string | undefined {
  const hits = entities.filter(test)
  return hits.length === 1 ? hits[0]?.id : undefined
}

/** 把公司名 / 代码 / 简称解析成 dataset entityId；对不上则返回 undefined。 */
export function matchChartStyleEntityId(
  key: string,
  entities: readonly ChartStyleEntityRef[],
): string | undefined {
  const raw = key.trim()
  if (!raw || !entities.length) return undefined
  const byId = uniqueMatch(entities, entity => entity.id === raw)
  if (byId) return byId
  const ticker = tickerKey(raw)
  const byTicker = uniqueMatch(entities, entity => tickerKey(entity.ticker ?? '') === ticker)
  if (byTicker) return byTicker
  const base = tickerBase(raw)
  if (base.length >= 6) {
    const byBase = uniqueMatch(entities, entity => tickerBase(entity.ticker ?? '') === base)
    if (byBase) return byBase
  }
  const byName = uniqueMatch(entities, entity => (entity.name ?? '').trim() === raw)
  if (byName) return byName
  const normalized = normName(raw)
  if (normalized.length < 2) return undefined
  const byNorm = uniqueMatch(entities, entity => normName(entity.name ?? '') === normalized)
  if (byNorm) return byNorm
  return uniqueMatch(entities, entity => {
    const name = (entity.name ?? '').trim()
    return name.length >= 2 && (name.includes(raw) || raw.includes(name))
  })
}

/** 将 style.series 的自然语言键折叠到 entityId，便于渲染命中。 */
export function resolveChartStyleAgainstEntities(
  style: ChartStyle | undefined,
  entities: readonly ChartStyleEntityRef[],
): ChartStyle | undefined {
  if (!style?.series || !entities.length) return style
  const series: Record<string, ChartStyleSeriesItem> = {}
  for (const [key, item] of Object.entries(style.series)) {
    const id = matchChartStyleEntityId(key, entities) ?? key
    series[id] = { ...series[id], ...item }
  }
  return { ...style, series }
}
