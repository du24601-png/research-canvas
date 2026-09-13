/**
 * 内置数据源名单 — 唯一权威清单（数据层 v3.5 收敛）。
 *
 * 消费方：
 * - register.ts（再导出给 ProviderLoader）
 * - manifests.ts（再导出为 BUILTIN_PROVIDER_MANIFESTS）
 *
 * 注意：本模块保持「叶子」依赖 — 只允许 import 各 provider 的 manifest 定义。
 * 禁止 import register.js / config-store.js / manifests.js / loader.js，
 * 否则会经 permission-denial → manifests 形成模块环。
 */
import type { ProviderManifest } from '@opptrix/shared'
import { TUSHARE_MANIFEST } from './tushare/manifest.js'
import { TICKFLOW_MANIFEST } from './tickflow/manifest.js'
import { TONGHUASHUN_MANIFEST } from './tonghuashun/manifest.js'
import { STOCKINDEX_MANIFEST } from './stockindex/manifest.js'
import { AKSHARE_MANIFEST } from './akshare/manifest.js'

export const BUILTIN_MANIFESTS: ProviderManifest[] = [
  TUSHARE_MANIFEST,
  TICKFLOW_MANIFEST,
  TONGHUASHUN_MANIFEST,
  STOCKINDEX_MANIFEST,
  AKSHARE_MANIFEST,
]
