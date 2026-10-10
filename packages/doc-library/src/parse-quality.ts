/**
 * 解析质量指标：弱文本判定（升阶 L0→L1→L2 的输入）。
 * 除字数 / 空页外：
 * - 乱码（garbled）：替换符 / 私用区 / (cid:N) / mojibake / 文字中混杂大量怪符号 → 弱文本
 * - 文字密度低（lowTextDensity）：只剩数字与零星英文。可能是字体映射丢字（如部分银行年报，
 *   汉字全丢），也可能只是数字为主的报表 —— 不判弱、不触发 OCR，只触发廉价的 PDFium 兜底，
 *   再由 pickFallbackResult 按汉字量裁决。
 */
import type { ParseRunResult } from './types.js'

export type ParseQualityMetrics = {
  charCount: number
  pageCount: number
  /** 空页占比 0..1 */
  emptyPageRatio: number
  /** 非空白字符中「文字」（任意文种字母 / 汉字）占比 0..1（数字多的报表天然偏低） */
  letterRatio?: number
  /** 「类文字」字符（去掉数字、标点、货币 / 数学符号）中文字占比；低 = 怪符号多 */
  wordLetterRatio?: number
  /** 文字中汉字占比 0..1 */
  cjkRatio?: number
  /** 汉字数量 */
  cjkCount?: number
  /** 文字数量（汉字 + 字母），用于两份乱码结果之间比较 */
  letterCount?: number
  /** 替换符 / 私用区 / 控制字符 / (cid:N) 占非空白字符比例 */
  badGlyphRatio?: number
  /** 乱码分 0..1；≥ GARBLED_SCORE_THRESHOLD 视为乱码 */
  garbledScore?: number
  /** 文字密度低（可能丢字，也可能是数字报表）→ 值得试一次 PDFium，但不算弱文本 */
  lowTextDensity?: boolean
}

/** 低于此字数视为几乎无文本（与 service MIN_USEFUL_CHARS 对齐量级） */
export const WEAK_ABS_CHAR_COUNT = 80

/** 每页平均字数低于此值视为弱文本层 */
export const WEAK_CHARS_PER_PAGE = 40

/** 空页占比 ≥ 此值视为弱文本 */
export const WEAK_EMPTY_PAGE_RATIO = 0.4

/** 非空白字符少于此数不评估乱码 / 密度（交给字数阈值） */
export const GARBLED_MIN_SAMPLE = 200

/** 乱码分 ≥ 此值视为乱码 → 弱文本 */
export const GARBLED_SCORE_THRESHOLD = 0.5

/** 文字占全部非空白字符 < 此值：文字密度低；正常中英文研报约 0.55–0.75 */
export const LOW_TEXT_DENSITY_RATIO = 0.25

/** 类文字字符中文字占比 ≤ 此值：怪符号为主（分 = 1）；≥ 0.7 分 = 0 */
export const WORD_LETTER_RATIO_FLOOR = 0.4

/** 坏字形占比 ≥ 此值：分 = 1 */
export const BAD_GLYPH_RATIO_MAX = 0.04

/** 兜底结果汉字数 ≥ 首选 × 此倍数 + CJK_DOMINANCE_MIN 时采用兜底 */
export const CJK_DOMINANCE_FACTOR = 2
export const CJK_DOMINANCE_MIN = 200

const PAGE_MARKER_RE = /<!--\s*page:\d+\s*-->/g
const CJK_RE = /[㐀-䶿一-鿿豈-﫿]/gu
const LETTER_RE = /\p{L}/gu
/** 数字、标点、货币 / 数学符号：报表里大量出现，不计入「类文字」 */
const NON_WORD_RE = /[\p{N}\p{P}\p{Sc}\p{Sm}]/gu
const LATIN1_LETTER_RE = /[À-ÿ]/g
const BAD_GLYPH_RE = /[�-\u0000-\u0008\u000b\u000c\u000e-\u001f]/g
const CID_RE = /\(cid:\d+\)/g

