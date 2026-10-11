#!/usr/bin/env node
/**
 * 单次入库 + 若干检索方式评测（子进程）：由 run.mjs 设置 RESEARCH_CANVAS_DATA_DIR / DOC_LIBRARY_EMBEDDING_MODEL 等 env 后调用。
 * 用法：node eval/rag/run-config.mjs <wantVectors 0|1> <outJson> <name:kind> [<name:kind> ...]
 * 同一模型的 vec / hybrid 共用一次入库，入库耗时与索引体积对二者相同（结果里 ingest.sharedWith 标明）。
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ingestCorpus, indexSizes, getVectorStore, SESSION_ID } from './lib/ingest.mjs'
import { makeRetriever, vectorTop1 } from './lib/retrievers.mjs'
import { scoreQuestion, hitsToPages, percentile } from './lib/metrics.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const [wantVecRaw, outJson, ...specs] = process.argv.slice(2)
const configs = specs.map(s => { const [name, kind] = s.split(':'); return { name, kind } })
const wantVectors = wantVecRaw === '1'
const CORPUS = process.env.EVAL_CORPUS_DIR ?? 'D:/finframe-data/eval-corpus'
const MODES = ['question', 'keywords']

let peakRss = 0
const rssTimer = setInterval(() => { peakRss = Math.max(peakRss, process.memoryUsage().rss) }, 200)

function tableSizes(db) {
  try {
    const rows = db.prepare('SELECT name, SUM(pgsize) AS bytes FROM dbstat GROUP BY name').all()
    const pick = prefix => rows.filter(r => r.name.startsWith(prefix)).reduce((a, r) => a + r.bytes, 0)
    return { fts_unicode61: pick('fts_chunks') - pick('fts_chunks_tri'), fts_trigram: pick('fts_chunks_tri'), chunks: pick('chunks') }
  } catch {
    return null
  }
}

async function runQuestions(ctx, retrieve, questions) {
  const rows = []
  const lat = { question: [], keywords: [] }
  for (const q of questions) {
    const opts = { scope: q.scope, attachmentId: q.docs[0] }
    for (const mode of MODES) {
      const text = mode === 'question' ? q.question : q.query_keywords
      const t0 = performance.now()
      const res = await retrieve(text, opts)
      const hits = res.hits
      const ms = performance.now() - t0
      lat[mode].push(ms)
      const ranked = hitsToPages(hits, ctx.keyByDocId)
      rows.push({
        id: q.id, type: q.type, scope: q.scope, mode, parse_gap: Boolean(q.parse_gap),
        doc: q.docs.length === 1 ? q.docs[0] : null, found: res.found, reason: res.reason ?? null,
        natural: hits.some(h => h.match === 'natural'),
        hitCount: hits.length, top1Score: hits[0] ? (hits[0].score ?? hits[0].rank ?? null) : null,
        vecTop1: await vectorTop1(ctx, text, opts),
        top: ranked.slice(0, 10).map(r => `${r.doc}:${r.page}`), ms: Math.round(ms * 10) / 10,
        m: q.gold.length ? scoreQuestion(ranked, q.gold) : null,
      })
    }
  }
  return { rows, lat }
}

async function evaluate(ctx, questions, { name, kind }, shared) {
  peakRss = process.memoryUsage().rss
  // 预热一次（模型加载 / Lance 打开不计入查询延迟）
  await makeRetriever(kind, ctx)('预热', { scope: 'library' })
  const { rows, lat } = await runQuestions(ctx, makeRetriever(kind, ctx), questions)
  console.error(`[${name}] done: ${rows.length} rows`)
  return {
    config: name, kind, wantVectors,
    model: wantVectors ? (process.env.DOC_LIBRARY_EMBEDDING_MODEL ?? 'multilingual-e5-small') : null,
    ingest: shared.ingest, index: shared.index,
    latencyMs: Object.fromEntries(MODES.map(m => [m, { p50: percentile(lat[m], 50), p95: percentile(lat[m], 95), n: lat[m].length }])),
    peakRssBytes: Math.max(peakRss, shared.ingestPeakRss),
    maxRssResourceKB: process.resourceUsage().maxRSS,
    rows,
  }
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(CORPUS, 'manifest.json'), 'utf8'))
  const questions = JSON.parse(await readFile(path.join(HERE, 'questions.json'), 'utf8')).items
  const ing = await ingestCorpus({ corpusDir: CORPUS, docs: manifest.docs, wantVectors })
  const ingestPeakRss = peakRss
  const svc = ing.svc
  const db = svc.getRepository().db
  const ctx = {
    svc, db, sessionId: SESSION_ID,
    docIdByKey: new Map(ing.perDoc.map(d => [d.key, d.documentId])),
    keyByDocId: new Map(ing.perDoc.map(d => [d.documentId, d.key])),
    allDocIds: ing.perDoc.map(d => d.documentId),
    pageByChunk: new Map(db.prepare('SELECT id, page FROM chunks').all().map(r => [r.id, r.page])),
    vectorStore: getVectorStore(),
    vectorReady: wantVectors && svc.getEmbeddingService().isReady(),
    modelId: wantVectors ? process.env.DOC_LIBRARY_EMBEDDING_MODEL : null,
  }
  if (wantVectors && !ctx.vectorReady) throw new Error('embedding model not ready — check DOC_LIBRARY_EMBEDDING_MODEL / DOC_LIBRARY_MODELS_DIR')
  const shared = {
    ingest: { totalMs: ing.ingestMs, perDoc: ing.perDoc, sharedWith: configs.map(c => c.name) },
    index: { ...(await indexSizes(db)), tables: tableSizes(db) },
    ingestPeakRss,
  }
  const out = []
  for (const cfg of configs) out.push(await evaluate(ctx, questions, cfg, shared))
  clearInterval(rssTimer)
  await writeFile(outJson, JSON.stringify(out))
}

main().then(() => process.exit(0), e => { console.error(e); process.exit(1) })
