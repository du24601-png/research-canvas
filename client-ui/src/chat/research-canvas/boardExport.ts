export type BoardExportRatio = '16:9' | '9:16'

const EXPORT_SIZES: Record<BoardExportRatio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
}

export function exportSizeForRatio(ratio: BoardExportRatio): { width: number; height: number } {
  return { ...EXPORT_SIZES[ratio] }
}

export function sanitizeBoardExportFilename(boardTitle: string): string {
  const base = boardTitle.trim() || '看板'
  const safe = base.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || '看板'
  return `${safe}-看板.png`
}

export function boardExportFooterLabel(latestPeriod: string | null): string {
  const period = latestPeriod?.trim() || '—'
  return `数据截至 ${period} · 数字来自公开财报，未编造`
}

function triggerDownload(href: string, filename: string): void {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function buildExportShell(
  boardTitle: string,
  footerText: string,
  ratio: BoardExportRatio,
): HTMLDivElement {
  const { width, height } = exportSizeForRatio(ratio)
  const shell = document.createElement('div')
  shell.style.cssText = [
    `width:${width}px`,
    `height:${height}px`,
    'display:flex',
    'flex-direction:column',
    'background:#ffffff',
    'color:#111111',
    'box-sizing:border-box',
    'font-family:system-ui,sans-serif',
    'position:fixed',
    'left:0',
    'top:0',
    'z-index:2147483646',
    'pointer-events:none',
    'overflow:hidden',
  ].join(';')

  const header = document.createElement('div')
  header.textContent = boardTitle
  header.style.cssText = 'padding:28px 36px 12px;font-size:34px;font-weight:700;line-height:1.25;'

  const body = document.createElement('div')
  body.dataset.boardExportBody = '1'
  body.style.cssText = 'flex:1;min-height:0;padding:0 24px;overflow:hidden;'

  const footer = document.createElement('div')
  footer.textContent = footerText
  footer.style.cssText = 'padding:16px 36px 24px;font-size:22px;color:#555;line-height:1.4;'

  shell.append(header, body, footer)
  return shell
}

function snapshotCanvases(root: HTMLElement): string[] {
  return [...root.querySelectorAll('canvas')].map((node) => {
    if (!(node instanceof HTMLCanvasElement)) return ''
    try {
      return node.toDataURL('image/png')
    } catch {
      return ''
    }
  })
}

function applyCanvasSnapshots(root: HTMLElement, urls: readonly string[]): void {
  [...root.querySelectorAll('canvas')].forEach((node, index) => {
    const url = urls[index]
    if (!url || !(node instanceof HTMLCanvasElement)) return
    const img = document.createElement('img')
    img.src = url
    img.alt = ''
    img.style.width = `${node.offsetWidth || node.width}px`
    img.style.height = `${node.offsetHeight || node.height}px`
    img.style.display = 'block'
    node.replaceWith(img)
  })
}

async function waitForExportImages(root: HTMLElement): Promise<void> {
  const images = [...root.querySelectorAll('img')]
  await Promise.all(images.map(image => image.decode().catch(() => undefined)))
}

async function captureShellPng(shell: HTMLDivElement, ratio: BoardExportRatio): Promise<string> {
  await waitForExportImages(shell)
  const { toPng } = await import('html-to-image')
  const { width, height } = exportSizeForRatio(ratio)
  return toPng(shell, {
    cacheBust: true,
    pixelRatio: 1,
    backgroundColor: '#ffffff',
    width,
    height,
  })
}

export async function exportResearchBoardPng(input: {
  boardRoot: HTMLElement
  boardTitle: string
  footerText: string
  ratio: BoardExportRatio
}): Promise<void> {
  const shell = buildExportShell(input.boardTitle, input.footerText, input.ratio)
  const body = shell.querySelector('[data-board-export-body="1"]')
  if (!(body instanceof HTMLElement)) {
    shell.remove()
    throw new Error('导出容器无效')
  }
  const canvasUrls = snapshotCanvases(input.boardRoot)
  const clone = input.boardRoot.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.research-canvas-board-toolbar, .research-canvas-toast').forEach(node => {
    node.remove()
  })
  applyCanvasSnapshots(clone, canvasUrls)
  clone.style.height = '100%'
  clone.style.minHeight = '0'
  clone.style.overflow = 'hidden'
  body.append(clone)
  document.body.append(shell)
  try {
    const dataUrl = await captureShellPng(shell, input.ratio)
    triggerDownload(dataUrl, sanitizeBoardExportFilename(input.boardTitle))
  } finally {
    shell.remove()
  }
}
