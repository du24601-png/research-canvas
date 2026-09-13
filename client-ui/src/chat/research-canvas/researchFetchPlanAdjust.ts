const draftSinks = new Set<(text: string) => void>()

export function registerResearchFetchPlanDraftSink(
  sink: (text: string) => void,
): () => void {
  draftSinks.add(sink)
  return () => {
    draftSinks.delete(sink)
  }
}

export function requestAdjustResearchFetchPlan(statement: string): void {
  const text = `我想调整取数计划（${statement}）：`
  for (const sink of draftSinks) sink(text)
}
