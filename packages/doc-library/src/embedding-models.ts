/**
 * 嵌入模型注册表：维度、池化、查询/段落前缀、权重仓库。
 * 选择：env `DOC_LIBRARY_EMBEDDING_MODEL`（默认 multilingual-e5-small，行为不变）。
 * 模型根目录：env `DOC_LIBRARY_MODELS_DIR`（未设置则沿用 paths.ts 的既有查找）。
 */
import { isAbsolute } from 'node:path'

export type EmbeddingPooling = 'mean' | 'cls' | 'last_token'

export interface EmbeddingModelSpec {
  /** 本地目录名，同时作为 transformers.js 的 model id */
  id: string
  /** ONNX 权重所在 HF 仓库（ModelScope 通常同名镜像） */
  hubRepos: readonly string[]
  dimension: number
  pooling: EmbeddingPooling
  normalize: boolean
  /** 查询前缀 / 指令；段落前缀 */
  queryPrefix: string
  passagePrefix: string
  maxTokens: number
  /** 首选 dtype（q8 = onnx/model_quantized.onnx） */
  dtype: 'q8' | 'q4f16' | 'fp32'
  /** 需要的必备文件（相对模型目录） */
  requiredFiles: readonly string[]
  /** 向量表名后缀；空串 = 沿用历史表名（仅 e5） */
  tableSuffix: string
}

export const DEFAULT_EMBEDDING_MODEL_ID = 'multilingual-e5-small'

const BASE_FILES = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model_quantized.onnx'] as const

export const EMBEDDING_MODELS: Readonly<Record<string, EmbeddingModelSpec>> = {
  'multilingual-e5-small': {
    id: 'multilingual-e5-small',
    hubRepos: ['Xenova/multilingual-e5-small'],
    dimension: 384,
    pooling: 'mean',
    normalize: true,
    queryPrefix: 'query: ',
    passagePrefix: 'passage: ',
    maxTokens: 512,
    dtype: 'q8',
    requiredFiles: BASE_FILES,
    tableSuffix: '',
  },
  'bge-small-zh-v1.5': {
    id: 'bge-small-zh-v1.5',
    hubRepos: ['Xenova/bge-small-zh-v1.5'],
    dimension: 512,
    pooling: 'cls',
    normalize: true,
    queryPrefix: '为这个句子生成表示以用于检索相关文章：',
    passagePrefix: '',
    maxTokens: 512,
    dtype: 'q8',
    requiredFiles: BASE_FILES,
    tableSuffix: '_bge_small_zh_v1_5_512',
  },
  'Qwen3-Embedding-0.6B': {
    id: 'Qwen3-Embedding-0.6B',
    hubRepos: ['onnx-community/Qwen3-Embedding-0.6B-ONNX'],
    dimension: 1024,
    pooling: 'last_token',
    normalize: true,
    queryPrefix:
      'Instruct: Given a question about a Chinese company filing, retrieve passages that answer it\nQuery:',
    passagePrefix: '',
    maxTokens: 8192,
    dtype: 'q8',
    requiredFiles: BASE_FILES,
    tableSuffix: '_qwen3_embedding_0_6b_1024',
  },
}

let warnedUnknownModel = false
let warnedRelativeModelsDir = false

/** 解析当前选中的模型；未知 id 回退默认（并保持 e5 行为） */
export function resolveEmbeddingModelSpec(
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingModelSpec {
  const wanted = env.DOC_LIBRARY_EMBEDDING_MODEL?.trim()
  if (wanted && EMBEDDING_MODELS[wanted]) return EMBEDDING_MODELS[wanted]
  if (wanted && !warnedUnknownModel) {
    warnedUnknownModel = true
    console.warn(`[doc-library] unknown DOC_LIBRARY_EMBEDDING_MODEL "${wanted}", falling back to ${DEFAULT_EMBEDDING_MODEL_ID}`)
  }
  return EMBEDDING_MODELS[DEFAULT_EMBEDDING_MODEL_ID]
}

/** `DOC_LIBRARY_MODELS_DIR` 绝对路径；未设置返回 null */
export function resolveModelsDirOverride(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.DOC_LIBRARY_MODELS_DIR?.trim()
  if (!raw) return null
  if (!isAbsolute(raw)) {
    if (!warnedRelativeModelsDir) {
      warnedRelativeModelsDir = true
      console.warn('[doc-library] DOC_LIBRARY_MODELS_DIR must be an absolute path; ignoring it')
    }
    return null
  }
  return raw
}

/** LanceDB 表名：e5 保持 `doc_chunks`，其它模型带 id+dim 后缀，避免混向量 */
export function lanceTableNameFor(spec: EmbeddingModelSpec, base = 'doc_chunks'): string {
  return `${base}${spec.tableSuffix}`
}
