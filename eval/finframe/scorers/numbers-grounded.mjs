/**
 * 评分器 1：回复正文里的数字必须能在本题产生的某个 Dataset 中找到。
 * 年份、股票代码、序号、计数（3 家 / 5 年）、数据集 id 不算数值断言。
 * 容差按回复里写出的小数位四舍五入（写 47.8 可对上 47.83）。
 * 模型自己算的差值、均值也判无据：原则 1 要求数字由代码给出。
 */
const NUM_RE = /-?\d+(?:,\d{3})*(?:\.\d+)?/g
const COUNT_SUFFIX = /^\s*(?:家|个|只|年|项|步|张|期|条|种|次|位|季|月|日|号|大|类|组|列|行)/
const ORDINAL_PREFIX = /(?:第|近|前|后|最近|每|Top|TOP|top|T\+?)\s*$/

function stripNonClaims(text) {
  return String(text ?? '')
    .replace(/research-ds-[\w-]+|prop-[\w-]+|w-[\w-]+/g, ' ')
    .replace(/(?:19|20)\d{2}\s*[/.-]\s*\d{1,2}(?!\d)(?:\s*[/.-]\s*\d{1,2}(?!\d))?/g, ' ')
    .replace(/(?:19|20)\d{2}\s*年\s*\d{1,2}\s*月(?:\s*\d{1,2}\s*日)?/g, ' ')
    .replace(/\d{1,2}\s*月(?:\s*\d{1,2}\s*日)?/g, ' ')
    .replace(/[A-Za-z_]+\d+[\w-]*/g, ' ')
    .replace(/^\s*(?:\d+[.)、]|[-*]\s)/gm, ' ')
}

function isYear(n, raw) {
  return !raw.includes('.') && n >= 1990 && n <= 2100
}

export function extractClaimNumbers(text) {
  const src = stripNonClaims(text)
  const out = []
  for (const m of src.matchAll(NUM_RE)) {
    const raw = m[0].replace(/,/g, '')
    const n = Number(raw)
    if (!Number.isFinite(n)) continue
    const before = src.slice(Math.max(0, m.index - 4), m.index)
    const after = src.slice(m.index + m[0].length, m.index + m[0].length + 3)
    if (isYear(Math.abs(n), raw)) continue
    if (/^\d{5,6}$/.test(raw)) continue
    if (COUNT_SUFFIX.test(after) && !raw.includes('.')) continue
    if (ORDINAL_PREFIX.test(before)) continue
    if (/[QH]$/i.test(before.trim())) continue
    out.push({ raw: m[0], value: n })
  }
  return out
}

function decimals(raw) {
  const i = raw.indexOf('.')
  return i < 0 ? 0 : raw.length - i - 1
}

function datasetValues(datasets) {
  const vals = []
  for (const ds of datasets) {
    for (const p of ds.data ?? []) if (typeof p.value === 'number') vals.push(p.value)
  }
  return vals
}

function grounded(num, values) {
  const tol = 0.5 * 10 ** -decimals(num.raw.replace(/,/g, '')) + 1e-9
  return values.some((v) => Math.abs(Math.abs(num.value) - Math.abs(v)) <= tol)
}

export function scoreNumbersGrounded({ texts, datasets }) {
  const numbers = texts.flatMap((t) => extractClaimNumbers(t))
  const values = datasetValues(datasets)
  const ungrounded = numbers.filter((n) => !grounded(n, values)).map((n) => n.raw)
  return {
    scorer: 'numbers_grounded',
    applicable: true,
    pass: ungrounded.length === 0,
    numbers: numbers.length,
    ungrounded,
    reasons: ungrounded.length ? [`正文数字无数据集依据：${ungrounded.slice(0, 8).join(', ')}`] : [],
  }
}
