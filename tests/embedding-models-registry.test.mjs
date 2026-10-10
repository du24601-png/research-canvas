/**
 * 嵌入模型注册表 + 可选烟测（模型文件缺失时自动 skip）。
 * 烟测模型根：DOC_LIBRARY_MODELS_DIR，缺省 D:\finframe-data\models。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  EMBEDDING_MODELS,
  resolveEmbeddingModelSpec,
  lanceTableNameFor,
} from '../packages/doc-library/dist/embedding-models.js'
import { TransformersE5Backend } from '../packages/doc-library/dist/embedding.js'

describe('embedding model registry', () => {
  it('defaults to e5 with the historical table name', () => {
    const spec = resolveEmbeddingModelSpec({})
    assert.equal(spec.id, 'multilingual-e5-small')
    assert.equal(spec.dimension, 384)
    assert.equal(lanceTableNameFor(spec), 'doc_chunks')
  })

  it('unknown id falls back to default; known ids switch', () => {
    assert.equal(resolveEmbeddingModelSpec({ DOC_LIBRARY_EMBEDDING_MODEL: 'nope' }).id, 'multilingual-e5-small')
    const bge = resolveEmbeddingModelSpec({ DOC_LIBRARY_EMBEDDING_MODEL: 'bge-small-zh-v1.5' })
    assert.equal(bge.pooling, 'cls')
    assert.notEqual(lanceTableNameFor(bge), 'doc_chunks')
  })

  it('every non-e5 model has a distinct table name', () => {
    const names = Object.values(EMBEDDING_MODELS).map(s => lanceTableNameFor(s))
    assert.equal(new Set(names).size, names.length)
  })
})

const ROOT = process.env.DOC_LIBRARY_MODELS_DIR?.trim() || 'D:/finframe-data/models'
const QUERY = '毛利率为什么下降'
const PASSAGES = [
  '本期毛利率较上年同期下降3.2个百分点，主要系原材料价格上涨及产品售价下调所致。',
  '公司注册地址位于上海市浦东新区，法定代表人为张某，注册资本五亿元。',
]

function dot(a, b) {
  return a.reduce((s, v, i) => s + v * b[i], 0)
}

for (const id of ['bge-small-zh-v1.5', 'Qwen3-Embedding-0.6B']) {
  const dir = path.join(ROOT, id)
  const present = fs.existsSync(path.join(dir, 'onnx', 'model_quantized.onnx'))
  describe(`smoke ${id}`, { skip: !present && 'model files not present' }, () => {
    it('embeds Chinese text with correct dim and ranking', { timeout: 300_000 }, async () => {
      const spec = resolveEmbeddingModelSpec({ DOC_LIBRARY_EMBEDDING_MODEL: id })
      const backend = new TransformersE5Backend(dir, spec)
      const t0 = Date.now()
      assert.equal(await backend.ensureLoaded(), true)
      const loadMs = Date.now() - t0
      const t1 = Date.now()
      const q = await backend.embedQuery(QUERY)
      const qMs = Date.now() - t1
      const ps = await backend.embedPassages([...PASSAGES, '今天天气晴朗'])
      assert.equal(q.length, spec.dimension)
      assert.ok(ps.every(p => p.length === spec.dimension))
      const near = dot(q, ps[0])
      const far = dot(q, ps[1])
      console.log(`[${id}] load=${loadMs}ms query=${qMs}ms rss=${Math.round(process.memoryUsage().rss / 1048576)}MB near=${near.toFixed(3)} far=${far.toFixed(3)}`)
      assert.ok(near > far, `near ${near} should exceed far ${far}`)
      await backend.dispose()
    })
  })
}
