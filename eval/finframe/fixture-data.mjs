/**
 * FinFrame 种子集夹具数据：合成值，不是真实财报数字。
 * 数值由 (标的, 指标, 年份) 哈希决定，可复现；故意与真实值不同，
 * 这样模型凭记忆写出的「真实」数字会被 numbers_grounded 判为无据。
 * O6-A 的真实冻结快照尚未生成，替换时只需换掉 metricValue()。
 */
export const FIXTURE_VERSION = 'finframe-synth-v1'
export const FIXTURE_PROVIDER = 'eval-fixture'
export const FIXTURE_FETCHED_AT = '2026-09-14T05:00:00.000Z'

/** 已披露完整财年上限（冻结时钟 2026-09-14） */
export const LATEST_FULL_YEAR = 2025

const CN_ENTITIES = [
  { name: '贵州茅台', ticker: '600519', aliases: ['茅台', '600519'] },
  { name: '五粮液', ticker: '000858', aliases: ['000858'] },
  { name: '泸州老窖', ticker: '000568', aliases: ['老窖', '000568'] },
  { name: '宁德时代', ticker: '300750', aliases: ['300750'] },
  { name: '比亚迪', ticker: '002594', aliases: ['002594'] },
  { name: '招商银行', ticker: '600036', aliases: ['招行', '600036'] },
  { name: '平安银行', ticker: '000001', aliases: ['000001'] },
  { name: '海天味业', ticker: '603288', aliases: ['海天', '603288'] },
  { name: '美的集团', ticker: '000333', aliases: ['美的', '000333'] },
  { name: '格力电器', ticker: '000651', aliases: ['格力', '000651'] },
  { name: '中芯国际', ticker: '688981', aliases: ['688981'] },
  { name: '华虹公司', ticker: '688347', aliases: ['华虹', '688347'] },
]

/** 有歧义的简称：生产实体解析器会报「对应多家公司」 */
const AMBIGUOUS = ['中芯', '平安', '银行']

/** 非 A 股：生产 query_data 只接受 CN 标的 */
const NON_CN = ['苹果', 'AAPL', '微软', 'MSFT', '英伟达', 'NVDA', '特斯拉', 'TSLA', '腾讯', '00700', '美团', '03690', '小米', '01810', '00981']

/** 刻意缺数：这些 (ticker, 年份) 在所有指标上为 null */
const MISSING = new Set(['688347:2020', '688347:2021'])

const RANGES = {
  gross_margin: [20, 92, '%'],
  net_margin: [5, 55, '%'],
  roe: [6, 38, '%'],
  revenue_growth: [-12, 35, '%'],
  revenue: [200, 4000, '亿元'],
  net_income: [20, 900, '亿元'],
}

export const METRIC_LABELS = {
  gross_margin: '毛利率',
  net_margin: '净利率',
  roe: '净资产收益率',
  revenue_growth: '营收增速',
  revenue: '营业收入',
  net_income: '归母净利润',
}

function hash01(text) {
  let h = 2166136261
  for (const ch of text) {
    h ^= ch.codePointAt(0) ?? 0
    h = Math.imul(h, 16777619) >>> 0
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b) >>> 0
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35) >>> 0
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

export function metricUnit(metric) {
  return RANGES[metric]?.[2] ?? ''
}

export function metricValue(ticker, metric, year) {
  if (Number(year) > LATEST_FULL_YEAR) return null
  if (MISSING.has(`${ticker}:${year}`)) return null
  const range = RANGES[metric]
  if (!range) return null
  const [lo, hi] = range
  const v = lo + (hi - lo) * hash01(`${FIXTURE_VERSION}|${ticker}|${metric}|${year}`)
  return Math.round(v * 100) / 100
}

function norm(text) {
  return String(text ?? '').replace(/\s+/g, '').toUpperCase()
}

/** 与生产 resolveResearchEntity 对齐：返回 { entity } 或 { error } */
export function resolveFixtureEntity(raw) {
  const q = norm(raw)
  if (!q) return { error: '公司名称或代码不能为空' }
  const exact = CN_ENTITIES.find((e) => norm(e.name) === q || e.aliases.some((a) => norm(a) === q))
  if (exact) return { entity: toEntity(exact) }
  if (AMBIGUOUS.some((a) => norm(a) === q)) return { error: `「${raw}」对应多家公司，请改用全称或股票代码` }
  if (NON_CN.some((a) => q.includes(norm(a)))) return { error: `无法确认「${raw}」对应的上市公司` }
  const partial = CN_ENTITIES.filter((e) => norm(e.name).includes(q))
  if (partial.length === 1) return { entity: toEntity(partial[0]) }
  if (partial.length > 1) return { error: `「${raw}」对应多家公司，请改用全称或股票代码` }
  return { error: `无法确认「${raw}」对应的上市公司` }
}

function toEntity(row) {
  return { id: row.ticker, name: row.name, ticker: row.ticker, market: 'CN', type: 'equity' }
}

export function isNonCnText(raw) {
  const q = norm(raw)
  return NON_CN.some((a) => q.includes(norm(a)))
}

export function fixtureSearch(keyword) {
  const q = String(keyword ?? '').trim()
  if (!q) return []
  return CN_ENTITIES
    .filter((e) => e.name.includes(q) || q.includes(e.name) || e.aliases.some((a) => q.includes(a)))
    .map((e) => ({ name: e.name, symbol: e.ticker, market: 'CN' }))
}
