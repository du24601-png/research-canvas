import type { CanvasLayoutItem } from './types'

function itemKey(item: CanvasLayoutItem): string {
  return [
    item.i,
    item.x,
    item.y,
    item.w,
    item.h,
    item.minW ?? '',
    item.minH ?? '',
  ].join(':')
}

export function normalizeLayout(layout: readonly CanvasLayoutItem[]): CanvasLayoutItem[] {
  return [...layout]
    .map(item => ({
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      ...(item.minW != null ? { minW: item.minW } : {}),
      ...(item.minH != null ? { minH: item.minH } : {}),
    }))
    .sort((left, right) => left.i.localeCompare(right.i))
}

export function layoutsEqual(
  left: readonly CanvasLayoutItem[],
  right: readonly CanvasLayoutItem[],
): boolean {
  if (left.length !== right.length) return false
  const a = normalizeLayout(left)
  const b = normalizeLayout(right)
  return a.every((item, index) => itemKey(item) === itemKey(b[index]!))
}

function cloneLayout(layout: readonly CanvasLayoutItem[]): CanvasLayoutItem[] {
  return layout.map(item => ({
    i: item.i,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    ...(item.minW != null ? { minW: item.minW } : {}),
    ...(item.minH != null ? { minH: item.minH } : {}),
  }))
}

/** Skip persist while drag/resize is active, and skip identical commits. */
export function nextCommittedLayout(input: {
  interactionActive: boolean
  current: readonly CanvasLayoutItem[]
  incoming: readonly CanvasLayoutItem[]
}): CanvasLayoutItem[] | null {
  if (input.interactionActive) return null
  if (layoutsEqual(input.current, input.incoming)) return null
  return cloneLayout(input.incoming)
}
