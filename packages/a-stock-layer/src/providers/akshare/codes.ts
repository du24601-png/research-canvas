import { normalizeCode } from '../../utils/helpers.js'

/** 6 位代码 → AKShare 东财 symbol（600519.SH / 000001.SZ） */
export function toAkshareEmSymbol(code: string): string {
  const raw = String(code ?? '').trim().toUpperCase()
  if (/^\d{6}\.(SH|SZ|BJ)$/.test(raw)) return raw
  const digits = normalizeCode(raw.includes('.') ? raw.split('.')[0] : raw)
  if (!digits) return ''
  if (digits.startsWith('6') || digits.startsWith('9')) return `${digits}.SH`
  return `${digits}.SZ`
}

/** 任意输入 → 6 位 A 股代码 */
export function toSixDigitCode(code: string): string {
  const raw = String(code ?? '').trim().toUpperCase()
  const base = raw.includes('.') ? raw.split('.')[0] : raw
  return normalizeCode(base)
}
