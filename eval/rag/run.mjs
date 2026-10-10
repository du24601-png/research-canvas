#!/usr/bin/env node
/**
 * E3 检索评测编排：每组（同一嵌入模型）一个子进程、一次全新入库（数据根 EVAL_WORK_DIR/<group>），
 * 组内 vec / hybrid（或两种 FTS）共享索引；嵌入模型按进程选择，互不污染。
 * 用法：
 *   node eval/rag/run.mjs                      # 跑全部可用配置
 *   node eval/rag/run.mjs fts bge            # 按组（fts / e5 / bge / qwen3）或配置名筛选
 * env：EVAL_WORK_DIR（默认 D:/finframe-data/eval-work）、EVAL_CORPUS_DIR、DOC_LIBRARY_MODELS_DIR（默认 D:/finframe-data/models）
 * 结果：eval/rag/records/<timestamp>.json；Markdown 汇总打印到 stdout。
 * 前置：node eval/rag/fetch-corpus.mjs → node eval/rag/parse-pages.mjs → node eval/rag/build-questions.mjs
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { summarize, markdown } from './lib/report.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const WORK = process.env.EVAL_WORK_DIR ?? 'D:/finframe-data/eval-work'
const MODELS = process.env.DOC_LIBRARY_MODELS_DIR ?? 'D:/finframe-data/models'

/** 每组一个子进程、一次入库；组内各检索方式共享索引 */
const GROUPS = [
  { name: 'fts', configs: [['fts_unicode61', 'fts_unicode61'], ['fts_trigram', 'fts']] },
  { name: 'e5', model: 'multilingual-e5-small', configs: [['vec_e5', 'vec'], ['hybrid_trigram_e5', 'hybrid']] },
  { name: 'bge', model: 'bge-small-zh-v1.5', configs: [['vec_bge', 'vec'], ['hybrid_trigram_bge', 'hybrid']] },
  { name: 'qwen3', model: 'Qwen3-Embedding-0.6B', configs: [['vec_qwen3', 'vec'], ['hybrid_trigram_qwen3', 'hybrid']] },
]

const REQUIRED = ['config.json', 'tokenizer.json', 'onnx/model_quantized.onnx']
const modelPresent = id => REQUIRED.every(f => existsSync(path.join(MODELS, id, f)))

function runChild(group, outJson) {
  const dataDir = path.join(WORK, group.name)
  const env = {
    ...process.env,
    RESEARCH_CANVAS_DATA_DIR: dataDir,
    DOC_LIBRARY_EMBEDDING_MODEL: group.model ?? 'multilingual-e5-small',
    // FTS 组：模型目录指向空目录，确保不会意外加载任何向量模型
    DOC_LIBRARY_MODELS_DIR: group.model ? MODELS : path.join(WORK, '_no_models'),
  }
  const specs = group.configs.map(([n, k]) => `${n}:${k}`)
  const args = [path.join(HERE, 'run-config.mjs'), group.model ? '1' : '0', outJson, ...specs]
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: ['ignore', 'inherit', 'inherit'] })
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`${group.name} exited ${code}`))))
  })
}

async function main() {
  const wanted = process.argv.slice(2)
  const list = GROUPS.filter(g => !wanted.length || wanted.includes(g.name) || g.configs.some(([c]) => wanted.includes(c)))
  const results = []
  const skipped = []
  for (const group of list) {
    if (group.model && !modelPresent(group.model)) {
      for (const [c] of group.configs) skipped.push({ config: c, reason: `model files missing under ${MODELS}/${group.model}` })
      console.error(`[skip] ${group.name}: model ${group.model} not found`)
      continue
    }
    const dataDir = path.join(WORK, group.name)
    await rm(dataDir, { recursive: true, force: true })
    await mkdir(dataDir, { recursive: true })
    const outJson = path.join(dataDir, 'result.json')
    try {
      await runChild(group, outJson)
      for (const r of JSON.parse(await readFile(outJson, 'utf8'))) results.push({ ...r, summary: summarize(r) })
    } catch (e) {
      for (const [c] of group.configs) skipped.push({ config: c, reason: String(e?.message ?? e) })
      console.error(`[fail] ${group.name}: ${e?.message ?? e}`)
    }
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  await mkdir(path.join(HERE, 'records'), { recursive: true })
  const record = {
    createdAt: new Date().toISOString(), node: process.version, questions: 'eval/rag/questions.json',
    limit: 20, skipped, results,
  }
  const recPath = path.join(HERE, 'records', `${stamp}.json`)
  await writeFile(recPath, JSON.stringify(record, null, 1))
  console.log(markdown(results))
  if (skipped.length) console.log(`\nSkipped: ${skipped.map(s => `${s.config} (${s.reason})`).join('; ')}`)
  console.log(`\nrecord -> ${path.relative(process.cwd(), recPath)}`)
}

main().catch(e => { console.error(e); process.exit(1) })
