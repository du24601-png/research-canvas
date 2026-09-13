import type { FinancialSummary } from '../../../core/schema.js'
import { normalizeCode } from '../../../utils/helpers.js'

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function fmtDate(raw: unknown): string {
  const text = String(raw ?? '').trim()
  if (!text) return ''
  return text.slice(0, 10)
}

function reportTypeFromRow(reportDate: string, explicit?: string): string {
  if (explicit === 'quarter' || explicit === 'quarterly') return 'quarter'
  if (explicit === 'annual') return 'annual'
  const month = reportDate.slice(5, 7)
  if (month === '03' || month === '06' || month === '09') return 'quarter'
  return 'annual'
}

export function financialsHaveCoreValues(rows: FinancialSummary[]): boolean {
  return rows.some(row => (
    row.revenue != null || row.netProfit != null || row.roe != null || row.grossMargin != null
  ))
}

export function mapAkshareFinancialRows(
  code: string,
  rows: Array<Record<string, unknown>>,
  reportType = 'annual',
): FinancialSummary[] {
  const out: FinancialSummary[] = []
  for (const row of rows) {
    const reportDate = fmtDate(row.REPORT_DATE)
    if (!reportDate) continue
    out.push({
      code: normalizeCode(code),
      reportDate,
      reportType: reportTypeFromRow(reportDate, reportType),
      revenue: num(row.TOTALOPERATEREVE),
      revenueYoy: num(row.TOTALOPERATEREVETZ ?? row.DJD_TOI_YOY),
      netProfit: num(row.PARENTNETPROFIT),
      netProfitYoy: num(row.PARENTNETPROFITTZ ?? row.DJD_DPNP_YOY),
      eps: num(row.EPSJB ?? row.EPSXS),
      roe: num(row.ROEJQ ?? row.ROEKCJQ),
      grossMargin: num(row.XSMLL),
      netMargin: null,
      debtRatio: num(row.INTEREST_DEBT_RATIO),
      operatingCashFlow: null,
      bps: num(row.BPS),
    })
  }
  out.sort((a, b) => b.reportDate.localeCompare(a.reportDate))
  return out
}
