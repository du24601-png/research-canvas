/**
 * Provider 插件模块契约 — 数据层加载器与 @opptrix/provider-sdk 的对接层。
 *
 * 类型权威是 @opptrix/provider-sdk；本文件只做三件事：
 * 1. 再导出 SDK 契约类型（ProviderRuntimeContext / ProviderValidationResult 等）
 * 2. 定义加载器接受的统一入口模块形态：v1 `driver` 形态 + v2 SDK `createDriver` 形态
 * 3. provider.json 的解析归一化、SDK 权威校验（结构化失败信息）与 manifest 合并
 */
import type {
  MarketGroup,
  ProviderBinding,
  ProviderManifest,
  ProviderSettingsDefinition,
} from '@opptrix/shared'
import { validateProviderManifest } from '@opptrix/provider-sdk'
import type {
  OpptrixProviderModule as SdkOpptrixProviderModule,
  ProviderJsonEngine,
  ProviderJsonPublisher,
  ProviderJsonTrust,
  ProviderRuntimeContext,
  ProviderValidationResult,
} from '@opptrix/provider-sdk'
import type { Capability } from '../core/capabilities.js'
import type { RegistryProvider } from '../core/registry.js'

export type {
  SdkOpptrixProviderModule,
  ProviderJsonEngine,
  ProviderJsonPublisher,
  ProviderJsonTrust,
  ProviderRuntimeContext,
  ProviderValidationResult,
}

/**
 * provider.json 的加载器归一化产物。
 *
 * 与 SDK 的严格 v2 形态（见 @opptrix/provider-sdk ProviderJsonManifest）不同：
 * 旧版 v1 文件的 capabilities/bindings/engine 是可选的，缺失时由入口模块
 * （bundle.manifest/capabilities/bindings）或驱动兜底。
 */
export interface ProviderJsonManifest {
  schemaVersion: number
  providerId: string
  title: string
  subtitle?: string
  marketGroup: MarketGroup
  defaultPriority: number
  entry: string
  version?: string
  settings?: ProviderSettingsDefinition
  capabilities?: string[]
  bindings?: ProviderBinding[]
  engine?: ProviderJsonEngine
  publisher?: string | ProviderJsonPublisher
  trust?: ProviderJsonTrust
}

export interface ProviderTestContext {
  providerId: string
  overrides?: Record<string, unknown>
  extra: Record<string, unknown>
}

export type ProviderTestConnectionHook = (
  ctx: ProviderTestContext,
) => Promise<{ ok: boolean; message: string }> | { ok: boolean; message: string }

/**
 * 加载器接受的统一入口模块形态（对 `import(<entry>)` 的 `mod ?? mod.default` 归一）。
 *
 * - v1 旧形态：`driver`（类 / 工厂 / 实例，优先）+ 可选 `manifest` / `testConnection`
 * - v2 SDK 形态：`defineProvider` 产出 — `manifest` + `capabilities` + `bindings`
 *   + `settings` + `createDriver(ctx)`
 */
export interface OpptrixProviderModule {
  /** v1：driver 类 / 工厂 / 实例（存在时优先于 createDriver） */
  driver?: RegistryProvider | (new () => RegistryProvider) | (() => RegistryProvider)
  testConnection?: ProviderTestConnectionHook
  /** v2 SDK：模块清单（与 provider.json 合并时字段优先、json 兜底） */
  manifest?: ProviderManifest
  capabilities?: Capability[]
  bindings?: ProviderBinding[]
  settings?: ProviderSettingsDefinition
  createDriver?: (ctx: ProviderRuntimeContext) => RegistryProvider
}

/** provider.json 校验失败 — 结构化错误集合，供加载记录与设置页展示消费。 */
export class ProviderManifestValidationError extends Error {
  readonly errors: string[]
  readonly providerId: string | null

