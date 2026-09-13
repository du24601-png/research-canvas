/** Investor-facing source name. Never expose Provider ids. */
export function sourceProviderLabel(provider: string): string {
  const id = provider.trim().toLowerCase()
  if (!id || id === 'unknown') return '来源未标注'
  if (id === 'mixed') return '多个来源'
  return '公开数据'
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