function countMatches(text: string, re: RegExp): number {
  re.lastIndex = 0
  let n = 0
  while (re.exec(text) !== null) n += 1
  return n
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

export type TextQuality = {
  sample: number
  letterRatio: number
  wordLetterRatio: number
  cjkRatio: number
  cjkCount: number
  letterCount: number
  badGlyphRatio: number
  garbledScore: number
  lowTextDensity: boolean
}

type QualityCounts = {
  sample: number
  letters: number
  wordish: number
  bad: number
  latin1: number
}

/** 正文去掉分页注释与 Markdown 表格语法（`|`、`---`）及空白 */
function normalizeForQuality(text: string): string {
  return text
    .replace(PAGE_MARKER_RE, '')
    .replace(/-{3,}/g, '')
    .replace(/[|\s]/g, '')
}

function garbledScoreOf(c: QualityCounts): number {
  if (c.sample < GARBLED_MIN_SAMPLE) return 0
  const glyph = clamp01((c.bad / c.sample) / BAD_GLYPH_RATIO_MAX)
  // 类文字里怪符号（■◆¤ 等）为主；数字 / 标点不参与，数字报表不会被误判
  const wordRatio = c.wordish > 0 ? c.letters / c.wordish : 1
  const symbols = c.wordish >= 50 ? clamp01((0.7 - wordRatio) / (0.7 - WORD_LETTER_RATIO_FLOOR)) : 0
  // 典型 mojibake：「Ã¤Â¸Â­」—— 文字大半落在 Latin-1 补充区
  const latin1Ratio = c.letters > 0 ? c.latin1 / c.letters : 0
  const mojibake = c.letters >= 50 ? clamp01((latin1Ratio - 0.15) / 0.3) : 0
  return Math.max(glyph, symbols, mojibake)
}

/** 文本质量：文字密度、汉字占比、坏字形占比与乱码分 */
export function measureTextQuality(text: string): TextQuality {
  const body = normalizeForQuality(text)
  const cidCount = countMatches(body, CID_RE)
  const cleaned = body.replace(CID_RE, '')
  const counts: QualityCounts = {
    sample: cleaned.length + cidCount,
    letters: countMatches(cleaned, LETTER_RE),
    wordish: cleaned.length - countMatches(cleaned, NON_WORD_RE) + cidCount,
    bad: countMatches(cleaned, BAD_GLYPH_RE) + cidCount,
    latin1: countMatches(cleaned, LATIN1_LETTER_RE),
  }
  const cjkCount = countMatches(cleaned, CJK_RE)
  const letterRatio = counts.sample > 0 ? counts.letters / counts.sample : 0
  return {
    sample: counts.sample,
    letterRatio,
    wordLetterRatio: counts.wordish > 0 ? counts.letters / counts.wordish : 1,
    cjkRatio: counts.letters > 0 ? cjkCount / counts.letters : 0,
    cjkCount,
    letterCount: counts.letters,
    badGlyphRatio: counts.sample > 0 ? counts.bad / counts.sample : 0,
    garbledScore: garbledScoreOf(counts),
    lowTextDensity: counts.sample >= GARBLED_MIN_SAMPLE && letterRatio < LOW_TEXT_DENSITY_RATIO,
  }
}

export function isGarbledText(metrics: Pick<ParseQualityMetrics, 'garbledScore'>): boolean {
  return (metrics.garbledScore ?? 0) >= GARBLED_SCORE_THRESHOLD
}

export function estimateEmptyPageRatio(result: ParseRunResult): number {
  if (typeof result.emptyPageRatio === 'number' && Number.isFinite(result.emptyPageRatio)) {
    return Math.min(1, Math.max(0, result.emptyPageRatio))
  }

  const pageCount = Math.max(result.pageCount, 0)
  if (pageCount <= 0) return 1

  const pageRe = /<!--\s*page:(\d+)\s*-->/g
  const starts: number[] = []
  let m: RegExpExecArray | null
  const md = result.markdown ?? ''
  while ((m = pageRe.exec(md)) !== null) {
    starts.push(m.index)
  }

  if (starts.length === 0) {
    // 无分页标记：用 charCount 粗估
    return result.charCount < WEAK_CHARS_PER_PAGE ? 1 : 0
  }

  let empty = 0
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i] ?? 0
    const end = starts[i + 1] ?? md.length
    const body = md.slice(start, end).replace(/<!--\s*page:\d+\s*-->/g, '').trim()
    if (body.length < 8) empty += 1
  }
  return empty / Math.max(starts.length, 1)
}

