import { publicLlmMeta } from '../component/archive-record.mjs'
import { diagnosePipeline } from './compare.mjs'

function layerSlice(record, jsonPath) {
  if (!record) return null
  return {
    layer: record.layer,
    kind: record.kind,
    at: record.at,
    duration_ms: record.duration_ms,
    dataset_id: record.dataset_id ?? '',
    summary: record.summary ?? {},
    archive: jsonPath ?? null,
  }
}

export function buildPipelineRecord(input) {
  const layersIn = input.layers ?? {}
  const paths = input.layerPaths ?? {}
  const compare = input.compare ?? {}
  return {
    schema: 'opptrix.eval.pipeline.v1',
    kind: input.kind === 'smoke' ? 'smoke' : 'official',
    track: 'agent',
    layer: 'pipeline',
    focus: 'agent_eval.three_layer',
    at: input.at ?? new Date().toISOString(),
    duration_ms: input.durationMs ?? null,
    git: input.git ?? { commit: '', dirty: null },
    llm: publicLlmMeta(input.llm),
    notes: input.notes ?? '',
    layers: {
      component: layerSlice(layersIn.component, paths.component),
      planning: layerSlice(layersIn.planning, paths.planning),
      prompt: layerSlice(layersIn.prompt, paths.prompt),
    },
    compare,
    diagnosis: diagnosePipeline(compare),
  }
}
