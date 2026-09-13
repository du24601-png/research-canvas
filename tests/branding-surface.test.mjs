import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { PRODUCT_BRAND } from '../packages/shared/src/product-brand.ts'
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const USER_FACING_FILES = [
  'client-ui/index.html',
  'client-ui/public/manifest.webmanifest',
  'client-ui/src/pages/settings/AboutSettingsSection.tsx',
  'client-ui/src/pages/settings/settingsSearchIndex.ts',
  'client-ui/src/chat/ChatView.tsx',
  'client-ui/src/chat/chatWelcomeVariants.ts',
  'client-ui/src/chat/SessionSidebar.tsx',
  'client-ui/src/auth/LoginView.tsx',
  'client-ui/src/auth/recoveryCodesExport.ts',
  'client-ui/src/desktop/WindowFrameTitleBar.tsx',
  'client-ui/src/onboarding/OnboardingWizard.tsx',
  'client-ui/src/onboarding/OnboardingShell.tsx',
  'client-ui/src/onboarding/OnboardingLegalPanel.tsx',
  'client-ui/src/onboarding/manifest.ts',
  'client-ui/src/onboarding/OnboardingDataList.tsx',
  'packages/agent/src/chat-progress.ts',
  'packages/agent/src/app-context.ts',
  'packages/agent-workspace/src/python/agent-python-env-view.ts',
  'packages/a-stock-layer/src/providers/stockindex/settings.ts',
  'packages/a-stock-layer/src/providers/stockindex/manifest.ts',
]

/** Identifiers / legal URLs that may still contain Opptrix without being product chrome. */
const ALLOW_LINE = new RegExp(
  [
    'import\\s+.*Opptrix',
    'from\\s+[\'"][^\'"]*opptrix',
    'OpptrixButton',
    'OpptrixField',
    'OpptrixInput',
    'OpptrixSelect',
    'OpptrixOption',
    'OpptrixTextarea',
    'OpptrixSpinner',
    'OpptrixEmptyState',
    'OpptrixDialog',
    'OpptrixSegmented',
    'OpptrixDropdown',
    'OpptrixPopover',
    'OpptrixInline',
    'OpptrixSurface',
    'useOpptrix',
    'getOpptrix',
    'parseOpptrix',
    'buildOpptrix',
    'isOpptrix',
    'resolveOpptrix',
    'opptrix_',
    '=== \'opptrix\'',
    'X-Opptrix-Client',
    'opptrix-theme-preference',
    'opptrix-ws',
    '@opptrix',
    '--opptrix',
    'OPPTRIX_',
    'quant\\.opptrix\\.net',
    'quant\\.opptrix\\.net',
    'opptrixTokens',
    'opptrixCssVars',
    'opptrix-',
    'PRODUCT_BRAND',
  ].join('|'),
  'i',
)

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

test('PRODUCT_BRAND is the rename source of truth', () => {
  assert.equal(PRODUCT_BRAND.name, 'Research Canvas')
  assert.equal(PRODUCT_BRAND.shortName, 'Research Canvas')
  assert.equal(PRODUCT_BRAND.description, 'AI 投研 Agent · 交互式数据分析画布')
})

test('index.html and manifest do not leak Opptrix product brand', () => {
  const html = fs.readFileSync(path.join(repoRoot, 'client-ui/index.html'), 'utf8')
  assert.match(html, /<title>Research Canvas<\/title>/)
  assert.match(html, /name="application-name"[^>]*content="Research Canvas"/)
  assert.match(html, /name="apple-mobile-web-app-title"[^>]*content="Research Canvas"/)
  assert.match(html, /name="description"[^>]*content="AI 投研 Agent · 交互式数据分析画布"/)
  assert.doesNotMatch(html.replace(/opptrix-theme-preference/g, ''), /Opptrix/)

  const manifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'client-ui/public/manifest.webmanifest'), 'utf8'),
  )
  assert.equal(manifest.name, PRODUCT_BRAND.name)
  assert.equal(manifest.short_name, PRODUCT_BRAND.shortName)
  assert.equal(manifest.description, PRODUCT_BRAND.description)
})

test('user-facing client files have no leftover Opptrix chrome copy', () => {
  const leaks = []
  for (const rel of USER_FACING_FILES) {
    const file = path.join(repoRoot, rel)
    const raw = stripComments(fs.readFileSync(file, 'utf8'))
    const lines = raw.split(/\r?\n/)
    lines.forEach((line, i) => {
      if (!/Opptrix/i.test(line)) return
      if (ALLOW_LINE.test(line)) return
      leaks.push(`${rel}:${i + 1}: ${line.trim()}`)
    })
  }
  assert.deepEqual(leaks, [], leaks.join('\n'))
})
