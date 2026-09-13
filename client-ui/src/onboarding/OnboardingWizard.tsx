import { useEffect, type ReactNode } from 'react'
import { isElectron } from '../platform/detect'

/**
 * 启动不再展示模型 / 扩展服务 / 行情来源等引导页。
 * 这些配置都在设置里，打开后直接进入对话。
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!isElectron()) return
    let cancelled = false
    const outer = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return
        document.documentElement.classList.remove('opptrix-electron-startup')
        window.electronAPI?.signalShellReady?.()
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(outer)
    }
  }, [])

  return <>{children}</>
}
