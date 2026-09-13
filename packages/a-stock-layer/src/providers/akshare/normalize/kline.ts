import type { StockKline } from '@opptrix/shared'
import { normalizeCode } from '../../../utils/helpers.js'

function num(v: unknown, fallback = 0): number {
  if (v == null || v === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function mapAkshareKlineRows(
  code: string,
  rows: Array<Record<string, unknown>>,
): StockKline[] {
  const out: StockKline[] = []
  for (const row of rows) {
    const date = String(row.date ?? '').slice(0, 10)
    if (!date) continue
    out.push({
      code: normalizeCode(code),
      date,
      open: num(row.open),
      close: num(row.close),
      high: num(row.high),
      low: num(row.low),
      volume: num(row.volume),
      amount: num(row.amount),
      changePct: numOrNull(row.changePct),
      turnoverRate: numOrNull(row.turnoverRate),
    })
  }
  out.sort((a, b) => a.date.localeCompare(b.date))
  return out
}
