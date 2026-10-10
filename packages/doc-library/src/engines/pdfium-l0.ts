/**
 * pdfium-l0：用 PDFium（WASM，本地运行、无网络）逐页读取 PDF 文本层。
 * 作为基础整理的兜底：常规抽取丢字 / 乱码时（如部分银行年报的字体映射），
 * PDFium 往往能正确读出中文。输出与 pdf-extract-l0 相同：`<!-- page:N -->` 分页 + 同形 ParseRunResult。
 * engineId 仍为 'pdf-extract-l0'（同属 L0 基础整理），用 engineVersion 区分来源。
 */
import type { ParseRunOpts, ParseRunResult, ParseRunner } from '../types.js'
import { isGarbledText, metricsFromParseResult } from '../parse-quality.js'
import {
  enhancePagesWithEmbeddedImageOcr,
  pagesToParseResult,
  type PageText,
} from './embedded-images/index.js'

export const PDFIUM_L0_ENGINE_VERSION = 'pdfium-l0-1.0.0'

export type PdfiumL0Options = {
  /** 文本层可用时是否再做页内嵌图 OCR（默认 true；OCR 未就绪时自动跳过） */
  embeddedImageOcr?: boolean
}

/** 规整 PDFium 文本：统一换行、去控制字符、压缩多余空行 */
export function normalizePdfiumText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f­￾]/g, '')
    .replace(/[ \t ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 逐页读取文本；单页失败记为空页，不中断整份文档 */
export async function extractPdfPagesWithPdfium(blob: Buffer): Promise<PageText[]> {
  const { PDFiumLibrary } = await import('@hyzyla/pdfium')
  const library = await PDFiumLibrary.init()
  try {
    // 视图而非拷贝：大文件不再多占一份内存
    const document = await library.loadDocument(
      new Uint8Array(blob.buffer, blob.byteOffset, blob.byteLength),
    )
    try {
      const pages: PageText[] = []
      const pageCount = document.getPageCount()
      for (let i = 0; i < pageCount; i++) {
        let text = ''
        try {
          text = normalizePdfiumText(document.getPage(i).getText())
        } catch {
          text = ''
        }
        pages.push({ page: i + 1, text })
      }
      return pages
    } finally {
      document.destroy()
    }
  } finally {
    library.destroy()
  }
}

async function runPdfiumL0(
  blob: Buffer,
  opts: ParseRunOpts | undefined,
  options: PdfiumL0Options,
): Promise<ParseRunResult> {
  opts?.onProgress?.({ phase: 'extracting', message: '正在重新整理文字…' })
  const pages = await extractPdfPagesWithPdfium(blob)
  const textOnly = pagesToParseResult(pages)
  if (textOnly.charCount <= 0 || pages.every(p => !p.text)) {
    return { ...textOnly, error: textOnly.error ?? '未能从该文档提取到可读文本' }
  }
  // 文本层本身乱码时不再花时间做图内 OCR（交给后续扫描件识别）
  if (options.embeddedImageOcr === false || isGarbledText(metricsFromParseResult(textOnly))) {
    return textOnly
  }
  const enhanced = await enhancePagesWithEmbeddedImageOcr(blob, pages, {
    format: 'pdf',
    onProgress: opts?.onProgress,
  })
  const rebuilt = pagesToParseResult(enhanced)
  return rebuilt.charCount > 0
    ? { ...rebuilt, pageCount: Math.max(rebuilt.pageCount, pages.length) }
    : textOnly
}

/** PDFium 文本层兜底 runner（ParseRouter 的 pdfFallback） */
export function createPdfiumL0Runner(options: PdfiumL0Options = {}): ParseRunner {
  return {
    engineId: 'pdf-extract-l0',
    engineVersion: PDFIUM_L0_ENGINE_VERSION,
    async run(blob, opts) {
      try {
        return await runPdfiumL0(blob, opts, options)
      } catch {
        return {
          pageCount: 0,
          charCount: 0,
          markdown: '',
          chunks: [],
          emptyPageRatio: 1,
          error: '未能从该文档提取到可读文本',
        }
      }
    },
  }
}
