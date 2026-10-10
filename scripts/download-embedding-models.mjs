#!/usr/bin/env node
/**
 * Download ONNX embedding models for doc-library (transformers.js layout).
 *
 *   node scripts/download-embedding-models.mjs [bge-small-zh-v1.5] [Qwen3-Embedding-0.6B] ...
 *
 * Env:
 *   DOC_LIBRARY_MODELS_DIR  destination root (required unless --dest is given)
 *   DOC_LIBRARY_HF_BASES    comma list of HF-compatible bases (default hf-mirror.com, huggingface.co)
 *   --dest <dir>            same as DOC_LIBRARY_MODELS_DIR
 * Proxy: HTTPS_PROXY/HTTP_PROXY are honoured on Node >= 24.5.
 * Files already present with the expected size are skipped.
 */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const COMMON = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json']

/** local dir name -> { repo, files } ; weights are q8 (onnx/model_quantized.onnx) only */
export const MODELS = {
  'bge-small-zh-v1.5': {
    repo: 'Xenova/bge-small-zh-v1.5',
    files: [...COMMON, 'vocab.txt', 'onnx/model_quantized.onnx'],
  },
  'Qwen3-Embedding-0.6B': {
    repo: 'onnx-community/Qwen3-Embedding-0.6B-ONNX',
    files: [...COMMON, 'vocab.json', 'merges.txt', 'added_tokens.json', 'onnx/model_quantized.onnx'],
  },
}

const TIMEOUT_MS = 60_000 // per-request connect + idle window
const log = (...a) => console.log(...a)

function parseArgs(argv) {
  const names = []
  let dest = process.env.DOC_LIBRARY_MODELS_DIR?.trim() || ''
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dest') dest = argv[++i] ?? ''
    else names.push(argv[i])
  }
  return { names: names.length ? names : Object.keys(MODELS), dest }
}

function bases() {
  const raw = process.env.DOC_LIBRARY_HF_BASES?.trim()
  const list = raw ? raw.split(',') : ['https://hf-mirror.com', 'https://huggingface.co']
  return list.map(s => s.trim().replace(/\/$/, '')).filter(Boolean)
}

/** HEAD content-length is unreliable on the mirror (redirect body); the GET content-length check in fetchOnce is the fallback. */
async function remoteSize(url) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctl.signal })
    if (!res.ok) return null
    const n = Number(res.headers.get('x-linked-size'))
    return Number.isFinite(n) && n > 0 ? n : null
  } finally {
    clearTimeout(t)
  }
}

class FatalHttpError extends Error {}

function looksLikeHtml(file) {
  const fd = fs.openSync(file, 'r')
  try {
    const buf = Buffer.alloc(256)
    const n = fs.readSync(fd, buf, 0, 256, 0)
    const head = buf.toString('utf8', 0, n).trimStart().toLowerCase()
    return head.startsWith('<!doctype') || head.startsWith('<html')
  } finally {
    fs.closeSync(fd)
  }
}

/** One attempt; resumes from the .part file via Range. Keeps the part file on retryable failure. */
async function fetchOnce(url, tmp) {
  const have = fs.existsSync(tmp) ? fs.statSync(tmp).size : 0
  const ctl = new AbortController()
  let timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  const reset = () => {
    clearTimeout(timer)
    timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  }
  try {
    const headers = have > 0 ? { Range: `bytes=${have}-` } : {}
    const res = await fetch(url, { redirect: 'follow', signal: ctl.signal, headers })
    if (res.status === 416) {
      fs.rmSync(tmp, { force: true })
      throw new Error('HTTP 416, restarting from 0')
    }
    if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
      throw new FatalHttpError(`HTTP ${res.status}`)
    }
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
    if ((res.headers.get('content-type') ?? '').toLowerCase().includes('text/html')) {
      throw new FatalHttpError('got text/html instead of a model file')
    }
    const resumed = have > 0 && res.status === 206
    const src = Readable.fromWeb(res.body)
    src.on('data', reset)
    await pipeline(src, fs.createWriteStream(tmp, { flags: resumed ? 'a' : 'w' }))
    const cl = Number(res.headers.get('content-length'))
    const expect = resumed ? have + cl : cl
    if (Number.isFinite(cl) && cl > 0 && fs.statSync(tmp).size !== expect) throw new Error('truncated download')
  } finally {
    clearTimeout(timer)
  }
}

async function fetchTo(url, target, want) {
  const tmp = `${target}.part`
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  let last
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      await fetchOnce(url, tmp)
      if (!target.endsWith('.html') && looksLikeHtml(tmp)) {
        fs.rmSync(tmp, { force: true })
        throw new FatalHttpError('body looks like HTML, not a model file')
      }
      const size = fs.statSync(tmp).size
      if (want && size !== want) {
        fs.rmSync(tmp, { force: true })
        throw new Error(`size mismatch ${size} != ${want}`)
      }
      fs.renameSync(tmp, target)
      return
    } catch (err) {
      last = err
      log(`  attempt ${attempt} failed: ${err instanceof Error ? err.message : err}`)
      if (err instanceof FatalHttpError) throw err
      await sleep(Math.min(30_000, 1000 * 2 ** (attempt - 1)))
    }
  }
  throw last
}

async function downloadFile(repo, file, dir) {
  const target = path.join(dir, file)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  for (const base of bases()) {
    const url = `${base}/${repo}/resolve/main/${file}`
    try {
      const want = await remoteSize(url)
      if (want && fs.existsSync(target) && fs.statSync(target).size === want) {
        log(`skip   ${file} (${want} bytes already present)`)
        return
      }
      await fetchTo(url, target, want)
      const got = fs.statSync(target).size
      if (want && got !== want) throw new Error(`size mismatch ${got} != ${want}`)
      if (file.endsWith('.json') && got < 2) throw new Error('empty json')
      log(`ok     ${file} ${got} bytes <- ${new URL(base).host}`)
      return
    } catch (err) {
      log(`retry  ${file} via ${new URL(base).host}: ${err instanceof Error ? err.message : err}`)
    }
  }
  throw new Error(`all sources failed for ${repo}/${file}`)
}

async function main() {
  if (typeof http.setGlobalProxyFromEnv === 'function') http.setGlobalProxyFromEnv()
  const { names, dest } = parseArgs(process.argv.slice(2))
  if (!dest) {
    console.error('Set DOC_LIBRARY_MODELS_DIR or pass --dest <dir>')
    process.exit(2)
  }
  for (const name of names) {
    const spec = MODELS[name]
    if (!spec) {
      console.error(`unknown model ${name}; known: ${Object.keys(MODELS).join(', ')}`)
      process.exit(2)
    }
    const dir = path.join(path.resolve(dest), name)
    log(`== ${name} <- ${spec.repo} -> ${dir}`)
    for (const f of spec.files) {
      try {
        await downloadFile(spec.repo, f, dir)
      } catch (err) {
        if (f === 'special_tokens_map.json' || f === 'added_tokens.json') log(`optional ${f} missing`)
        else throw err
      }
    }
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
