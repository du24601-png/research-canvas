import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { InstalledProviderRecord, MarketGroup } from '@opptrix/shared'
import { resolveProvidersDir, resolveUserDataRoot } from '@opptrix/shared'
import type { ProviderRuntimeContext } from '@opptrix/provider-sdk'
import type { RegistryProvider } from '../core/registry.js'
import { DriverRegistry } from '../core/registry.js'
import { BUILTIN_MANIFESTS, BUILTIN_TEST_HOOKS, registerAllDrivers } from './register.js'
import type { ProviderConfigStore } from './config-store.js'
import { getManifestRegistry, type ManifestRegistry } from './manifest-registry.js'
import { MARKET_GROUP_ORDER } from './manifests.js'
import {
  ProviderManifestValidationError,
  type OpptrixProviderModule,
  type ProviderJsonManifest,
  type ProviderTestConnectionHook,
  providerJsonToManifest,
  validateProviderJson,
} from './provider-module-types.js'

/** 已安装数据源记录 — 在 shared 记录之上追加结构化加载失败信息。 */
export interface ProviderInstallRecord extends InstalledProviderRecord {
  /** 加载失败原因；undefined = 驱动已注册（loaded: true） */
  loadError?: string
}

type EntryModule = OpptrixProviderModule & { default?: OpptrixProviderModule }

function resolveDriverExport(
  raw: NonNullable<OpptrixProviderModule['driver']>,
): RegistryProvider {
  if (typeof raw !== 'function') return raw
  if (raw.prototype && typeof raw.prototype.capabilities === 'function') {
    return new (raw as new () => RegistryProvider)()
  }
  return (raw as () => RegistryProvider)()
}

function isDriverLike(v: unknown): v is RegistryProvider {
  return v != null && typeof v === 'object'
    && typeof (v as { name?: unknown }).name === 'string'
    && typeof (v as { bindings?: unknown }).bindings === 'function'
}

function printProviderLog(
  level: 'log' | 'warn' | 'error',
  providerId: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  const line = `[provider:${providerId}] ${message}`
  if (meta) console[level](line, meta)
  else console[level](line)
}

function statInstalledAt(installDir: string): string {
  try {
    return fs.statSync(installDir).mtime.toISOString()
  } catch {
    return new Date(0).toISOString()
  }
}

function isValidMarketGroup(v: unknown): v is MarketGroup {
  return typeof v === 'string' && (MARKET_GROUP_ORDER as string[]).includes(v)
}

/** 宽松读取 provider.json 元数据 — 供加载失败记录展示（不校验）。 */
function readProviderJsonMeta(installDir: string): Partial<ProviderJsonManifest> | null {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(installDir, 'provider.json'), 'utf8')) as unknown
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const o = raw as Record<string, unknown>
    return {
      providerId: typeof o.providerId === 'string' ? o.providerId
        : typeof o.id === 'string' ? o.id : undefined,
      title: typeof o.title === 'string' ? o.title : undefined,
      subtitle: typeof o.subtitle === 'string' ? o.subtitle : undefined,
      marketGroup: typeof o.marketGroup === 'string' ? o.marketGroup as MarketGroup : undefined,
      defaultPriority: typeof o.defaultPriority === 'number' ? o.defaultPriority : undefined,
      entry: typeof o.entry === 'string' ? o.entry : undefined,
      version: typeof o.version === 'string' ? o.version : undefined,
    }
  } catch {
    return null
  }
}

export class ProviderLoader {
  private installed = new Map<string, ProviderInstallRecord>()
  private testHooks = new Map<string, ProviderTestConnectionHook>()

  constructor(
    private registry: DriverRegistry,
    private configStore: ProviderConfigStore,
    private manifestRegistry: ManifestRegistry = getManifestRegistry(),
  ) {}

  registerBuiltins(): number {
    const count = registerAllDrivers(this.registry)
    for (const manifest of BUILTIN_MANIFESTS) {
      this.manifestRegistry.register(manifest, 'builtin')
    }
    for (const [providerId, hook] of Object.entries(BUILTIN_TEST_HOOKS)) {
      this.testHooks.set(providerId, hook)
    }
    return count
  }

  getTestConnectionHook(providerId: string): ProviderTestConnectionHook | undefined {
    return this.testHooks.get(providerId)
  }