  constructor(errors: string[], providerId: string | null = null) {
    super(`provider.json 校验失败：${errors.join('；')}`)
    this.name = 'ProviderManifestValidationError'
    this.errors = errors
    this.providerId = providerId
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/** SDK 模块对最终 manifest 的贡献（manifest 字段优先、settings 直接消费）。 */
export interface SdkManifestContribution {
  manifest?: ProviderManifest
  settings?: ProviderSettingsDefinition
}

/**
 * provider.json → ProviderManifest，可叠加 SDK 模块贡献。
 *
 * 合并规则：SDK manifest 字段优先，provider.json 兜底；
 * 身份字段 providerId 永远以安装事实（provider.json / 目录名）为准，模块不可篡改。
 */
export function providerJsonToManifest(
  json: ProviderJsonManifest,
  sdk?: SdkManifestContribution,
): ProviderManifest {
  const merged: ProviderManifest = {
    providerId: json.providerId,
    title: json.title,
    subtitle: json.subtitle,
    marketGroup: json.marketGroup,
    defaultPriority: json.defaultPriority,
    settings: json.settings,
  }
  const from = sdk?.manifest
  if (from) {
    if (from.title !== undefined) merged.title = from.title
    if (from.subtitle !== undefined) merged.subtitle = from.subtitle
    if (from.marketGroup !== undefined) merged.marketGroup = from.marketGroup
    if (from.defaultPriority !== undefined) merged.defaultPriority = from.defaultPriority
    if (from.keywords !== undefined) merged.keywords = from.keywords
    if (from.settings !== undefined) merged.settings = from.settings
  }
  if (sdk?.settings !== undefined) merged.settings = sdk.settings
  merged.providerId = json.providerId
  return merged
}

/**
 * provider.json 解析 + SDK 权威校验（validateProviderManifest 是唯一校验实现）。
 *
 * - v2 完整形态（capabilities/bindings/engine 三件套齐备）→ SDK 全量 json 分支校验
 * - 旧版 v1 形态（缺任一件套）→ 仅 SDK 核心字段校验（providerId/title/marketGroup
 *   枚举/priority>0/settings/capabilities/bindings 形状），缺失字段由模块或驱动兜底
 * - 失败抛 ProviderManifestValidationError（errors 为结构化错误集合）
 */
export function validateProviderJson(raw: unknown): ProviderJsonManifest {
  if (!isRecord(raw)) {
    throw new ProviderManifestValidationError(['provider.json 必须是 JSON 对象'])
  }
  const providerId = typeof raw.providerId === 'string' && raw.providerId.trim()
    ? raw.providerId.trim()
    : typeof raw.id === 'string' ? raw.id.trim() : ''
  const basic: string[] = []
  if (!providerId) basic.push('缺少 providerId')
  const entry = typeof raw.entry === 'string' ? raw.entry.trim() : ''
  if (!entry) basic.push('缺少 entry')

  const fullJsonShape = 'capabilities' in raw && 'bindings' in raw && 'engine' in raw
  const candidate: Record<string, unknown> = { ...raw, providerId }
  if (!fullJsonShape) {
    // 旧版形态：去掉 json 分支触发键，让 SDK 只做核心字段校验
    delete candidate.schemaVersion
    delete candidate.entry
    delete candidate.engine
  }
  const result: ProviderValidationResult = validateProviderManifest(candidate)
  const errors = [...basic, ...result.errors]
  if (errors.length > 0) throw new ProviderManifestValidationError(errors, providerId || null)

  return {
    schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1,
    providerId,
    title: typeof raw.title === 'string' ? raw.title.trim() : '',
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : undefined,
    marketGroup: raw.marketGroup as MarketGroup,
    defaultPriority: typeof raw.defaultPriority === 'number' ? raw.defaultPriority : 0,
    entry,
    version: typeof raw.version === 'string' ? raw.version : '0.0.0',
    settings: isRecord(raw.settings) ? raw.settings as unknown as ProviderSettingsDefinition : undefined,
    capabilities: Array.isArray(raw.capabilities) ? raw.capabilities.map(String) : undefined,
    bindings: Array.isArray(raw.bindings) ? raw.bindings as ProviderBinding[] : undefined,
    engine: isRecord(raw.engine) ? raw.engine as unknown as ProviderJsonEngine : undefined,
    publisher: typeof raw.publisher === 'string' || isRecord(raw.publisher)
      ? raw.publisher as string | ProviderJsonPublisher
      : undefined,
    trust: isRecord(raw.trust) ? raw.trust as ProviderJsonTrust : undefined,
  }
}
