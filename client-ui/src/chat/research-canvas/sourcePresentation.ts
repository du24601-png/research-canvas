const PROVIDER_LABELS: Record<string, string> = {
  tushare: '上市公司财报',
  tonghuashun: '行情与财报数据',
  eastmoney: '公开行情',
  sina: '公开行情',
  tickflow: '实时行情',
  akshare: '公开数据',
}

const METRIC_LABELS: Record<string, string> = {
  gross_margin: '毛利率',
  revenue: '营业收入',
  revenue_growth: '营收增速',
  net_income: '净利润',
  net_margin: '净利率',
  roe: '净资产收益率',
  kline: '日K',
}

/** 投资者可读的数据来源名。不向用户暴露 Provider id 或 mixed。 */
export function sourceProviderLabel(provider: string): string {
  const id = provider.trim().toLowerCase()
  if (!id || id === 'unknown' || id === 'mixed' || id === 'cache') return '来源未标注'
  return PROVIDER_LABELS[id] ?? '公开数据'
}

export function researchMetricLabel(metricId: string, fieldLabel?: string): string {
  const mapped = METRIC_LABELS[metricId.trim()]
  if (mapped) return mapped
  if (fieldLabel?.trim()) return fieldLabel.trim()
  return '指标'
}

/** 财务年度展示；日 K 直接显示交易日。 */
export function formatSourcePeriodLabel(metricId: string, period: string): string {
  const trimmed = period.trim()
  if (!trimmed) return '—'
  if (metricId === 'kline') return trimmed
  if (/^\d{4}$/.test(trimmed)) return `${trimmed} 年报`
  return trimmed
}

export function readableFetchTime(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '获取时间未记录'
  return `获取时间：${new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZoneName: 'short',
  }).format(date)}`
}

export function safeSourceUrl(value?: string): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      ? url.href : undefined
  } catch { return undefined }
}