  async loadInstalled(): Promise<ProviderInstallRecord[]> {
    this.manifestRegistry.clearInstalled()
    this.unloadInstalledDrivers()

    const providersDir = resolveProvidersDir()
    if (!fs.existsSync(providersDir)) return []

    const loaded: ProviderInstallRecord[] = []
    for (const ent of fs.readdirSync(providersDir, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue
      const installDir = path.join(providersDir, ent.name)
      if (!fs.existsSync(path.join(installDir, 'provider.json'))) continue

      try {
        loaded.push(await this.loadFromDirectory(installDir))
      } catch (err) {
        loaded.push(this.recordLoadFailure(installDir, err))
      }
    }

    this.registry.refreshPriorities(this.configStore)
    return loaded
  }

  /** 加载失败 → 结构化记录进 installed 名单（loaded: false + loadError），不再静默跳过。 */
  private recordLoadFailure(installDir: string, err: unknown): ProviderInstallRecord {
    const dirName = path.basename(installDir)
    const loadError = err instanceof Error ? err.message : String(err)
    const meta = readProviderJsonMeta(installDir)
    const record: ProviderInstallRecord = {
      providerId: meta?.providerId ?? dirName,
      version: meta?.version ?? '0.0.0',
      title: meta?.title ?? dirName,
      subtitle: meta?.subtitle,
      marketGroup: isValidMarketGroup(meta?.marketGroup) ? meta.marketGroup : 'GLOBAL',
      defaultPriority: typeof meta?.defaultPriority === 'number' ? meta.defaultPriority : 0,
      installDir,
      entry: meta?.entry ?? '',
      installedAt: statInstalledAt(installDir),
      loaded: false,
      loadError,
    }
    // 键用目录名：目录名校验失败时 providerId 可能与合法目录同名
    this.installed.set(dirName, record)
    console.warn(`[ProviderLoader] 数据源加载失败 dir=${dirName} error=${loadError}`)
    return record
  }

  private unloadInstalledDrivers(): void {
    for (const id of [...this.installed.keys()]) {
      this.registry.unregister(id)
      this.testHooks.delete(id)
    }
    this.installed.clear()
  }

  /** 解析 + SDK 权威校验 provider.json（结构化失败信息） */
  private parseProviderJson(installDir: string): ProviderJsonManifest {
    let raw: unknown
    try {
      raw = JSON.parse(fs.readFileSync(path.join(installDir, 'provider.json'), 'utf8'))
    } catch (err) {
      throw new ProviderManifestValidationError(
        [`provider.json 解析失败：${err instanceof Error ? err.message : String(err)}`],
        path.basename(installDir),
      )
    }
    return validateProviderJson(raw)
  }

  /** 安装事实校验：目录名 = providerId、入口不逃逸安装目录、不得与内置/已装数据源重名。 */
  private assertInstallable(installDir: string, json: ProviderJsonManifest): void {
    const dirName = path.basename(installDir)
    if (dirName !== json.providerId) {
      throw new Error(`目录名 (${dirName}) 必须与 providerId (${json.providerId}) 一致`)
    }
    if (this.manifestRegistry.getSource(json.providerId) === 'builtin') {
      throw new Error(`与内置数据源 ${json.providerId} 冲突`)
    }
    // 仅拒绝「已成功加载」的重名；失败记录（loaded:false）允许修复后重试
    if (this.installed.get(json.providerId)?.loaded) {
      throw new Error(`数据源 ${json.providerId} 已加载，拒绝重复安装`)
    }
    const entryAbs = path.resolve(installDir, json.entry)
    const rel = path.relative(installDir, entryAbs)
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`入口文件必须位于数据源目录内：${json.entry}`)
    }
    if (!fs.existsSync(entryAbs)) {
      throw new Error(`入口文件不存在: ${json.entry}`)
    }
  }

  /** 动态 import 入口模块；cacheBust 仅 reload 路径使用（时间戳绕过 ESM 缓存）。 */
  private importEntryModule(
    installDir: string,
    json: ProviderJsonManifest,
    cacheBust: boolean,
  ): Promise<EntryModule> {
    let url = pathToFileURL(path.resolve(installDir, json.entry)).href
    if (cacheBust) url += `?t=${Date.now()}`
    return import(url) as Promise<EntryModule>
  }

  /** 三形态兼容：bundle.driver（v1，优先）→ bundle.createDriver(ctx)（v2 SDK）→ 结构化报错 */
  private instantiateDriver(bundle: OpptrixProviderModule, providerId: string): RegistryProvider {
    if (bundle.driver != null) return resolveDriverExport(bundle.driver)
    if (typeof bundle.createDriver === 'function') {
      const driver = bundle.createDriver(this.buildRuntimeContext(providerId))
      if (!isDriverLike(driver)) {
        throw new Error('createDriver 未返回有效 driver（缺 name/bindings）')
      }
      return driver
    }
    throw new Error('模块未导出 driver（支持 driver 或 createDriver 形态）')
  }

  /** v2 SDK 形态的运行时上下文：身份、用户设置、数据目录与结构化日志。 */
  private buildRuntimeContext(providerId: string): ProviderRuntimeContext {
    const runtime = this.configStore.getRuntime(providerId)
    return {
      providerId,
      settings: {
        enabled: runtime.enabled,
        priority: runtime.priority,
        values: { ...runtime.extra },
      },
      paths: { userDataRoot: resolveUserDataRoot() },
      log: {
        info: (message, meta) => printProviderLog('log', providerId, message, meta),
        warn: (message, meta) => printProviderLog('warn', providerId, message, meta),
        error: (message, meta) => printProviderLog('error', providerId, message, meta),
      },
    }
  }

  private async loadFromDirectory(
    installDir: string,
    opts: { cacheBust?: boolean } = {},
  ): Promise<ProviderInstallRecord> {
    const json = this.parseProviderJson(installDir)
    const providerId = json.providerId

    this.assertInstallable(installDir, json)

    const mod = await this.importEntryModule(installDir, json, opts.cacheBust === true)
    const bundle = mod.default ?? mod
    const driver = this.instantiateDriver(bundle, providerId)

    if (driver.name !== providerId) {
      throw new Error(`driver.name (${driver.name}) 与 providerId (${providerId}) 不一致`)
    }
    if (this.registry.get(driver.name)) {
      throw new Error(`数据源 ${driver.name} 已注册，拒绝重名覆盖`)
    }

    const manifest = providerJsonToManifest(json, {
      manifest: bundle.manifest,
      settings: bundle.settings,
    })
    this.manifestRegistry.register(manifest, 'installed')
    this.registry.register(driver)

    if (typeof bundle.testConnection === 'function') {
      this.testHooks.set(providerId, bundle.testConnection.bind(bundle))
    }

    const record: ProviderInstallRecord = {
      providerId,
      version: json.version ?? '0.0.0',
      title: manifest.title,
      subtitle: json.subtitle,
      marketGroup: json.marketGroup,
      defaultPriority: json.defaultPriority,
      installDir,
      entry: json.entry,
      installedAt: statInstalledAt(installDir),
      loaded: true,
    }
    this.installed.set(providerId, record)
    return record
  }

  async activate(providerId: string): Promise<void> {
    const runtime = this.configStore.getRuntime(providerId)
    this.configStore.save(providerId, { enabled: true, extra: runtime.extra })

    if (!this.registry.get(providerId)) {
      const record = this.installed.get(providerId)
      if (record) {
        await this.loadFromDirectory(record.installDir)
      } else {
        const installDir = path.join(resolveProvidersDir(), providerId)
        if (fs.existsSync(path.join(installDir, 'provider.json'))) {
          await this.loadFromDirectory(installDir)
        }
      }
    }

    this.registry.refreshPriorities(this.configStore)
  }

  deactivate(providerId: string): void {
    const runtime = this.configStore.getRuntime(providerId)
    this.configStore.save(providerId, { enabled: false, extra: runtime.extra })

    if (this.installed.has(providerId)) {
      this.registry.unregister(providerId)
      const record = this.installed.get(providerId)
      if (record) this.installed.set(providerId, { ...record, loaded: false })
    }

    this.registry.refreshPriorities(this.configStore)
  }

  async rescan(): Promise<ProviderInstallRecord[]> {
    return this.loadInstalled()
  }

  uninstall(providerId: string): boolean {
    if (this.manifestRegistry.getSource(providerId) === 'builtin') {
      throw new Error('无法移除内置数据源')
    }
    const installDir = this.installed.get(providerId)?.installDir
      ?? path.join(resolveProvidersDir(), providerId)
    if (!fs.existsSync(installDir)) return false

    if (this.registry.get(providerId)) this.registry.unregister(providerId)
    this.manifestRegistry.unregister(providerId)
    this.testHooks.delete(providerId)
    this.installed.delete(providerId)
    fs.rmSync(installDir, { recursive: true, force: true })
    this.registry.refreshPriorities(this.configStore)
    return true
  }

  async reload(providerId: string): Promise<ProviderInstallRecord | null> {
    const record = this.installed.get(providerId)
    const installDir = record?.installDir ?? path.join(resolveProvidersDir(), providerId)

    if (this.registry.get(providerId)) this.registry.unregister(providerId)
    this.manifestRegistry.unregister(providerId)
    this.testHooks.delete(providerId)
    this.installed.delete(providerId)

    if (!fs.existsSync(path.join(installDir, 'provider.json'))) return null

    const next = await this.loadFromDirectory(installDir, { cacheBust: true })
    this.registry.refreshPriorities(this.configStore)
    return next
  }

  listInstalled(): ProviderInstallRecord[] {
    return [...this.installed.values()]
  }

  /** Read provider.json without loading the driver module */
  readProviderJson(installDir: string): ProviderJsonManifest {
    return validateProviderJson(
      JSON.parse(fs.readFileSync(path.join(installDir, 'provider.json'), 'utf8')) as unknown,
    )
  }
}

let sharedLoader: ProviderLoader | null = null

export function createProviderLoader(
  registry: DriverRegistry,
  configStore: ProviderConfigStore,
): ProviderLoader {
  sharedLoader = new ProviderLoader(registry, configStore)
  return sharedLoader
}

export function getProviderLoader(): ProviderLoader | null {
  return sharedLoader
}

export function resetProviderLoader(): void {
  sharedLoader = null
}
