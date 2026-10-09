/**
 * 对话优先布局开关（FinFrame M3a）。默认开启：对话占满宽度，研究画布收进「看板」抽屉。
 * 关闭后恢复双栏研究画布，行为与改版前一致。
 * - 构建期：VITE_FINFRAME_CHAT_FIRST=0 关闭
 * - 运行期：localStorage `finframe.chatFirst` 设为 '0' / '1' 覆盖构建期（刷新后生效）
 */
export const CHAT_FIRST_STORAGE_KEY = 'finframe.chatFirst'

export function resolveChatFirstLayout(envValue: string | undefined, storedValue: string | null): boolean {
  if (storedValue === '0') return false
  if (storedValue === '1') return true
  return envValue !== '0'
}

function readStoredOverride(): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(CHAT_FIRST_STORAGE_KEY)
  } catch {
    return null
  }
}

export function isChatFirstLayout(): boolean {
  return resolveChatFirstLayout(import.meta.env.VITE_FINFRAME_CHAT_FIRST, readStoredOverride())
}
