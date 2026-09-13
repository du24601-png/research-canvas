export interface ActiveWidgetSelection {
  id: string
  title: string
}

type Listener = () => void

let current: ActiveWidgetSelection | null = null
const listeners = new Set<Listener>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function getActiveWidgetSelection(): ActiveWidgetSelection | null {
  return current
}

export function getActiveWidgetId(): string | null {
  return current?.id ?? null
}

export function setActiveWidget(next: ActiveWidgetSelection | null): void {
  if (current?.id === next?.id && current?.title === next?.title) return
  current = next ? { id: next.id, title: next.title } : null
  emit()
}

export function subscribeActiveWidget(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resetActiveWidgetForTests(): void {
  current = null
  emit()
}
