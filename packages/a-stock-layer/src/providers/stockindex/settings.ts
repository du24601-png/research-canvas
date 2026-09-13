import type { ProviderSettingsDefinition } from '@opptrix/shared'
import { getUserDataStore } from '@opptrix/user-store'

export const STOCKINDEX_DISPLAY_TITLE = '跨市场标的检索'
export const STOCKINDEX_DISPLAY_SUBTITLE = '搜索股票代码与名称'

export const STOCKINDEX_SETTINGS: ProviderSettingsDefinition = {
  providerId: 'stockindex',
  title: STOCKINDEX_DISPLAY_TITLE,
  subtitle: STOCKINDEX_DISPLAY_SUBTITLE,
  marketGroup: 'GLOBAL',
  keywords: ['stockindex', '标的搜索', '跨市场', '数据密钥'],
  enableAffectsPriority: true,
  supportsTest: true,
  fields: [
    { key: 'enabled', type: 'boolean', label: '启用', default: false },
    {
      key: 'baseUrl',
      type: 'string',
      label: '服务地址',
      required: true,
      placeholder: 'https://你的检索服务',
      description: '自行托管或授权的标的检索 API 根地址，须含协议。未填写则不启用。',
    },
    {
      key: 'apiKey',
      type: 'secret',
      label: '数据密钥',
      required: true,
      masked: true,
      placeholder: '粘贴数据密钥',
      description: '填写服务地址和数据密钥后即可搜索标的',
    },
  ],
}

function runtimeRow() {
  return getUserDataStore().providerSettings.get('stockindex')
}

/** 未配置或显式关闭时均为未启用（默认关闭） */
export function isStockIndexEnabled(): boolean {
  const row = runtimeRow()
  return row?.enabled === true
}

/** 数据密钥 — 优先设置页 extra.apiKey，其次环境变量（不写日志） */
export function stockIndexApiKey(): string {
  const row = runtimeRow()
  const fromSettings = String(row?.extra?.apiKey ?? '').trim()
  const fromEnv = process.env.OPPTRIX_STOCKINDEX_API_KEY?.trim()
  return fromSettings || fromEnv || ''
}

/** @deprecated 仓库不再内置检索域名；请用 stockIndexBaseUrl()。 */
export const STOCKINDEX_DEFAULT_BASE_URL = ''

export function normalizeStockIndexBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, '')
  if (!trimmed) return ''
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return ''
    return trimmed
  } catch {
    return ''
  }
}

/** 基地址只来自设置或环境变量，仓库不内置第三方域名。 */
export function stockIndexBaseUrl(): string {
  const row = runtimeRow()
  return normalizeStockIndexBaseUrl(
    String(row?.extra?.baseUrl ?? '').trim()
      || process.env.STOCKINDEX_BASE_URL?.trim()
      || process.env.OPPTRIX_STOCKINDEX_BASE_URL?.trim()
      || '',
  )
}
