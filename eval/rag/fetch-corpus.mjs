#!/usr/bin/env node
/**
 * 下载 E3 评测语料：6 份 2024 年年度报告全文 PDF（巨潮资讯网公开公告查询）。
 * 用法：node eval/rag/fetch-corpus.mjs [outDir]
 * 默认输出 D:\finframe-data\eval-corpus\，并写 manifest.json（url / size / sha256）。
 */
import { createHash } from 'node:crypto'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const OUT = process.argv[2] ?? 'D:\\finframe-data\\eval-corpus'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) research-eval'
export const CORPUS = [
  { key: 'moutai', code: '600519', name: '贵州茅台' },
  { key: 'catl', code: '300750', name: '宁德时代' },
  { key: 'byd', code: '002594', name: '比亚迪' },
  { key: 'midea', code: '000333', name: '美的集团' },
  { key: 'cmb', code: '600036', name: '招商银行' },
  { key: 'pingan', code: '601318', name: '中国平安' },
]

async function post(url, body, timeoutMs = 20000) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'User-Agent': UA },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`)
  return res.json()
}

async function findReport(c) {
  const hits = await post('http://www.cninfo.com.cn/new/information/topSearch/query', { keyWord: c.code, maxNum: '5' })
  const hit = hits.find(h => h.code === c.code)
  if (!hit) throw new Error(`orgId not found for ${c.code}`)
  const column = c.code.startsWith('6') ? 'sse' : 'szse'
  const data = await post('http://www.cninfo.com.cn/new/hisAnnouncement/query', {
    pageNum: '1', pageSize: '30', column, tabName: 'fulltext', plate: '',
    stock: `${c.code},${hit.orgId}`, searchkey: '', secid: '',
    category: 'category_ndbg_szsh', trade: '', seDate: '2025-01-01~2025-12-31',
    sortName: '', sortType: '', isHLtitle: 'true',
  })
  const list = (data.announcements ?? []).map(a => ({ ...a, title: String(a.announcementTitle).replace(/<[^>]+>/g, '') }))
  const ok = list.filter(a => /2024年年?度报告/.test(a.title) && !/摘要|英文|取消|更正前|已取消/.test(a.title))
  // 优先非“修订版”的原文；若只有修订版，则取修订版
  ok.sort((a, b) => Number(/修订|更新/.test(a.title)) - Number(/修订|更新/.test(b.title)))
  if (!ok.length) throw new Error(`no 2024 annual report for ${c.code}: ${list.map(a => a.title).join(' | ')}`)
  const a = ok[0]
  return { title: a.title, url: `http://static.cninfo.com.cn/${a.adjunctUrl}`, announcementTime: a.announcementTime, candidates: list.map(x => x.title) }
}

async function download(url, file) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(180000) })
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error(`${url} is not a PDF`)
  await writeFile(file, buf)
  return buf
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const manifestPath = path.join(OUT, 'manifest.json')
  const prev = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : { docs: [] }
  const docs = []
  for (const c of CORPUS) {
    const file = path.join(OUT, `${c.code}_${c.key}_2024_annual.pdf`)
    const old = prev.docs.find(d => d.code === c.code)
    if (old && existsSync(file)) { docs.push(old); console.log(`skip ${c.name} (exists)`); continue }
    const r = await findReport(c)
    console.log(`${c.name}: ${r.title} -> ${r.url}`)
    const buf = await download(r.url, file)
    docs.push({
      key: c.key, code: c.code, name: c.name, title: r.title, url: r.url,
      file: path.basename(file), size: buf.length,
      sha256: createHash('sha256').update(buf).digest('hex'),
      announcementTime: new Date(r.announcementTime).toISOString(), candidates: r.candidates,
    })
  }
  await writeFile(manifestPath, JSON.stringify({ source: 'cninfo.com.cn hisAnnouncement/query', fetchedAt: new Date().toISOString(), docs }, null, 2))
  console.log(`manifest -> ${manifestPath}`)
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('fetch-corpus.mjs')) {
  main().catch(e => { console.error(e); process.exit(1) })
}
