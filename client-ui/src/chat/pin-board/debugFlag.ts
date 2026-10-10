/** 开发者信息（token 用量、模型选择等）默认对投资者隐藏；localStorage `finframe.debug`='1' 显示。 */
export const DEBUG_STORAGE_KEY = 'finframe.debug'

export function resolveDebugFlag(storedValue: string | null): boolean {
  return storedValue === '1'
}

export function isDebugInfoVisible(): boolean {
  try {
    return typeof window !== 'undefined' && resolveDebugFlag(window.localStorage.getItem(DEBUG_STORAGE_KEY))
  } catch {
    return false
  }
}

/** 对话优先布局下仅在调试开关打开时显示；旧布局始终显示。 */
export function showDeveloperInfo(chatFirst: boolean): boolean {
  return !chatFirst || isDebugInfoVisible()
}
