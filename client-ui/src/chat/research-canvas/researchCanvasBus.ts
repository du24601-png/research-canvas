type Listener = (event: unknown) => void

const listeners = new Set<Listener>()

export function publishResearchCanvasEvent(event: unknown): void {
  for (const listener of listeners) listener(event)
}

export function subscribeResearchCanvasEvents(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
