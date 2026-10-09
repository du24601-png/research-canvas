const draftSinks = new Set<(text: string) => void>()

export function registerResearchFetchPlanDraftSink(
  sink: (text: string) => void,
): () => void {
  draftSinks.add(sink)
  return () => {
    draftSinks.delete(sink)
  }
}

/** 把一段文字放进输入框（不自动发送），用户确认后走正常发送流程 */
export function requestComposerDraft(text: string): void {
  for (const sink of draftSinks) sink(text)
}

export function requestAdjustResearchFetchPlan(statement: string): void {
  const text = `我想调整取数计划（${statement}）：`
  for (const sink of draftSinks) sink(text)
}
