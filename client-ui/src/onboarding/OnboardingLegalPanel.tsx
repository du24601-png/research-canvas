import { useEffect, useRef } from 'react'
import { Checkbox, Text, makeStyles, mergeClasses } from '@fluentui/react-components'
import { opptrixCssVars, opptrixTokens } from '../theme/tokens'
import { ONBOARDING_COPY } from './manifest'
import { useOnboardingShellStyles } from './OnboardingShell'

const useStyles = makeStyles({
  frame: {
    display: 'block',
    width: '100%',
    height: 'min(46vh, 440px)',
    minHeight: '220px',
    marginTop: '16px',
    marginBottom: '16px',
    border: `1px solid ${opptrixCssVars.borderStrong}`,
    borderRadius: opptrixTokens.radiusMd,
    backgroundColor: opptrixCssVars.surface,
    boxShadow: '0 1px 2px rgba(20, 20, 20, 0.04)',
    overflow: 'auto',
    padding: '12px 14px',
    boxSizing: 'border-box',
  },
  doc: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    fontSize: 'var(--opptrix-font-base)',
    color: opptrixCssVars.textSecondary,
    lineHeight: 1.65,
  },
})

export function OnboardingLegalPanel({
  agreed,
  onAgreedChange,
  finishError,
}: {
  agreed: boolean
  onAgreedChange: (checked: boolean) => void
  finishError?: string
}) {
  const s = useStyles()
  const shell = useOnboardingShellStyles()
  const agreeRowRef = useRef<HTMLLabelElement>(null)

  useEffect(() => {
    const el = agreeRowRef.current
    if (!el) return
    const important = (node: HTMLElement) => {
      node.style.setProperty('outline', 'none', 'important')
      node.style.setProperty('box-shadow', 'none', 'important')
      node.style.setProperty('outline-offset', '0', 'important')
    }
    important(el)
    el.querySelectorAll('*').forEach((node) => important(node as HTMLElement))
    const styleId = 'opptrix-agree-outline-none'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `
        .opptrix-onboarding-agree-checkbox,
        .opptrix-onboarding-agree-checkbox *,
        .opptrix-onboarding-agree-checkbox::before,
        .opptrix-onboarding-agree-checkbox::after,
        .opptrix-onboarding-agree-checkbox *::before,
        .opptrix-onboarding-agree-checkbox *::after {
          outline: none !important;
          outline-offset: 0 !important;
          box-shadow: none !important;
        }
      `
      document.head.appendChild(style)
    }
    const observer = new MutationObserver(() => {
      important(el)
      el.querySelectorAll('*').forEach((node) => important(node as HTMLElement))
    })
    observer.observe(el, { attributes: true, childList: true, subtree: true })
    return () => {
      observer.disconnect()
      const styleEl = document.getElementById(styleId)
      styleEl?.remove()
    }
  }, [])

  return (
    <>
      <Text className={shell.sectionTitle} block>{ONBOARDING_COPY.legal.title}</Text>
      <Text className={shell.sectionLead} block>{ONBOARDING_COPY.legal.desc}</Text>
      <div
        className={mergeClasses(s.frame, 'opptrix-onboarding-legal-doc')}
        role="document"
        aria-label="使用说明"
      >
        <div className={s.doc}>
          {ONBOARDING_COPY.legal.body.map(paragraph => (
            <Text key={paragraph} block>{paragraph}</Text>
          ))}
        </div>
      </div>
      <label ref={agreeRowRef} className={shell.agreeRow}>
        <Checkbox
          className="opptrix-onboarding-agree-checkbox"
          style={{ margin: 0 }}
          checked={agreed}
          onChange={(_, d) => onAgreedChange(!!d.checked)}
          aria-label="同意使用说明"
        />
        <span className={shell.agreeText}>
          {ONBOARDING_COPY.legal.agreeLabel}
        </span>
      </label>
      {finishError && (
        <Text className={shell.error} block role="alert">{finishError}</Text>
      )}
    </>
  )
}
