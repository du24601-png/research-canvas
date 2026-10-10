/**
 * F1：解析质量（乱码 / 丢字检测）、PDFium 兜底、按 ~500 字切 chunk。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  measureTextQuality,
  isGarbledText,
  isWeakText,
  metricsFromParseResult,
  pickBetterResult,
  pickFallbackResult,
  shouldTryPdfFallback,
  buildPageChunks,
  rechunkMarkdown,
  pagesToParseResult,
  ParseRouter,
  createPdfiumL0Runner,
  PDFIUM_L0_ENGINE_VERSION,
  CHUNK_TARGET_CHARS,
} from '../packages/doc-library/dist/index.js'

const CLEAN_ZH = '本行2024年实现营业收入3,374.88亿元，同比下降0.48%；归属于本行股东的净利润1,483.91亿元，同比增长1.22%。'
  + '资产质量保持稳定，不良贷款率0.95%，拨备覆盖率411.98%。零售客户总数2.09亿户，管理零售客户总资产14.93万亿元。\n'

/** 模拟字体映射丢字：汉字全丢，只剩数字、标点与零星英文 */
const DROPPED_ZH = '2024A\n4\n\n2024\n\n(ROAE)14.49%129\n10%\n\n(FPA)\n6\n\n2(AUM)15\nAI+\n\n2025\n3,374.88 0.48% 1,483.91 1.22%\n'

const page = (n, text) => ({ page: n, text })
const repeatPages = (text, n) => Array.from({ length: n }, (_, i) => page(i + 1, text.repeat(3)))

describe('parse-quality garbled detection', () => {
  it('clean Chinese text is not garbled', () => {
    const q = measureTextQuality(CLEAN_ZH.repeat(5))
    assert.ok(q.letterRatio > 0.5, `letterRatio ${q.letterRatio}`)
    assert.ok(q.cjkRatio > 0.9)
    assert.equal(q.garbledScore, 0)
    assert.equal(isGarbledText(q), false)
  })

  it('dropped-CJK text (digits only) is low-density → try fallback, but not weak', () => {
    const result = pagesToParseResult(repeatPages(DROPPED_ZH, 10))
    const m = metricsFromParseResult(result)
    assert.ok(m.charCount / m.pageCount > 40, 'per-page chars alone would not flag it')
    assert.equal(m.lowTextDensity, true)
    assert.equal(shouldTryPdfFallback(m), true)
    assert.equal(isGarbledText(m), false)
    assert.equal(isWeakText(m), false, 'no OCR escalation just for low density')
  })

  it('financial statement page (CJK labels + many numbers) is not garbled or weak', () => {
    const rows = ['营业收入', '营业成本', '利息净收入', '手续费及佣金净收入', '归属于本行股东的净利润', '基本每股收益（元）']
      .map((k, i) => `| ${k} | ${(337488 + i * 1013).toLocaleString('en-US')}.00 | ${(339123 - i * 977).toLocaleString('en-US')}.00 | ${(i - 2.48).toFixed(2)}% |`)
    const table = ['| 项目 | 2024年 | 2023年 | 增减 |', '| --- | --- | --- | --- |', ...rows].join('\n')
    const result = pagesToParseResult(repeatPages(`${table}\n`, 6))
    const m = metricsFromParseResult(result)
    assert.ok((m.garbledScore ?? 0) < 0.5, `garbledScore ${m.garbledScore}`)
    assert.equal(isWeakText(m), false)
  })

  it('pure numeric table is not garbled or weak', () => {
    const line = '| 2024 | 3,374.88 | -0.48% | 1,483.91 | 1.22% | 14.49% |\n'
    const result = pagesToParseResult(repeatPages(line.repeat(5), 6))
    const m = metricsFromParseResult(result)
    assert.equal(m.garbledScore, 0)
    assert.equal(isWeakText(m), false)
  })

  it('pickFallbackResult keeps primary for numeric docs, takes fallback when CJK dominates', () => {
    const numeric = pagesToParseResult(repeatPages('| 2024 | 3,374.88 | 1.22% |\n'.repeat(8), 4))
    const numericFb = pagesToParseResult(repeatPages('| 2024 | 3,374.88 | 1.22% |\n'.repeat(9), 4))
    assert.equal(pickFallbackResult(numeric, numericFb), numeric)
    const dropped = pagesToParseResult(repeatPages(DROPPED_ZH, 4))
    const clean = pagesToParseResult(repeatPages(CLEAN_ZH, 4))
    assert.equal(pickFallbackResult(dropped, clean), clean)
  })

  it('replacement chars / private-use glyphs / (cid:N) are garbled', () => {
    const pua = '\ue001\ue002\ue003\ufffd 收入 '.repeat(60)
    assert.equal(isGarbledText(measureTextQuality(pua)), true)
    const cid = '(cid:123)(cid:45) Revenue (cid:9) '.repeat(40)
    assert.equal(isGarbledText(measureTextQuality(cid)), true)
  })

  it('mojibake (UTF-8 read as Latin-1) is garbled; English prose is not', () => {
    const moji = 'Ã¤Â¸Â­Ã¥â€ºÂ½Ã©â€œÂ¶Ã¨Â¡Å’ '.repeat(30)
    assert.equal(isGarbledText(measureTextQuality(moji)), true)
    const en = 'Net interest income rose 3.2% year on year, driven by loan growth. '.repeat(10)
    assert.equal(isGarbledText(measureTextQuality(en)), false)
  })

  it('pickBetterResult prefers non-garbled even with fewer chars', () => {
    const garbled = pagesToParseResult(repeatPages('� 收入 '.repeat(80), 10))
    const clean = pagesToParseResult(repeatPages(CLEAN_ZH, 3))
    assert.equal(pickBetterResult(garbled, clean), clean)
    assert.equal(pickBetterResult(clean, garbled), clean)
  })
})