function qualityTextOf(result: ParseRunResult): string {
  if (result.markdown) return result.markdown
  return (result.chunks ?? []).map(c => c.text).join('\n')
}

export function metricsFromParseResult(result: ParseRunResult): ParseQualityMetrics {
  const pageCount = Math.max(result.pageCount, 0)
  const q = measureTextQuality(qualityTextOf(result))
  return {
    charCount: result.charCount,
    pageCount,
    emptyPageRatio: estimateEmptyPageRatio(result),
    letterRatio: q.letterRatio,
    wordLetterRatio: q.wordLetterRatio,
    cjkRatio: q.cjkRatio,
    cjkCount: q.cjkCount,
    letterCount: q.letterCount,
    badGlyphRatio: q.badGlyphRatio,
    garbledScore: q.garbledScore,
    lowTextDensity: q.lowTextDensity,
  }
}

/** 弱文本：字数偏低、空页过多或乱码 → 应尝试兜底 / 升阶（文字密度低不算弱） */
export function isWeakText(metrics: ParseQualityMetrics): boolean {
  if (metrics.pageCount <= 0) return true
  if (metrics.charCount < WEAK_ABS_CHAR_COUNT) return true
  const perPage = metrics.charCount / Math.max(metrics.pageCount, 1)
  if (perPage < WEAK_CHARS_PER_PAGE) return true
  if (metrics.emptyPageRatio >= WEAK_EMPTY_PAGE_RATIO) return true
  if (isGarbledText(metrics)) return true
  return false
}

/** 值得试 PDFium 文本层兜底：弱文本，或文字密度低（疑似丢字） */
export function shouldTryPdfFallback(metrics: ParseQualityMetrics): boolean {
  return isWeakText(metrics) || metrics.lowTextDensity === true
}

/**
 * 比较两个结果，返回更优者：
 * 非乱码优先；同为乱码比可读文字数；否则字数优先，其次空页更少。
 */
export function pickBetterResult(a: ParseRunResult, b: ParseRunResult): ParseRunResult {
  const ma = metricsFromParseResult(a)
  const mb = metricsFromParseResult(b)
  const ga = isGarbledText(ma)
  const gb = isGarbledText(mb)
  if (ga !== gb) return ga ? b : a
  if (ga && gb) {
    return (mb.letterCount ?? 0) > (ma.letterCount ?? 0) ? b : a
  }
  if (mb.charCount !== ma.charCount) {
    return mb.charCount > ma.charCount ? b : a
  }
  return mb.emptyPageRatio < ma.emptyPageRatio ? b : a
}

/**
 * 首选 vs PDFium 兜底：保守，只在兜底明显更好时替换（首选可能含图内 OCR 文字）。
 * 兜底胜出：首选乱码而兜底不乱码；兜底汉字远多于首选（丢字）；首选弱而兜底不弱。
 */
export function pickFallbackResult(primary: ParseRunResult, fallback: ParseRunResult): ParseRunResult {
  const mp = metricsFromParseResult(primary)
  const mf = metricsFromParseResult(fallback)
  if (isGarbledText(mf)) return isGarbledText(mp) ? pickBetterResult(primary, fallback) : primary
  if (isGarbledText(mp)) return fallback
  const cjkP = mp.cjkCount ?? 0
  const cjkF = mf.cjkCount ?? 0
  if (cjkF >= cjkP * CJK_DOMINANCE_FACTOR + CJK_DOMINANCE_MIN) return fallback
  if (isWeakText(mp) && !isWeakText(mf)) return fallback
  return primary
}
