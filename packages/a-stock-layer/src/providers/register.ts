import { DriverRegistry } from '../core/registry.js'
import { TushareDriver } from './tushare/driver.js'
import { TickflowDriver } from './tickflow/driver.js'
import { TonghuashunDriver } from './tonghuashun/driver.js'
import { StockIndexDriver } from './stockindex/driver.js'
import { AkshareDriver } from './akshare/driver.js'
import { BUILTIN_MANIFESTS } from './builtin-manifests.js'
import { testTushareConnection } from './tushare/api/client.js'
import { testTickflowConnection } from './tickflow/api/client.js'
import { testTonghuashunConnection } from './tonghuashun/api/client.js'
import { testStockIndexConnection } from './stockindex/api/client.js'
import { testAkshareConnection } from './akshare/api/client.js'
import type { ProviderTestConnectionHook } from './provider-module-types.js'

export { BUILTIN_MANIFESTS } from './builtin-manifests.js'

/**
 * 内置数据源「测试连接」钩子 — 唯一来源。
 * 原散落在 loader.ts 的 registerBuiltinTestHooks，随内置名单一起收敛到注册层。
 */
export const BUILTIN_TEST_HOOKS: Record<string, ProviderTestConnectionHook> = {
  tushare: async ({ overrides, extra }) => {
    const token = String(
      overrides?.token ?? extra.token ?? process.env.TUSHARE_TOKEN ?? '',
    ).trim()
    const httpUrl = String(
      overrides?.httpUrl ?? extra.httpUrl ?? process.env.TUSHARE_HTTP_URL ?? '',
    ).trim()
    return testTushareConnection(token, httpUrl || undefined)
  },
  tickflow: async ({ overrides, extra }) => {
    const apiKey = String(
      overrides?.apiKey ?? extra.apiKey ?? process.env.TICKFLOW_API_KEY ?? process.env.OPPTRIX_TICKFLOW_API_KEY ?? '',
    ).trim()
    return testTickflowConnection(apiKey)
  },
  tonghuashun: async ({ overrides, extra }) => {
    const apiKey = String(
      overrides?.apiKey ?? extra.apiKey ?? process.env.FUYAO_TOKEN ?? process.env.OPPTRIX_FUYAO_API_KEY ?? process.env.OPPTRIX_TONGHUASHUN_API_KEY ?? '',
    ).trim()
    return testTonghuashunConnection(apiKey)
  },
  stockindex: async ({ overrides, extra }) => {
    const apiKey = String(
      overrides?.apiKey ?? extra.apiKey ?? process.env.OPPTRIX_STOCKINDEX_API_KEY ?? '',
    ).trim()
    return testStockIndexConnection(apiKey)
  },
  akshare: async ({ overrides, extra }) => {
    const pythonPath = String(
      overrides?.pythonPath ?? extra.pythonPath ?? process.env.OPPTRIX_PYTHON_PATH ?? '',
    ).trim()
    return testAkshareConnection(pythonPath || undefined)
  },
}

/** Register built-in data providers. */
export function registerAllDrivers(registry: DriverRegistry) {
  const drivers = [
    new TushareDriver(),
    new TickflowDriver(),
    new TonghuashunDriver(),
    new StockIndexDriver(),
    new AkshareDriver(),
  ]
  for (const d of drivers) registry.register(d)
  return drivers.length
}

export {
  TushareDriver,
  TickflowDriver,
  TonghuashunDriver,
  StockIndexDriver,
  AkshareDriver,
}
