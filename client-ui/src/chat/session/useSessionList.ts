import { useCallback, useRef, useState } from 'react'
import { listSessions } from '../../api/client'
import type { SessionMeta } from '../../types/chat'

/** 会话列表 + 镜像 ref（原 sessions/sessionsRef/refreshSessions 段逐字迁移；render 期赋值语义保留） */
export function useSessionList() {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const sessionsRef = useRef(sessions)
  sessionsRef.current = sessions

  const refreshSessions = useCallback(async () => {
    const { sessions: list } = await listSessions()
    setSessions(list)
    return list
  }, [])

  return { sessions, setSessions, sessionsRef, refreshSessions }
}
