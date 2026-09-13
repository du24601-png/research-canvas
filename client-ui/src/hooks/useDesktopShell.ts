import { useEffect } from 'react'
import type { SettingsSection } from '../pages/settings/SettingsSidebar'
import { isElectron } from '../platform/detect'
import type { OpptrixProtocolPayload } from '../platform/detect'
import {
  OPPTRIX_OPEN_CHAT_EVENT,
  type OpptrixOpenChatDetail,
} from '../platform/chatNotifications'

type DesktopProtocolHandlers = {
  openChat: (sessionId?: string) => void | Promise<void>
  openSettings: (section?: SettingsSection) => void
}

function resolveProtocolAction(payload: OpptrixProtocolPayload) {
  const route = (payload.route || payload.host || '').replace(/^\/+/, '').toLowerCase()
  const params = payload.params ?? {}

  if (route === 'settings' || route === 'open/settings') {
    const section = params.section as SettingsSection | undefined
    return { type: 'settings' as const, section }
  }

  if (route === 'chat' || route === 'open/chat' || route === 'open') {
    return { type: 'chat' as const, sessionId: params.session ?? params.id }
  }

  if (params.session || params.id) {
    return { type: 'chat' as const, sessionId: params.session ?? params.id }
  }

  return null
}

export function useDesktopShell(handlers: DesktopProtocolHandlers) {
  useEffect(() => {
    if (!isElectron()) return
    void window.electronAPI?.notificationRequestPermission?.()
  }, [])

  useEffect(() => {
    if (!isElectron()) return

    const unsubscribe = window.electronAPI?.onProtocolOpen?.((payload) => {
      const action = resolveProtocolAction(payload)
      if (!action) return

      if (action.type === 'settings') {
        handlers.openSettings(action.section)
        return
      }

      void handlers.openChat(action.sessionId)
    })

    return () => unsubscribe?.()
  }, [handlers])

  /** Web Notification 点击 → 打开对应会话 */
  useEffect(() => {
    if (isElectron()) return

    const onOpenChat = (event: Event) => {
      const detail = (event as CustomEvent<OpptrixOpenChatDetail>).detail
      const sessionId = typeof detail?.sessionId === 'string' ? detail.sessionId.trim() : ''
      void handlers.openChat(sessionId || undefined)
    }

    window.addEventListener(OPPTRIX_OPEN_CHAT_EVENT, onOpenChat)
    return () => window.removeEventListener(OPPTRIX_OPEN_CHAT_EVENT, onOpenChat)
  }, [handlers])
}