describe('ParseRouter pdfFallback', () => {
  const runner = (version, result) => ({
    engineId: 'pdf-extract-l0',
    engineVersion: version,
    async run() { return result },
  })

  it('tries fallback when primary is garbled and picks the clean one', async () => {
    const router = new ParseRouter({
      pdf: runner('primary', pagesToParseResult(repeatPages(DROPPED_ZH, 4))),
      pdfFallback: runner('fallback', pagesToParseResult(repeatPages(CLEAN_ZH, 4))),
      ocr: null,
    })
    const out = await router.run(Buffer.from('%PDF-'), { kind: 'pdf' })
    assert.equal(out.usedEngineVersion, 'fallback')
  })

  it('skips fallback when primary is good', async () => {
    let called = false
    const router = new ParseRouter({
      pdf: runner('primary', pagesToParseResult(repeatPages(CLEAN_ZH, 4))),
      pdfFallback: { engineId: 'pdf-extract-l0', engineVersion: 'fb', async run() { called = true; return pagesToParseResult([]) } },
      ocr: null,
    })
    const out = await router.run(Buffer.from('%PDF-'), { kind: 'pdf' })
    assert.equal(out.usedEngineVersion, 'primary')
    assert.equal(called, false)
  })
})

const CMB = 'D:\\finframe-data\\eval-corpus\\600036_cmb_2024_annual.pdf'
const cjkCount = s => (s.match(/[\u4e00-\u9fff]/g) ?? []).length

describe('CMB 2024 annual report: pdfium fallback', { skip: !fs.existsSync(CMB) && 'CMB eval PDF absent' }, () => {
  it('router falls back to pdfium and >50% pages have >100 CJK chars', async () => {
    const { extractPdfToMarkdown } = await import('../packages/agent/dist/pdf-extract.js')
    const primary = {
      engineId: 'pdf-extract-l0',
      engineVersion: 'pdf-parse-test',
      async run(blob) {
        const r = await extractPdfToMarkdown(blob)
        return pagesToParseResult(r.pages.map(p => ({ page: p.page, text: p.text })))
      },
    }
    const router = new ParseRouter({
      pdf: primary,
      pdfFallback: createPdfiumL0Runner({ embeddedImageOcr: false }),
      ocr: null,
    })
    const out = await router.run(fs.readFileSync(CMB), { kind: 'pdf', filename: 'cmb.pdf' })
    assert.equal(out.usedEngineVersion, PDFIUM_L0_ENGINE_VERSION)
    const pages = out.markdown.split(/<!--\s*page:\d+\s*-->/).slice(1)
    const rich = pages.filter(p => cjkCount(p) > 100).length
    assert.ok(rich / out.pageCount > 0.5, `${rich}/${out.pageCount} pages rich in CJK`)
    assert.equal(isWeakText(metricsFromParseResult(out)), false)
  })
})

