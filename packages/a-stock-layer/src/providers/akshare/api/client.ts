import { akshareSidecarEnv, akshareWorkerScriptPath, resolveAksharePython } from '../config.js'
import { isRecord, spawnJsonLine } from '../spawn-json.js'

const SIDECAR_TIMEOUT_MS = 90_000

type SidecarResponse = {
  ok?: boolean
  error?: string
  message?: string
  rows?: Array<Record<string, unknown>>
}

export class AkshareClient {
  constructor(
    private readonly python: string,
    private readonly scriptPath: string,
  ) {}

  static fromConfig(): AkshareClient {
    return new AkshareClient(resolveAksharePython(), akshareWorkerScriptPath())
  }

  private async call(op: string, args: Record<string, unknown>): Promise<SidecarResponse | null> {
    const result = await spawnJsonLine({
      command: this.python,
      args: [this.scriptPath],
      request: { op, args },
      timeoutMs: SIDECAR_TIMEOUT_MS,
      env: akshareSidecarEnv(),
    })
    if (!isRecord(result.data)) return null
    const data = result.data as SidecarResponse
    if (!result.ok || data.ok === false) return null
    return data
  }

  async ping(): Promise<{ ok: boolean; message: string }> {
    const data = await this.call('ping', {})
    if (!data?.ok) {
      const err = data?.error ?? '无法启动 Python 侧车，请检查 Python 与 akshare 是否已安装'
      return { ok: false, message: err }
    }
    return { ok: true, message: String(data.message ?? '连接成功') }
  }

  async fetchFinancials(code: string, reportType: string): Promise<Array<Record<string, unknown>> | null> {
    const data = await this.call('financials', { code, reportType })
    return data?.rows ?? null
  }

  async fetchKlines(
    code: string,
    period: string,
    start: string,
    end: string,
  ): Promise<Array<Record<string, unknown>> | null> {
    const data = await this.call('kline', { code, period, start, end })
    return data?.rows ?? null
  }
}

export async function testAkshareConnection(pythonPath?: string): Promise<{ ok: boolean; message: string }> {
  const client = pythonPath?.trim()
    ? new AkshareClient(pythonPath.trim(), akshareWorkerScriptPath())
    : AkshareClient.fromConfig()
  const ping = await client.ping()
  if (!ping.ok) return ping
  const rows = await client.fetchFinancials('600519', 'annual')
  if (!rows?.length) {
    return { ok: false, message: '已连接 AKShare，但示例财务查询无数据，请检查网络或代理设置' }
  }
  return { ok: true, message: '连接成功，财务数据可用' }
}
