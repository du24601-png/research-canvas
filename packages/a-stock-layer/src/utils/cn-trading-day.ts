/**
 * CN 交易日日期统一口径 — 唯一实现，全部按 Asia/Shanghai（UTC+8，无夏令时）。
 *
 * 背景：provider 层曾并存多套口径（服务器本地时区 / 硬编码 +08:00 / 各自的
 * Intl 实现）。服务器时区不确定（Docker=UTC、开发机=本地时区），日界附近
 * （上海 00:00–08:00）会取错交易日。禁止在 provider 内再手写日期口径；
 * 一律 import 本模块。
 *
 * 语义：
 * - `cnTradingDayYmd`  时刻 → 上海日历日 `YYYY-MM-DD`（en-CA 即 ISO 排序格式）
 * - `cnYmdFromMs`      epoch ms → 上海日历日；非法/非正输入返回 ''（兼容旧 msToYmd）
 * - `cnYmdToMs`        `YYYY-MM-DD` → epoch ms，按 +08:00 午夜 / 23:59:59 解析
 * - `cnYmdDaysAgo`     上海日历日 N 天前（上海无夏令时，24h 回推即日历日回推）
 */

const CN_TIME_ZONE = 'Asia/Shanghai'

/** Intl formatter 构造开销大，模块级复用；en-CA 输出 `YYYY-MM-DD` */
const cnYmdFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** 当前/指定时刻的上海日历日 `YYYY-MM-DD`（UTC 23:00 归上海次日） */
export function cnTradingDayYmd(date: Date = new Date()): string {
  return cnYmdFormatter.format(date)
}

/** 当前/指定时刻的上海日历日紧凑形 `YYYYMMDD`（tushare API 口径） */
export function cnTradingDayCompactYmd(date: Date = new Date()): string {
  return cnTradingDayYmd(date).replace(/-/g, '')
}

/** 当前上海日历年（tradeCalendar 等按年窗口的默认值） */
export function cnCalendarYear(date: Date = new Date()): number {
  return Number(cnTradingDayYmd(date).slice(0, 4))
}

/** epoch ms → 上海日历日 `YYYY-MM-DD`；非法或非正输入返回空串 */
export function cnYmdFromMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return ''
  return cnTradingDayYmd(new Date(ms))
}

/** `YYYY-MM-DD` → epoch ms；午夜/末日按 +08:00 解析，非法输入返回 NaN */
export function cnYmdToMs(ymd: string, endOfDay = false): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd.slice(0, 10))
  if (!m) return NaN
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${endOfDay ? '23:59:59' : '00:00:00'}+08:00`).getTime()
}

/** 上海日历日 N 天前 `YYYY-MM-DD`（跨月/跨年安全） */
export function cnYmdDaysAgo(days: number, date: Date = new Date()): string {
  return cnTradingDayYmd(new Date(date.getTime() - days * 86_400_000))
}

/** 上海日历日 N 天前紧凑形 `YYYYMMDD` */
export function cnCompactYmdDaysAgo(days: number, date: Date = new Date()): string {
  return cnYmdDaysAgo(days, date).replace(/-/g, '')
}
