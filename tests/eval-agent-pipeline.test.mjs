/**
 * 整体测评流水线：综合简报、基线对比、读分矩阵。不打 LLM。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { evalExitCode, isDirectRun, limitCaseIds } from '../eval/agent/eval-cli.mjs'
import { findLatestOfficial } from '../eval/agent/pipeline/baseline.mjs'
import { compareLayer, diagnosePipeline } from '../eval/agent/pipeline/compare.mjs'
import { buildPipelineRecord } from '../eval/agent/pipeline/archive-record.mjs'
import { renderPipelineBriefingMd } from '../eval/agent/pipeline/archive-briefing.mjs'
import { writePipelineArchive } from '../eval/agent/pipeline/archive-write.mjs'

function summary(partial) {
  return {
    judged: 24,
    skipped: 0,
    passed: 24,
    failed: 0,
    pass_rate: 1,
    failure_rate: 0,
    effective_ratio: 1,
    avg_decisions: 1.75,
    avg_decisions_passed: 1.75,
    avg_step_precision: 0.958,
    constraint_hits: {},
    by_family: {
      named_compare: { judged: 4, passed: 4, failed: 0, skipped: 0 },
      many_preview: { judged: 3, passed: 3, failed: 0, skipped: 0 },
      industry: { judged: 3, passed: 3, failed: 0, skipped: 0 },
      refine_view: { judged: 5, passed: 5, failed: 0, skipped: 0 },
      adopt_boundary: { judged: 3, passed: 3, failed: 0, skipped: 0 },
      quotes_and_stop: { judged: 6, passed: 6, failed: 0, skipped: 0 },
    },
    ...partial,
  }
}

function layerRecord(layer, extra = {}) {
  return {
    schema: layer === 'component' ? 'opptrix.eval.component.v1' : 'opptrix.eval.planning.v1',
    kind: 'official',
    track: 'agent',
    layer,
    at: extra.at ?? '2026-09-14T05:00:00.000Z',
    duration_ms: extra.duration_ms ?? 96_000,
    llm: { model: 'deepseek-flash' },
    summary: extra.summary ?? summary(),
    results: extra.results ?? [],
    git: { commit: 'abc', dirty: false },
  }
}

test('evalExitCode is report-only unless EVAL_STRICT=1', () => {
  assert.equal(evalExitCode(5, {}), 0)
  assert.equal(evalExitCode(5, { EVAL_STRICT: '1' }), 1)
  assert.equal(evalExitCode(0, { EVAL_STRICT: '1' }), 0)
})

test('limitCaseIds empty when limit is not a positive number', () => {
  const cases = [{ id: 'a' }, { id: 'b' }]
  assert.equal(limitCaseIds(cases, 0), undefined)
  assert.deepEqual(limitCaseIds(cases, 1), ['a'])
})

test('isDirectRun is false when imported from another file', () => {
  assert.equal(isDirectRun(import.meta.url, path.join('D:', 'other', 'run.mjs')), false)
})

test('isDirectRun is true for this file path', () => {
  assert.equal(isDirectRun(import.meta.url, fileURLToPath(import.meta.url)), true)
})

test('compareLayer reports pass_rate delta and newly failed/passed', () => {
  const baseline = layerRecord('prompt', {
    results: [
      { caseId: 'pl-015', pass: true, skipped: false },
      { caseId: 'pl-020', pass: true, skipped: false },
      { caseId: 'pl-001', pass: false, skipped: false },
    ],
  })
  const current = layerRecord('prompt', {
    summary: summary({
      passed: 22, failed: 2, pass_rate: 22 / 24, failure_rate: 2 / 24,
      avg_decisions: 1.92, avg_step_precision: 0.885,
    }),
    results: [
      { caseId: 'pl-015', pass: false, skipped: false, question: '改色' },
      { caseId: 'pl-020', pass: true, skipped: false },
      { caseId: 'pl-001', pass: true, skipped: false },
    ],
  })
  const cmp = compareLayer(current, baseline)
  assert.equal(cmp.hasBaseline, true)
  assert.ok(cmp.deltas.pass_rate < 0)
  assert.deepEqual(cmp.newlyFailed.map((r) => r.caseId), ['pl-015'])
  assert.deepEqual(cmp.newlyPassed.map((r) => r.caseId), ['pl-001'])
})

test('compareLayer without baseline is 无对照', () => {
  const cmp = compareLayer(layerRecord('planning'), null)
  assert.equal(cmp.hasBaseline, false)
  assert.equal(cmp.deltas, null)
})

test('findLatestOfficial skips excluded paths and pipeline files', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'eval-pipe-'))
  try {
    const older = path.join(dir, '2026-09-14T05-00-00-000Z-official-prompt.json')
    const newer = path.join(dir, '2026-09-14T06-00-00-000Z-official-prompt.json')
    const pipe = path.join(dir, '2026-09-14T07-00-00-000Z-official-pipeline.json')
    await writeFile(older, JSON.stringify(layerRecord('prompt', { at: '2026-09-14T05:00:00.000Z' })))
    await writeFile(newer, JSON.stringify(layerRecord('prompt', { at: '2026-09-14T06:00:00.000Z' })))
    await writeFile(pipe, JSON.stringify({ kind: 'official', layer: 'pipeline', at: '2026-09-14T07:00:00.000Z' }))
    const latest = await findLatestOfficial(dir, 'prompt')
    assert.equal(latest.at, '2026-09-14T06:00:00.000Z')
    const prev = await findLatestOfficial(dir, 'prompt', { excludePaths: [newer] })
    assert.equal(prev.at, '2026-09-14T05:00:00.000Z')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('diagnose: planning 稳 prompt 掉 points at production prompt', () => {
  const lines = diagnosePipeline({
    component: { hasBaseline: true, deltas: { pass_rate: 0 } },
    planning: { hasBaseline: true, deltas: { pass_rate: 0 } },
    prompt: { hasBaseline: true, deltas: { pass_rate: -0.04 } },
  }).join('\n')
  assert.ok(lines.includes('生产提示词回归'))
  assert.ok(lines.includes('agent-prompt-guide.ts'))
  assert.ok(lines.includes('产品北星是 prompt 层'))
})

test('diagnose: planning 掉 prompt 稳 points at harness', () => {
  const lines = diagnosePipeline({
    component: { hasBaseline: true, deltas: { pass_rate: 0 } },
    planning: { hasBaseline: true, deltas: { pass_rate: -0.1 } },
    prompt: { hasBaseline: true, deltas: { pass_rate: 0 } },
  }).join('\n')
  assert.ok(lines.includes('评测量具'))
})

test('diagnose: both planning and prompt drop', () => {
  const lines = diagnosePipeline({
    component: { hasBaseline: true, deltas: { pass_rate: 0 } },
    planning: { hasBaseline: true, deltas: { pass_rate: -0.1 } },
    prompt: { hasBaseline: true, deltas: { pass_rate: -0.1 } },
  }).join('\n')
  assert.ok(lines.includes('夹具、gold 或模型'))
})

test('diagnose: only component drops', () => {
  const lines = diagnosePipeline({
    component: { hasBaseline: true, deltas: { pass_rate: -0.02 } },
    planning: { hasBaseline: true, deltas: { pass_rate: 0 } },
    prompt: { hasBaseline: true, deltas: { pass_rate: 0 } },
  }).join('\n')
  assert.ok(lines.includes('第一轮工具'))
})

test('pipeline briefing has monitor tables, scenarios, diagnosis, no weighted score', () => {
  const component = layerRecord('component', {
    duration_ms: 158000,
    summary: {
      judged: 99, passed: 94, failed: 5, skipped: 1,
      pass_rate: 94 / 99, failure_rate: 5 / 99,
      avg_decisions: 1, avg_decisions_passed: 1, avg_step_precision: 0.949,
      constraint_hits: {},
      by_family: {
        tushare_query_canvas: { judged: 32, passed: 31, failed: 1, skipped: 0 },
        tushare_query_quotes: { judged: 13, passed: 13, failed: 0, skipped: 0 },
        tushare_query_profile: { judged: 8, passed: 8, failed: 0, skipped: 0 },
        tushare_query_gate: { judged: 15, passed: 11, failed: 4, skipped: 1 },
        no_tool: { judged: 31, passed: 31, failed: 0, skipped: 0 },
      },
    },
  })
  const planning = layerRecord('planning')
  const prompt = layerRecord('prompt', {
    duration_ms: 149000,
    summary: summary({
      passed: 22, failed: 2, pass_rate: 22 / 24, failure_rate: 2 / 24,
      avg_decisions: 1.92, avg_step_precision: 0.885,
      by_family: {
        named_compare: { judged: 4, passed: 4, failed: 0, skipped: 0 },
        many_preview: { judged: 3, passed: 3, failed: 0, skipped: 0 },
        industry: { judged: 3, passed: 3, failed: 0, skipped: 0 },
        refine_view: { judged: 5, passed: 4, failed: 1, skipped: 0 },
        adopt_boundary: { judged: 3, passed: 3, failed: 0, skipped: 0 },
        quotes_and_stop: { judged: 6, passed: 5, failed: 1, skipped: 0 },
      },
    }),
    results: [{ caseId: 'pl-015', pass: false, skipped: false, question: '改色' }],
  })
  const record = buildPipelineRecord({
    kind: 'official',
    at: '2026-09-14T12:00:00.000Z',
    durationMs: 403000,
    git: { commit: 'abc', dirty: false },
    llm: { model: 'deepseek-flash', apiKey: 'sk-secret' },
    layers: { component, planning, prompt },
    layerPaths: {
      component: 'records/component.json',
      planning: 'records/planning.json',
      prompt: 'records/prompt.json',
    },
    compare: {
      component: compareLayer(component, component),
      planning: compareLayer(planning, planning),
      prompt: compareLayer(prompt, planning),
    },
  })
  assert.equal(record.schema, 'opptrix.eval.pipeline.v1')
  assert.equal(record.layer, 'pipeline')
  assert.equal('apiKey' in record.llm, false)
  assert.equal(record.layers.component.summary.passed, 94)
  assert.equal(record.layers.component.results, undefined)
  const md = renderPipelineBriefingMd(record)
  assert.ok(md.includes('## 监控指标'))
  assert.ok(md.includes('| 有效占比 |'))
  assert.ok(md.includes('| 失败频率 |'))
  assert.ok(md.includes('| 平均决策次数（全量） |'))
  assert.ok(md.includes('| 平均决策次数（通过题） |'))
  assert.ok(md.includes('| 步骤有效率 |'))
  assert.ok(md.includes('| 约束击穿 |'))
  assert.ok(md.includes('| 耗时 |'))
  assert.ok(md.includes('### component'))
  assert.ok(md.includes('### planning'))
  assert.ok(md.includes('### prompt'))
  assert.ok(md.includes('## 业务场景'))
  assert.ok(md.includes('具名对比'))
  assert.ok(md.includes('现价即停'))
  assert.ok(md.includes('画布问数'))
  assert.ok(md.includes('## 诊断'))
  assert.ok(md.includes('产品北星是 prompt 层'))
  assert.ok(md.includes('## 新失败 / 新通过'))
  assert.ok(md.includes('npm run eval:agent'))
  assert.ok(md.includes('禁止合成加权总分'))
  assert.ok(md.includes('不进入 test:gate'))
  assert.ok(!md.includes('sk-secret'))
  assert.ok(!md.includes('Agent 分'))
})

test('smoke pipeline archive stays in scratch, not records', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'eval-pipe-write-'))
  try {
    const scratchDir = path.join(root, 'scratch')
    const recordsDir = path.join(root, 'records')
    await mkdir(scratchDir, { recursive: true })
    const record = buildPipelineRecord({
      kind: 'smoke',
      at: '2026-09-14T12:00:00.000Z',
      durationMs: 1000,
      llm: { model: 'deepseek-flash' },
      layers: {
        component: layerRecord('component'),
        planning: layerRecord('planning'),
        prompt: layerRecord('prompt'),
      },
      compare: {
        component: compareLayer(layerRecord('component'), null),
        planning: compareLayer(layerRecord('planning'), null),
        prompt: compareLayer(layerRecord('prompt'), null),
      },
    })
    const written = await writePipelineArchive(record, { scratchDir, recordsDir })
    assert.ok(written.scratch.mdPath.includes('scratch'))
    assert.equal(written.records, null)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