describe('buildPageChunks (~500 chars, overlap, pages, tables)', () => {
  const longZh = CLEAN_ZH.repeat(20)

  it('chunks stay near target, never cross pages, break at sentence ends', () => {
    const chunks = buildPageChunks([page(1, longZh), page(2, longZh)])
    assert.ok(chunks.length >= 8)
    for (const c of chunks) {
      assert.ok(c.text.length <= CHUNK_TARGET_CHARS, `chunk len ${c.text.length}`)
      assert.ok(/[。；]$/.test(c.text),`ends mid-sentence: …${c.text.slice(-10)}`)
    }
    assert.ok(chunks.filter(c => c.page === 1).length >= 4)
    const pageText = longZh.trim()
    for (const c of chunks.filter(x => x.page === 1)) assert.ok(pageText.includes(c.text))
    const avg = chunks.reduce((n, c) => n + c.text.length, 0) / chunks.length
    assert.ok(avg > CHUNK_TARGET_CHARS * 0.5, `avg ${avg}`)
  })

  it('consecutive chunks on the same page overlap (~15%)', () => {
    const chunks = buildPageChunks([page(1, longZh)])
    const [a, b] = chunks
    assert.ok(a && b)
    const tail = a.text.slice(-30)
    assert.ok(b.text.includes(tail.slice(-20)), 'second chunk should start with the tail of the first')
    assert.ok(b.offset < a.offset + a.text.length, 'offsets overlap')
  })

  it('offsets point at the chunk text in the page', () => {
    const text = '前言。\n\n' + longZh
    const chunks = buildPageChunks([page(1, text)])
    for (const c of chunks) assert.equal(text.trim().slice(c.offset, c.offset + c.text.length), c.text)
  })

  it('keeps a table block together when ≤ 2× target', () => {
    const rows = Array.from({ length: 20 }, (_, i) => `| 项目${i} | ${i * 100}.00 | ${i}.5% |`)
    const table = ['| 项目 | 金额 | 占比 |', '| --- | --- | --- |', ...rows].join('\n')
    assert.ok(table.length > CHUNK_TARGET_CHARS && table.length <= CHUNK_TARGET_CHARS * 2)
    const chunks = buildPageChunks([page(1, `说明文字。\n${table}\n后记。`)])
    const holding = chunks.filter(c => c.text.includes('| 项目 | 金额 | 占比 |'))
    assert.equal(holding.length, 1)
    assert.ok(holding[0].text.includes('| 项目19 |'))
  })

  it('splits a long table by rows and repeats the header', () => {
    const rows = Array.from({ length: 80 }, (_, i) => `| 项目${i} | ${i * 100}.00 | ${i}.5% |`)
    const header = '| 项目 | 金额 | 占比 |\n| --- | --- | --- |'
    const chunks = buildPageChunks([page(3, `${header}\n${rows.join('\n')}`)])
    assert.ok(chunks.length >= 3)
    for (const c of chunks) {
      assert.equal(c.page, 3)
      assert.ok(c.text.startsWith(header), 'each piece repeats the header')
      assert.ok(c.text.length <= CHUNK_TARGET_CHARS)
    }
    const all = chunks.map(c => c.text).join('\n')
    for (let i = 0; i < 80; i++) assert.ok(all.includes(`| 项目${i} |`))
  })

  it('does not repeat a "header" when the table has no --- separator', () => {
    const rows = Array.from({ length: 80 }, (_, i) => `| 项目${i} | ${i * 100}.00 | ${i}.5% |`)
    const chunks = buildPageChunks([page(1, rows.join('\n'))])
    assert.ok(chunks.length >= 3)
    assert.equal(chunks.filter(c => c.text.includes('| 项目0 |')).length, 1)
    const all = chunks.map(c => c.text).join('\n')
    for (let i = 0; i < 80; i++) assert.ok(all.includes(`| 项目${i} |`))
  })

  it('short pages give one chunk each; empty pages skipped; no prefix added', () => {
    const chunks = buildPageChunks([page(1, '第一页。'), page(2, '  '), page(3, '第三页。')])
    assert.deepEqual(chunks.map(c => [c.page, c.text]), [[1, '第一页。'], [3, '第三页。']])
  })

  it('rechunkMarkdown splits stored markdown by page markers', () => {
    const md = pagesToParseResult([page(1, longZh), page(2, '第二页。')]).markdown
    const chunks = rechunkMarkdown(md)
    assert.ok(chunks.some(c => c.page === 2 && c.text === '第二页。'))
    assert.ok(chunks.every(c => !c.text.includes('<!--')))
  })
})
