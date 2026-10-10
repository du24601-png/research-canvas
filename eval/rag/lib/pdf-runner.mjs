/**
 * 与 packages/agent/src/doc-library-bridge.ts 中 pdfExtractL0Runner + buildParseRouter 等价的解析器
 * （bridge 模块加载即连线生产单例与会话附件，故不直接 import；逻辑保持一字不差，改动请同步）。
 */
import {
  ParseRouter,
  createTextL0Runner,
  createOfficeL0Runner,
  createOcrL2Runner,
  enhancePagesWithEmbeddedImageOcr,
  pagesToParseResult,
} from '../../../packages/doc-library/dist/index.js'
import { extractPdfToMarkdown } from '../../../packages/agent/dist/pdf-extract.js'

/** @param {(pages: Array<{page:number,text:string}>) => void} [onPages] 记录送入切块前的逐页文本 */
export function createPdfRunner(onPages) {
  return {
    engineId: 'pdf-extract-l0',
    engineVersion: '1.0.0',
    async run(blob, opts) {
      opts?.onProgress?.({ phase: 'extracting', message: '正在整理…' })
      const result = await extractPdfToMarkdown(blob)
      const pages = result.pages.map(p => ({
        page: p.page,
        text: [p.text, ...p.tablesMd].filter(Boolean).join('\n\n').trim(),
      }))
      const enhanced = await enhancePagesWithEmbeddedImageOcr(blob, pages, {
        format: 'pdf',
        onProgress: opts?.onProgress,
      })
      onPages?.(enhanced)
      const rebuilt = pagesToParseResult(enhanced)
      if (rebuilt.charCount > 0) {
        return { ...rebuilt, pageCount: Math.max(rebuilt.pageCount, result.pageCount) }
      }
      const emptyPages = result.pages.filter(p => !p.text.trim() && p.tablesMd.length === 0).length
      const emptyPageRatio = result.pageCount > 0 ? emptyPages / result.pageCount : 1
      return {
        pageCount: result.pageCount,
        charCount: result.charCount,
        markdown: result.markdown,
        emptyPageRatio,
        chunks: result.chunks.map(c => ({ page: c.page, offset: c.offset, text: c.text })),
      }
    },
  }
}

export function buildParseRouter(onPages) {
  return new ParseRouter({
    text: createTextL0Runner(),
    office: createOfficeL0Runner(),
    pdf: createPdfRunner(onPages),
    ocr: createOcrL2Runner(),
  })
}
