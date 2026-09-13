import { useCallback, useEffect, useRef, useState } from 'react'
import { Spinner, Switch, Text, makeStyles, mergeClasses } from '@fluentui/react-components'
import {
  GlobeRegular,
  ListRegular,
  ShieldRegular,
} from '@fluentui/react-icons'
import { sandboxSettings as sandboxApi } from '../../api/client'
import { useDebouncedEffect } from '../../hooks/useDebouncedEffect'
import { opptrixCssVars } from '../../theme/tokens'
import {
  SettingsGroup,
  SettingsHint,
  SettingsModeTabs,
  SettingsRow,
  SettingsStaticBlock,
} from './SettingsPrimitives'
import { useSettingsToast } from './SettingsToast'
import SettingsMonospaceEditor from './SettingsMonospaceEditor'
import SandboxEnvironmentStatusCard from './SandboxEnvironmentStatusCard'

export interface SandboxSettings {
  allowed_domains: string[]
  allow_lan_access: boolean
  windows_isolation_mode: 'elevated' | 'unelevated'
}

const SETTINGS_SAVE_MS = 500

type Tab = 'status' | 'whitelist' | 'lan'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  saveHint: {
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
    padding: '4px 2px 0',
    minHeight: '16px',
  },
  saveHintActive: {
    color: opptrixCssVars.textSecondary,
  },
  riskHint: {
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textSecondary,
    lineHeight: 1.5,
    padding: '8px 2px 0',
  },
  riskIcon: {
    verticalAlign: '-2px',
    marginRight: '6px',
  },
})

type SaveState = 'idle' | 'pending' | 'saved' | 'error'

function domainsToText(domains: string[]): string {
  return domains.join('\n')
}

function textToDomains(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

const DEFAULT_SETTINGS: SandboxSettings = {
  allowed_domains: [],
  allow_lan_access: false,
  windows_isolation_mode: 'unelevated',
}

export default function SandboxSettingsSection() {
  const s = useStyles()
  const toast = useSettingsToast()
  const [tab, setTab] = useState<Tab>('status')
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<SandboxSettings>(DEFAULT_SETTINGS)
  const [domainsText, setDomainsText] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const skipSave = useRef(true)
  const baseline = useRef<SandboxSettings | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await sandboxApi.getSettings()
      const next: SandboxSettings = {
        allowed_domains: resp.settings.allowed_domains,
        allow_lan_access: resp.settings.allow_lan_access,
        windows_isolation_mode: resp.settings.windows_isolation_mode === 'elevated'
          ? 'elevated'
          : 'unelevated',
      }
      setSettings(next)
      setDomainsText(domainsToText(next.allowed_domains))
      baseline.current = next
      skipSave.current = true
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { void load() }, [load])

  useDebouncedEffect(() => {
    if (loading || skipSave.current) {
      skipSave.current = false
      return
    }
    const base = baseline.current
    if (!base) return

    const nextDomains = textToDomains(domainsText)
    const next: SandboxSettings = {
      allowed_domains: nextDomains,
      allow_lan_access: settings.allow_lan_access,
      windows_isolation_mode: settings.windows_isolation_mode,
    }
    if (
      base.allow_lan_access === next.allow_lan_access
      && base.windows_isolation_mode === next.windows_isolation_mode
      && domainsToText(base.allowed_domains) === domainsToText(next.allowed_domains)
    ) {
      return
    }

    setSaveState('pending')
    sandboxApi.saveSettings(next)
      .then(resp => {
        const saved: SandboxSettings = {
          allowed_domains: resp.settings.allowed_domains,
          allow_lan_access: resp.settings.allow_lan_access,
          windows_isolation_mode: resp.settings.windows_isolation_mode === 'elevated'
            ? 'elevated'
            : 'unelevated',
        }
        setSettings(saved)
        setDomainsText(domainsToText(saved.allowed_domains))
        baseline.current = saved
        setSaveState('saved')
        toast.showSuccess('已保存')
        window.setTimeout(() => setSaveState('idle'), 2000)
      })
      .catch((e: unknown) => {
        setSaveState('error')
        toast.showError(e instanceof Error ? e.message : '保存失败')
        window.setTimeout(() => setSaveState('idle'), 2000)
      })
  }, [
    domainsText,
    settings.allow_lan_access,
    settings.windows_isolation_mode,
    loading,
    toast,
  ], SETTINGS_SAVE_MS)

  const saveHintText = (() => {
    switch (saveState) {
      case 'pending': return '正在保存…'
      case 'saved': return '已保存'
      case 'error': return '保存失败，请重试'
      default: return ''
    }
  })()

  if (loading) {
    return (
      <div className={s.root}>
        <Spinner size="tiny" label="正在加载访问规则…" />
      </div>
    )
  }

  return (
    <div className={s.root}>
      <SettingsModeTabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'status', label: '环境状态', icon: <ShieldRegular fontSize={14} /> },
          { id: 'whitelist', label: '访问白名单', icon: <ListRegular fontSize={14} /> },
          { id: 'lan', label: '局域网', icon: <GlobeRegular fontSize={14} /> },
        ]}
        ariaLabel="沙箱与访问规则"
      />

      {tab === 'status' && (
        <>
          <SettingsHint>
            默认启用工作区隔离：命令仅限已授权文件夹，敏感路径受保护；默认可访问外网。
          </SettingsHint>
          <SandboxEnvironmentStatusCard />
          <Text className={mergeClasses(s.saveHint, saveState !== 'idle' && s.saveHintActive)} block>
            {saveHintText}
          </Text>
        </>
      )}

      {tab === 'whitelist' && (
        <>
          <SettingsHint>
            每行一个域名或地址，命中后不再询问。
          </SettingsHint>
          <SettingsMonospaceEditor
            value={domainsText}
            onChange={setDomainsText}
            height="320px"
            placeholder="每行一个域名或地址，例如 example.com 或 *.example.com"
          />
          <Text className={mergeClasses(s.saveHint, saveState !== 'idle' && s.saveHintActive)} block>
            {saveHintText}
          </Text>
        </>
      )}

      {tab === 'lan' && (
        <>
          <SettingsHint>
            开启后可授权本地网络内的目标。
          </SettingsHint>
          <SettingsGroup>
            <SettingsRow
              title="允许局域网访问"
              desc="开启后可授权你本地网络内的目标"
              control={(
                <Switch
                  checked={settings.allow_lan_access}
                  onChange={(_, data) => {
                    setSettings(prev => ({ ...prev, allow_lan_access: data.checked }))
                  }}
                />
              )}
              last
            />
          </SettingsGroup>
          {settings.allow_lan_access && (
            <SettingsStaticBlock>
              <Text className={s.riskHint} block>
                <ShieldRegular className={s.riskIcon} />
                仅添加你信任的地址，并留意每次访问确认。
              </Text>
            </SettingsStaticBlock>
          )}
        </>
      )}
    </div>
  )
}
