import { tushareSecretsOk } from '@opptrix/user-store'
import { resolveUserDataRoot } from '@opptrix/shared'
import path from 'node:path'
import { getProviderConfigStore } from '../config-store.js'

/** Official Tushare Pro POST endpoint. Override via extra.httpUrl / TUSHARE_HTTP_URL. */
export const TUSHARE_DEFAULT_HTTP_URL = 'https://api.tushare.pro'

export interface TushareRuntimeConfig {
  enabled: boolean
  token: string
  httpUrl: string
}

export interface PublicTushareConfig {
  enabled: boolean
  token: string
  token_configured: boolean
  token_preview: string
  config_path: string
}

export function resolveTushareHttpUrl(raw?: string | null): string {
  const trimmed = String(raw ?? '').trim().replace(/\/+$/, '')
  if (!trimmed) return TUSHARE_DEFAULT_HTTP_URL
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return TUSHARE_DEFAULT_HTTP_URL
    }
    return trimmed
  } catch {
    return TUSHARE_DEFAULT_HTTP_URL
  }
}

const DEFAULTS: TushareRuntimeConfig = {
  enabled: false,
  token: process.env.TUSHARE_TOKEN ?? '',
  httpUrl: TUSHARE_DEFAULT_HTTP_URL,
}

export function tushareConfigPath(): string {
  return path.join(resolveUserDataRoot(), 'opptrix.db')
}

function runtimeFromStore(): TushareRuntimeConfig {
  const row = getProviderConfigStore().getRuntime('tushare')
  return {
    enabled: row.enabled,
    token: String(row.extra.token ?? process.env.TUSHARE_TOKEN ?? DEFAULTS.token).trim(),
    httpUrl: resolveTushareHttpUrl(
      String(row.extra.httpUrl ?? process.env.TUSHARE_HTTP_URL ?? ''),
    ),
  }
}

export function loadTushareConfig(): TushareRuntimeConfig {
  try {
    return runtimeFromStore()
  } catch {
    return {
      enabled: DEFAULTS.enabled,
      token: String(process.env.TUSHARE_TOKEN ?? '').trim(),
      httpUrl: resolveTushareHttpUrl(process.env.TUSHARE_HTTP_URL ?? ''),
    }
  }
}

export function saveTushareConfig(partial: Partial<TushareRuntimeConfig>): TushareRuntimeConfig {
  const current = loadTushareConfig()
  const next: TushareRuntimeConfig = {
    enabled: partial.enabled ?? current.enabled,
    token: partial.token !== undefined ? String(partial.token).trim() : current.token,
    httpUrl: partial.httpUrl !== undefined
      ? resolveTushareHttpUrl(partial.httpUrl)
      : current.httpUrl,
  }
  const extra: Record<string, unknown> = { token: next.token }
  if (partial.httpUrl !== undefined) extra.httpUrl = next.httpUrl
  getProviderConfigStore().save('tushare', {
    enabled: next.enabled,
    extra,
  })
  return next
}

export function isTushareEnabled(cfg = loadTushareConfig()): boolean {
  return cfg.enabled && tushareSecretsOk({ token: cfg.token }, process.env.TUSHARE_TOKEN ?? '')
}

export function publicTushareConfig(cfg = loadTushareConfig()): PublicTushareConfig {
  const token = cfg.token
  return {
    enabled: cfg.enabled,
    token,
    token_configured: !!token,
    token_preview: token ? `${token.slice(0, 4)}…${token.slice(-4)}` : '',
    config_path: tushareConfigPath(),
  }
}
