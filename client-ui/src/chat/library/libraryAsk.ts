/** 下一轮提问只根据「我的资料」。发送时消费，可取消。 */

const EVENT = 'finframe-library-ask'
type Listener = () => void

let armed = false
const listeners = new Set<Listener>()

function emit(): void {
  for (const listener of listeners) listener()
}

export const LIBRARY_ASK_EVENT = EVENT

export function isLibraryAskArmed(): boolean {
  return armed
}

export function getLibraryAskSnapshot(): boolean {
  return armed
}

export function subscribeLibraryAsk(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function armLibraryAsk(): void {
  armed = true
  emit()
}

export function disarmLibraryAsk(): void {
  if (!armed) return
  armed = false
  emit()
}

/** 用户发送时取走；没有武装则 false。 */
export function consumeLibraryAsk(): boolean {
  const on = armed
  armed = false
  if (on) emit()
  return on
}

/** 左栏「用这些资料提问」：武装，并通知输入框聚焦。 */
export function requestLibraryAsk(): void {
  armLibraryAsk()
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}
