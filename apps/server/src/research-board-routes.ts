import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { getUserDataStore } from '@opptrix/user-store'
import { sanitizeResearchBoardSnapshotPayload } from '@opptrix/shared/research-board-snapshot'

function bodyField(body: unknown, key: string): unknown {
  if (!body || typeof body !== 'object') return undefined
  return (body as Record<string, unknown>)[key]
}

export function registerResearchBoardRoutes(app: FastifyInstance): void {
  app.post<{ Body: { sessionId?: string; title?: string; payload?: unknown } }>(
    '/api/research/snapshots',
    async (req, reply) => {
      if (!req.auth) return reply.code(401).send({ error: '未登录' })
      const sessionId = typeof bodyField(req.body, 'sessionId') === 'string'
        ? String(bodyField(req.body, 'sessionId')).trim()
        : ''
      if (!sessionId) return reply.code(400).send({ error: '缺少会话信息' })
      const payloadRaw = bodyField(req.body, 'payload')
      const titleRaw = bodyField(req.body, 'title')
      const payloadInput = payloadRaw && typeof payloadRaw === 'object'
        ? {
          ...(payloadRaw as Record<string, unknown>),
          ...(typeof titleRaw === 'string' && titleRaw.trim()
            ? { title: titleRaw.trim() }
            : {}),
        }
        : payloadRaw
      const payload = sanitizeResearchBoardSnapshotPayload(payloadInput)
      if (!payload) return reply.code(400).send({ error: '看板内容无效或超出上限' })
      try {
        const record = getUserDataStore().researchBoardSnapshots.create({
          sessionId,
          title: payload.title,
          payload,
        })
        return { ok: true, id: record.id, createdAt: record.createdAt }
      } catch (e) {
        const message = e instanceof Error ? e.message : '发布失败'
        return reply.code(400).send({ error: message })
      }
    },
  )

  app.get<{ Params: { id: string } }>(
    '/api/research/snapshots/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const record = getUserDataStore().researchBoardSnapshots.getById(req.params.id)
      if (!record) return reply.code(404).send({ error: '看板不存在或已失效' })
      return {
        ok: true,
        id: record.id,
        title: record.title,
        createdAt: record.createdAt,
        payload: record.payload,
      }
    },
  )
}
