import type { AvailableModel } from '../types/chat'
import { API_BASE, fetchWithTimeout } from './client'

const REQUEST_TIMEOUT = 10_000
const FALLBACK_ERROR = '暂时无法完成操作，请稍后重试'

/**
 * 错误语义说明（与 api/client.ts 的 jsonFetch 刻意不同，故保留本薄封装）：
 * - 超时/桌面端标识头/credentials 语义复用 client.ts 的 fetchWithTimeout，逐字一致；
 * - 本封装失败抛普通 Error，兜底文案为用户友好话术 FALLBACK_ERROR；client.ts 的 jsonFetch
 *   抛 ApiHttpError（携带 status/code）并处理 auth_required/step_up —— 两者不逐字一致，
 *   按行为保持原则不合并不替换。
 */
async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetchWithTimeout(`${API_BASE}${path}`, init, REQUEST_TIMEOUT)
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({})) as { error?: string; message?: string }
    const msg = (typeof err.message === 'string' && err.message.trim())
      || (typeof err.error === 'string' && err.error.trim())
      || FALLBACK_ERROR
    throw new Error(msg)
  }
  return resp.json() as Promise<T>
}

export type HarnessPatchTier = 'A' | 'B' | 'C'

export interface HarnessVersionSummary {
  id: string
  createdAt: string
  summary: string | null
  modelBucket: string
  tier: HarnessPatchTier
  patchCount: number
}

export interface HarnessActiveVersion {
  id: string
  createdAt: string
  summary: string | null
  tier: HarnessPatchTier
}

export interface HarnessActiveResponse {
  modelRef: string
  resolvedBucket: string | null
  version: HarnessActiveVersion | null
}

/** GET/PUT auto-promote：enabled 为有效状态；env 强制关时带 envForcedOff */
export interface HarnessAutoPromotePref {
  enabled: boolean
  updatedAt: string
  envForcedOff?: boolean
}

export interface HarnessAuditEntry {
  at: string
  action: string
  modelRef?: string
  versionId?: string | null
  detail?: string
}

export const harnessSettings = {
  listVersions: (modelRef?: string) => {
    const qs = modelRef !== undefined
      ? `?modelRef=${encodeURIComponent(modelRef)}`
      : ''
    return jsonFetch<{ versions: HarnessVersionSummary[] }>(`/settings/harness/versions${qs}`)
  },

  getActive: (modelRef: string) =>
    jsonFetch<HarnessActiveResponse>(
      `/settings/harness/active?modelRef=${encodeURIComponent(modelRef)}`,
    ),

  rollback: (modelRef: string) =>
    jsonFetch<{ ok: true; modelRef: string }>('/settings/harness/rollback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelRef }),
    }),

  getAutoPromote: () =>
    jsonFetch<HarnessAutoPromotePref>('/settings/harness/auto-promote'),

  setAutoPromote: (enabled: boolean) =>
    jsonFetch<HarnessAutoPromotePref>('/settings/harness/auto-promote', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }),

  listAudit: (limit = 50) =>
    jsonFetch<{ entries: HarnessAuditEntry[] }>(
      `/settings/harness/audit?limit=${encodeURIComponent(String(limit))}`,
    ),
}

/** 复用已有可用模型列表（设置页模型选择） */
export async function listModelsForHarnessHabits(): Promise<{
  models: AvailableModel[]
  default_model: string | null
}> {
  return jsonFetch<{ models: AvailableModel[]; default_model: string | null }>(
    '/models/available',
    undefined,
  )
}
