import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { renderPlanningBriefingMd } from './archive-briefing.mjs'

function fileBase(record) {
  const stamp = String(record.at).replace(/[:.]/g, '-')
  const layer = record.layer === 'prompt' ? 'prompt' : 'planning'
  return `${stamp}-${record.kind}-${layer}`
}

async function writePair(dir, base, record, md) {
  await mkdir(dir, { recursive: true })
  const jsonPath = path.join(dir, `${base}.json`)
  const mdPath = path.join(dir, `${base}.md`)
  await writeFile(jsonPath, `${JSON.stringify(record, null, 2)}\n`)
  await writeFile(mdPath, md.endsWith('\n') ? md : `${md}\n`)
  return { jsonPath, mdPath }
}

export async function writePlanningArchive(record, opts) {
  const base = fileBase(record)
  const md = renderPlanningBriefingMd(record)
  const scratch = await writePair(opts.scratchDir, base, record, md)
  let records = null
  if (record.kind === 'official' && opts.recordsDir) {
    records = await writePair(opts.recordsDir, base, record, md)
  }
  return { scratch, records }
}
