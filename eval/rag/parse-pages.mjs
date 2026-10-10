#!/usr/bin/env node
/**
 * 用产品同款解析器（ParseRouter + pdf-extract-l0）抽逐页文本，写 eval-work/pages/<key>.json。
 * 用法：node eval/rag/parse-pages.mjs [corpusDir] [outDir]
 * 注意：需先设置 RESEARCH_CANVAS_DATA_DIR 指向评测目录（解析器会探测 OCR 可用性）。
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { buildParseRouter } from './lib/pdf-runner.mjs'

const CORPUS = process.argv[2] ?? 'D:/finframe-data/eval-corpus'
const OUT = process.argv[3] ?? 'D:/finframe-data/eval-work/pages'

const manifest = JSON.parse(await readFile(path.join(CORPUS, 'manifest.json'), 'utf8'))
await mkdir(OUT, { recursive: true })
for (const d of manifest.docs) {
  let pages = []
  const router = buildParseRouter(p => { pages = p })
  const blob = await readFile(path.join(CORPUS, d.file))
  const t0 = Date.now()
  const res = await router.run(blob, { kind: 'pdf', mime: 'application/pdf', filename: d.file })
  await writeFile(path.join(OUT, `${d.key}.json`), JSON.stringify({
    key: d.key, name: d.name, file: d.file, pageCount: res.pageCount, engine: res.usedEngineId,
    chunkCount: res.chunks.length, pages,
  }))
  console.log(`${d.name}: ${res.pageCount} pages, ${res.chunks.length} chunks, ${res.charCount} chars, ${res.usedEngineId}, ${Date.now() - t0}ms`)
}
