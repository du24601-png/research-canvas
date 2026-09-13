import type { FastifyInstance } from 'fastify'
import {
  getNewsSettings,
  saveNewsSettings,
  type NewsSettings,
  type NewsTranslationSettings,
} from '@opptrix/news-feed'
import {
  maybeBootstrapTranslationModel,
  shouldBootstrapSenseVoice,
  scheduleSenseVoiceEnsureJob,
} from '@opptrix/local-inference'
import { resolveProjectRoot } from '@opptrix/agent'
import {
  cancelTranslationModelDownload,
  getTranslationDownloadDirInfo,
  getTranslationModels,
  getTranslationStatus,
  startTranslationModelDownload,
  toUserFacingTranslationError,
  translateArticle,
} from './translation-local.js'

function scheduleOfflineModelBootstrap(settings: NewsSettings): void {
  void maybeBootstrapTranslationModel(settings.translation).catch(() => {})
  if (shouldBootstrapSenseVoice(settings.enrichment)) {
    const modelName = settings.enrichment.offline_whisper_model?.trim() || 'q8'
    const repoRoot = resolveProjectRoot()
    scheduleSenseVoiceEnsureJob(modelName, repoRoot)
  }
}

/** 翻译 / 多模态设置 API（不含资讯中心订阅与 feed） */
export async function registerNewsSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/news/settings', async () => ({
    settings: getNewsSettings(),
  }))

  app.put<{ Body: Partial<NewsSettings> }>('/api/news/settings', async (req) => {
    const cur = getNewsSettings()
    const next = saveNewsSettings({
      refresh_interval_min: req.body?.refresh_interval_min ?? cur.refresh_interval_min,
      retention_years: req.body?.retention_years ?? cur.retention_years,
      max_articles: req.body?.max_articles !== undefined ? req.body.max_articles : cur.max_articles,
      translation: {
        ...cur.translation,
        ...(req.body?.translation ?? {}),
      },
      enrichment: {
        ...cur.enrichment,
        ...(req.body?.enrichment ?? {}),
      },
    })
    scheduleOfflineModelBootstrap(next)
    return { settings: next }
  })

  app.get('/api/news/translation/status', async () => {
    const settings = getNewsSettings()
    return getTranslationStatus(settings.translation)
  })

  app.get('/api/news/translation/models', async () => getTranslationModels())

  app.get('/api/news/translation/download-dir', async () => getTranslationDownloadDirInfo())

  app.post<{ Body: { modelId?: string } }>('/api/news/translation/download', async (req, reply) => {
    const modelId = req.body?.modelId?.trim()
    if (!modelId) return reply.code(400).send({ error: 'modelId required' })
    try {
      return await startTranslationModelDownload(modelId)
    } catch (e) {
      return reply.code(400).send({ error: toUserFacingTranslationError(e) })
    }
  })

  app.post('/api/news/translation/download/cancel', async () => ({
    cancelled: cancelTranslationModelDownload(),
  }))

  app.post<{
    Body: {
      articleId?: string
      title?: string
      bodyText?: string
      segments?: Array<{ id: string; text: string; kind?: 'text' | 'html' }>
      targetLang?: string
      translation?: Partial<NewsTranslationSettings>
    }
    Querystring: { stream?: string }
  }>('/api/news/translate', async (req, reply) => {
    const settings = getNewsSettings()
    const translation = {
      ...settings.translation,
      ...(req.body?.translation ?? {}),
    }
    const payload = {
      articleId: req.body?.articleId ?? '',
      title: req.body?.title,
      bodyText: req.body?.bodyText,
      segments: req.body?.segments,
      targetLang: req.body?.targetLang,
    }

    const accept = String(req.headers.accept ?? '')
    const streamRequested = accept.includes('text/event-stream')
      || req.query?.stream === '1'
      || req.query?.stream === 'true'

    if (!streamRequested) {
      try {
        return await translateArticle(payload, translation)
      } catch (e) {
        return reply.code(400).send({ error: toUserFacingTranslationError(e) })
      }
    }

    reply.hijack()
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    const writeEvent = (event: string, data: unknown) => {
      if (reply.raw.writableEnded) return
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    try {
      const result = await translateArticle(payload, translation, (progress) => {
        writeEvent('progress', progress)
      })
      writeEvent('result', result)
    } catch (e) {
      writeEvent('error', { error: toUserFacingTranslationError(e) })
    } finally {
      if (!reply.raw.writableEnded) reply.raw.end()
    }
  })
}
