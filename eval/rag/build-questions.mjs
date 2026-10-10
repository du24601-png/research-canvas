#!/usr/bin/env node
/**
 * 合并 eval/rag/questions-src/*.json → eval/rag/questions.json，并自动核验：
 * - 每条证据片段（去空白后）必须出现在其金标页上；
 * - 无答案题的关键实体不得出现在语料任何一页；
 * - 招商银行（cmb）的产品解析结果几乎不含中文（字体无 ToUnicode），证据改用 pdfium 参考文本核验，
 *   并标记 parse_gap=true（页码与产品一致，但产品索引里检索不到这些文字）。
 * 用法：node eval/rag/build-questions.mjs [pagesDir]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PAGES = process.argv[2] ?? 'D:/finframe-data/eval-work/pages'
const DOCS = ['moutai', 'catl', 'byd', 'midea', 'cmb', 'pingan']
const strip = s => s.replace(/\s+/g, '')

function loadPages(key) {
  const prod = JSON.parse(readFileSync(path.join(PAGES, `${key}.json`), 'utf8')).pages
  const refFile = path.join(PAGES, `${key}.pdfium.json`)
  const ref = existsSync(refFile) ? JSON.parse(readFileSync(refFile, 'utf8')).pages : null
  const map = pages => new Map(pages.map(p => [p.page, strip(p.text)]))
  return { prod: map(prod), ref: ref ? map(ref) : null }
}

const pages = Object.fromEntries(DOCS.map(k => [k, loadPages(k)]))
const errors = []

/** 返回证据所在金标页；prod 未命中但参考文本命中时返回 {page, gap:true} */
function locate(doc, pagesList, ev) {
  const needle = strip(ev)
  for (const p of pagesList) if (pages[doc].prod.get(p)?.includes(needle)) return { page: p, gap: false }
  if (pages[doc].ref) for (const p of pagesList) if (pages[doc].ref.get(p)?.includes(needle)) return { page: p, gap: true }
  return null
}

function single(doc, src, i) {
  const loc = locate(doc, src.g, src.ev)
  if (!loc) errors.push(`${doc}#${i + 1} evidence not on gold pages ${src.g}: ${src.ev}`)
  return {
    id: `${doc}-${String(i + 1).padStart(2, '0')}`, docs: [doc], scope: 'document', type: src.t,
    question: src.q, query_keywords: src.kw, gold: [{ doc, pages: src.g }],
    evidence: [{ doc, page: loc?.page ?? null, text: src.ev }], ...(loc?.gap ? { parse_gap: true } : {}),
  }
}

function cross(src, i) {
  const docs = Object.keys(src.g)
  const evidence = docs.map(doc => {
    const loc = locate(doc, src.g[doc], src.ev[doc])
    if (!loc) errors.push(`cross#${i + 1} ${doc} evidence not on gold pages ${src.g[doc]}: ${src.ev[doc]}`)
    return { doc, page: loc?.page ?? null, text: src.ev[doc], ...(loc?.gap ? { parse_gap: true } : {}) }
  })
  return {
    id: `cross-${String(i + 1).padStart(2, '0')}`, docs, scope: 'library', type: src.t,
    question: src.q, query_keywords: src.kw, gold: docs.map(doc => ({ doc, pages: src.g[doc] })), evidence,
    ...(evidence.some(e => e.parse_gap) ? { parse_gap: true } : {}),
  }
}

function none(src, i) {
  for (const term of src.absent) {
    const t = strip(term)
    for (const doc of DOCS) {
      for (const m of [pages[doc].prod, pages[doc].ref]) {
        if (!m) continue
        for (const [p, text] of m) if (text.includes(t)) errors.push(`none#${i + 1} "${term}" appears in ${doc} p${p}`)
      }
    }
  }
  return {
    id: `none-${String(i + 1).padStart(2, '0')}`, docs: [], scope: 'library', type: src.t,
    question: src.q, query_keywords: src.kw, gold: [], absent_terms: src.absent,
  }
}

const src = name => JSON.parse(readFileSync(path.join(HERE, 'questions-src', `${name}.json`), 'utf8'))
const items = [
  ...DOCS.flatMap(doc => src(doc).map((s, i) => single(doc, s, i))),
  ...src('cross').map(cross),
  ...src('none').map(none),
]
const counts = items.reduce((m, q) => ({ ...m, [q.type]: (m[q.type] ?? 0) + 1 }), {})
if (errors.length) {
  console.error(errors.join('\n'))
  console.error(`${errors.length} verification error(s); questions.json NOT written`)
  process.exit(1)
}
writeFileSync(path.join(HERE, 'questions.json'), JSON.stringify({
  version: 1,
  note: 'gold pages are 1-based PDF page numbers (same as doc-library chunk.page). evidence verified whitespace-insensitively; parse_gap = evidence only found in pdfium reference text, not in the product parser output.',
  counts, items,
}, null, 1))
console.log(`questions.json: ${items.length} items`, counts, `parse_gap: ${items.filter(q => q.parse_gap).length}`)
