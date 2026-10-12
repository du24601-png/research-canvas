/**
 * 单轮「只根据我的资料」：工具名单与检索范围，不改会话冻结列表。
 * 并发按 sessionId 隔离，回合结束必须 end。
 */

const LIBRARY_ONLY_TOOL_NAMES = ['search_library', 'read_document'] as const

const ALLOWED = new Set<string>(LIBRARY_ONLY_TOOL_NAMES)

const armed = new Set<string>()

export function beginLibraryOnlyTurn(sessionId: string): void {
  if (sessionId) armed.add(sessionId)
}

export function endLibraryOnlyTurn(sessionId: string): void {
  armed.delete(sessionId)
}

export function isLibraryOnlyTurn(sessionId: string | null | undefined): boolean {
  return Boolean(sessionId && armed.has(sessionId))
}

export function isLibraryOnlyTool(name: string): boolean {
  return ALLOWED.has(name)
}

export function filterNamesForLibraryOnly(names: readonly string[]): string[] {
  return names.filter(name => ALLOWED.has(name))
}

export function filterToolsForLibraryOnly<T extends { function?: { name?: string } }>(
  tools: readonly T[],
): T[] {
  return tools.filter(tool => {
    const name = tool.function?.name
    return typeof name === 'string' && ALLOWED.has(name)
  })
}

/** 已 begin 时收窄本轮工具；否则返回 null，调用方保持原列表。 */
export function narrowLibraryOnlyRound<T extends { function?: { name?: string } }>(
  sessionId: string,
  activeNames: readonly string[],
  openAiTools: readonly T[],
): { activeNames: string[]; openAiTools: T[] } | null {
  if (!isLibraryOnlyTurn(sessionId)) return null
  return {
    activeNames: filterNamesForLibraryOnly(activeNames),
    openAiTools: filterToolsForLibraryOnly(openAiTools),
  }
}

/** 只给模型看，不出现在用户界面。 */
export const LIBRARY_ONLY_TURN_TAIL =
  '本轮只根据用户已加入的资料回答。先用 search_library 检索（source_type=report），需要上下文再用 read_document。'
  + '不要查行情、资讯或网页。没有命中就说明资料里没有这部分内容，不要用其他来源补全。'
