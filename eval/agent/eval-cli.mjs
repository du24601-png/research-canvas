import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { formatMonitorLogLines } from './monitor-metrics.mjs'

export const MISSING_LLM_MESSAGE =
  '未配置模型。请在应用里保存默认模型，或设置 EVAL_LLM_API_KEY、EVAL_LLM_BASE_URL、EVAL_LLM_MODEL。'

export function limitCaseIds(cases, limit) {
  if (!Number.isFinite(limit) || limit <= 0) return undefined
  return cases.slice(0, limit).map((c) => c.id)
}

export function evalExitCode(failed, env = process.env) {
  if (env.EVAL_STRICT === '1' && failed) return 1
  return 0
}

export function isDirectRun(metaUrl, argv1 = process.argv[1]) {
  if (!argv1) return false
  try {
    const invoked = pathToFileURL(path.resolve(argv1)).href
    if (process.platform === 'win32') {
      return invoked.toLowerCase() === String(metaUrl).toLowerCase()
    }
    return invoked === metaUrl
  } catch {
    return false
  }
}

export function printLayerOutcome(prefix, record, written) {
  for (const line of formatMonitorLogLines(prefix, record.summary ?? {}, record.duration_ms)) {
    console.log(line)
  }
  console.log(`[${prefix}] scratch ${written.scratch.mdPath}`)
  if (written.records) console.log(`[${prefix}] archive ${written.records.mdPath}`)
  for (const row of record.results ?? []) {
    if (row.skipped || row.pass) continue
    console.log(`  FAIL ${row.caseId}: ${(row.reasons ?? []).join('；')}`)
  }
}

export function finishEvalCli(result, prefix) {
  if (result.error === 'no_llm') {
    console.error(MISSING_LLM_MESSAGE)
    process.exit(2)
  }
  printLayerOutcome(prefix, result.record, result.written)
  process.exit(evalExitCode(result.record.summary?.failed))
}
