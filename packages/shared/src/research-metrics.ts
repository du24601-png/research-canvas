export const RESEARCH_METRIC_IDS = [
  'gross_margin',
  'revenue',
  'revenue_growth',
  'net_income',
  'net_margin',
  'roe',
  'kline',
] as const

export type ResearchMetricId = (typeof RESEARCH_METRIC_IDS)[number]
export type ResearchPreferredView = 'line_chart' | 'bar_chart' | 'candlestick'
export const RESEARCH_METRIC_KINDS = ['ratio', 'flow', 'growth', 'share', 'price'] as const
export type ResearchMetricKind = (typeof RESEARCH_METRIC_KINDS)[number]

export interface ResearchMetric {
  id: ResearchMetricId
  name: string
  aliases: string[]
  unit: string
  kind: ResearchMetricKind
  preferredView: ResearchPreferredView
  financialField?: 'grossMargin' | 'revenue' | 'revenueYoy' | 'netProfit' | 'netMargin' | 'roe'
}

export const RESEARCH_METRICS: readonly ResearchMetric[] = [
  {
    id: 'gross_margin',
    name: '毛利率',
    aliases: ['毛利率', '销售毛利率', '毛利水平'],
    unit: '%',
    kind: 'ratio',
    preferredView: 'line_chart',
    financialField: 'grossMargin',
  },
  {
    id: 'revenue',
    name: '营业收入',
    aliases: ['营收', '营业收入', '主营收入'],
    unit: '元',
    kind: 'flow',
    preferredView: 'line_chart',
    financialField: 'revenue',
  },
  {
    id: 'revenue_growth',
    name: '营收增速',
    aliases: ['营收增速', '营收同比', '收入增速'],
    unit: '%',
    kind: 'growth',
    preferredView: 'line_chart',
    financialField: 'revenueYoy',
  },
  {
    id: 'net_income',
    name: '归母净利润',
    aliases: ['归母净利润', '净利润', '净利'],
    unit: '元',
    kind: 'flow',
    preferredView: 'line_chart',
    financialField: 'netProfit',
  },
  {
    id: 'net_margin',
    name: '净利率',
    aliases: ['净利率', '销售净利率', '净利水平'],
    unit: '%',
    kind: 'ratio',
    preferredView: 'line_chart',
    financialField: 'netMargin',
  },
  {
    id: 'roe',
    name: 'ROE',
    aliases: ['ROE', 'roe', '净资产收益率', '加权净资产收益率'],
    unit: '%',
    kind: 'ratio',
    preferredView: 'line_chart',
    financialField: 'roe',
  },
  {
    id: 'kline',
    name: '日K',
    aliases: ['K线', 'k线', '蜡烛图', '日K', '日线', 'kline'],
    unit: '元',
    kind: 'price',
    preferredView: 'candlestick',
  },
]

const METRIC_BY_ID = new Map(RESEARCH_METRICS.map(metric => [metric.id, metric]))

function normalizeAlias(value: string): string {
  return value.trim().toLowerCase()
}

export function isResearchMetricId(value: unknown): value is ResearchMetricId {
  return typeof value === 'string' && METRIC_BY_ID.has(value as ResearchMetricId)
}

export function isKlineMetricId(value: unknown): boolean {
  return value === 'kline'
}

export function researchMetricKind(metric: string): ResearchMetricKind {
  return resolveResearchMetric(metric)?.kind ?? (isKlineMetricId(metric) ? 'price' : 'ratio')
}

export function resolveResearchMetric(raw: unknown): ResearchMetric | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const byId = METRIC_BY_ID.get(trimmed as ResearchMetricId)
  if (byId) return byId
  const needle = normalizeAlias(trimmed)
  for (const metric of RESEARCH_METRICS) {
    if (normalizeAlias(metric.name) === needle) return metric
    if (metric.aliases.some(alias => normalizeAlias(alias) === needle)) return metric
  }
  return null
}
