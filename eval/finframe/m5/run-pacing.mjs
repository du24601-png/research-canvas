#!/usr/bin/env node
/**
 * M5 节奏与对照：对本机 API（:8711）重放 Demo A/B/C，三种条件 × N 次，从 SSE 事件计时。
 * 选择无头 SSE 重放而非 Playwright 点界面：同一份流事件就是界面的输入，计时更稳定，
 * 不受渲染与动画影响；界面层的点击数按 scripts.mjs 的规则从事件推算。
 * 用法：node eval/finframe/m5/run-pacing.mjs [reps=2]
 * 注意：会在本机应用里新建标题为「【研究者任务测试】…」的会话（不删除）。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readGitMeta } from '../../agent/component/archive-meta.mjs'
import { CONDITIONS, DEMOS, largestChangeActions, pinActions } from './scripts.mjs'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const API = process.env.M5_API ?? 'http://127.0.0.1:8711/api'
const TURN_TIMEOUT_MS = 240_000

async function createSession(title) {
  const resp = await fetch(`${API}/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }), signal: AbortSignal.timeout(20_000) })
  return (await resp.json()).session.id
}

function eventStep(ev) {
  return ev.type === 'tool_done' || ev.type === 'research_ui_spec' ? ev.step : null
}

/** 发一句话，读完整个 SSE 流，记录关键事件相对发出时间的毫秒数 */
async function runTurn(sessionId, text, body) {
  const started = Date.now()
  const resp = await fetch(`${API}/sessions/${sessionId}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ message: text, ...body }),
    signal: AbortSignal.timeout(TURN_TIMEOUT_MS),
  })
  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  const t = { firstFeedback: null, lastPreview: null, spec: null, done: null }
  let buf = ''
  let reply = ''
  let spec = null
  const steps = []
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let i
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i)
      buf = buf.slice(i + 2)
      const line = chunk.split('\n').find(l => l.startsWith('data: '))
      if (!line) continue
      let ev
      try { ev = JSON.parse(line.slice(6)) } catch { continue }
      const ms = Date.now() - started
      const step = eventStep(ev)
      if (step) steps.push(step)
      const isPreview = step?.tool === 'propose_widget' && step.status === 'done'
      const isPlan = ev.type === 'research_plan' || (step?.tool === 'query_data' && /plan_preview/.test(step.resultDetail ?? ''))
      if ((isPreview || isPlan) && t.firstFeedback == null) t.firstFeedback = ms
      if (isPreview) t.lastPreview = ms
      if (ev.type === 'research_ui_spec') {
        t.spec = ms
        try { spec = JSON.parse(ev.step.resultDetail).spec } catch { spec = null }
      }
      if (ev.type === 'reply' && typeof ev.content === 'string') reply = ev.content
      if (ev.type === 'done') t.done = ms
    }
  }
  const datasets = steps.filter(s => (s.tool === 'query_data' || s.tool === 'refine_dataset') && /"datasetId"/.test(s.resultDetail ?? '')).length
  return { text, t, reply, spec, steps: steps.map(s => ({ tool: s.tool, status: s.status, resultDetail: s.tool === 'propose_widget' ? s.resultDetail : undefined })), datasets }
}

async function runDemo(condition, demoId, rep) {
  const demo = DEMOS[demoId]
  const body = CONDITIONS[condition].body
  const sessionId = await createSession(`【研究者任务测试】${condition}-${demoId}-${rep}`)
  const turns = []
  let actions = 0
  for (const turnSpec of demo.turns) {
    const turn = await runTurn(sessionId, turnSpec.text, body)
    actions += 1 + pinActions(turn, condition)
    turns.push(turn)
    if (demo.clarify && demo.clarify.when.test(turn.reply) && !turn.steps.some(s => s.tool === 'propose_widget')) {
      const follow = await runTurn(sessionId, demo.clarify.text, body)
      actions += 1 + pinActions(follow, condition)
      turns.push({ ...follow, clarification: true })
    }
  }
  if (demo.wantsLargestChange) actions += largestChangeActions(turns[0], condition).actions
  return { condition, demo: demoId, rep, sessionId, actions, turns }
}

async function main() {
  const reps = Number(process.argv[2] || 2)
  const runs = []
  for (let rep = 1; rep <= reps; rep += 1) {
    for (const demoId of Object.keys(DEMOS)) {
      for (const condition of Object.keys(CONDITIONS)) {
        const run = await runDemo(condition, demoId, rep)
        console.error(`[m5] ${condition} ${demoId} #${rep}: actions=${run.actions} ${run.turns.map(t => `first=${t.t.firstFeedback} spec=${t.t.spec} done=${t.t.done}`).join(' | ')}`)
        runs.push(run)
      }
    }
  }
  const at = new Date().toISOString()
  const record = { schema: 'finframe.m5.pacing.v1', at, git: readGitMeta(path.resolve(DIR, '../../..')), api: API, reps, conditions: CONDITIONS, runs }
  await mkdir(path.join(DIR, 'records'), { recursive: true })
  const file = path.join(DIR, 'records', `${at.replace(/[:.]/g, '-')}-pacing.json`)
  await writeFile(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
  console.log(file)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
