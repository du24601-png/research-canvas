/** Preview plot → canvas: fixed ghost flies toward the right research panel. */
export function flyPreviewToCanvas(sourceElement: HTMLElement): void {
  if (typeof window === 'undefined') return
  const prefersReducedMotion = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReducedMotion) return

  const source = sourceElement.getBoundingClientRect()
  if (source.width < 8 || source.height < 8) return

  const target = document.querySelector('.research-canvas-root')
    ?? document.querySelector('.opptrix-right-panel')
  const targetRect = target?.getBoundingClientRect()
  if (!targetRect) return

  const ghost = document.createElement('div')
  ghost.className = 'research-adopt-fly-ghost'
  ghost.setAttribute('aria-hidden', 'true')
  ghost.style.left = `${source.left}px`
  ghost.style.top = `${source.top}px`
  ghost.style.width = `${source.width}px`
  ghost.style.height = `${source.height}px`
  document.body.appendChild(ghost)

  if (typeof ghost.animate !== 'function') {
    ghost.remove()
    return
  }

  const endLeft = targetRect.left + Math.min(targetRect.width * 0.45, 180)
  const endTop = targetRect.top + 56
  const endWidth = Math.max(96, source.width * 0.42)
  const endHeight = Math.max(72, source.height * 0.42)

  const animation = ghost.animate([
    {
      left: `${source.left}px`,
      top: `${source.top}px`,
      width: `${source.width}px`,
      height: `${source.height}px`,
      opacity: '0.92',
    },
    {
      left: `${endLeft}px`,
      top: `${endTop}px`,
      width: `${endWidth}px`,
      height: `${endHeight}px`,
      opacity: '0.18',
    },
  ], {
    duration: 420,
    easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
    fill: 'forwards',
  })

  void animation.finished.finally(() => {
    ghost.remove()
  })
}
