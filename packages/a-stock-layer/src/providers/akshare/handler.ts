import type { FinancialSummary, StockKline } from '@opptrix/shared'
import { MarketHandlerShell } from '../common/driver-factory.js'
import { AkshareClient } from './api/client.js'
import { isAkshareEnabled } from './settings.js'
import { financialsHaveCoreValues, mapAkshareFinancialRows } from './normalize/financials.js'
import { mapAkshareKlineRows } from './normalize/kline.js'

export class AkshareHandler extends MarketHandlerShell {
  readonly selfThrottled = true

  private client(): AkshareClient | null {
    if (!isAkshareEnabled()) return null
    return AkshareClient.fromConfig()
  }

  async financials(
    code: string,
    _reportDate = '',
    reportType = 'annual',
  ): Promise<FinancialSummary[] | null> {
    const client = this.client()
    if (!client) return null
    try {
      const rows = await client.fetchFinancials(code, reportType)
      if (!rows?.length) return null
      const mapped = mapAkshareFinancialRows(code, rows, reportType)
      if (!mapped.length || !financialsHaveCoreValues(mapped)) return null
      return mapped
    } catch {
      return null
    }
  }

  async kline(
    code: string,
    period = 'daily',
    start = '',
    end = '',
  ): Promise<StockKline[] | null> {
    const client = this.client()
    if (!client) return null
    try {
      const rows = await client.fetchKlines(code, period, start, end)
      if (!rows?.length) return null
      const mapped = mapAkshareKlineRows(code, rows)
      return mapped.length ? mapped : null
    } catch {
      return null
    }
  }
}
