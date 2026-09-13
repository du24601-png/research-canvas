/**
 * 设置页 — 外部 MCP Server 设置。
 *
 * 双模式（布局段已拆分）：
 * 1. 预设模式（默认）：McpPresetPanel — 内置 MCP 服务，填写 API Key，Switch 开关即用
 * 2. JSON 模式：McpJsonPanel — CodeMirror 6 编辑器，支持完整自定义配置
 * 状态、校验与保存逻辑保留在本组件。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { makeStyles } from '@fluentui/react-components'
import { CloudRegular, CodeRegular } from '@fluentui/react-icons'
import {
  exportMcpServers,
  importMcpServers,
  getMcpPresets,
  applyMcpPreset,
  removeMcpPreset,
  testMcpServer,
  mcpPresetNeedsSecret,
  type McpPresetDef,
} from '../../api/client'
import type { McpServerFlatConfig } from '../../api/client'
import { useSettingsToast } from './SettingsToast'
import { SettingsModeTabs } from './SettingsPrimitives'
import McpPresetPanel from './McpPresetPanel'
import McpJsonPanel from './McpJsonPanel'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
})

type Mode = 'preset' | 'json'

const EMPTY_CONFIG = JSON.stringify({ mcpServers: {} }, null, 2)

function validateConfig(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return '配置不能为空'
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error('[mcp-servers] config parse failed:', detail)
    return '内容格式有误，请检查后重试'
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return '内容格式有误：顶层须为对象'
  }
  const obj = parsed as Record<string, unknown>
  const servers = obj.mcpServers
  if (servers === undefined) return '缺少 mcpServers 字段'
  if (typeof servers !== 'object' || servers === null || Array.isArray(servers)) {
    return 'mcpServers 须为对象'
  }
  for (const [id, cfg] of Object.entries(servers as Record<string, unknown>)) {
    if (!/^[a-z][a-z0-9_-]{1,63}$/.test(id)) {
      return `服务器 id "${id}" 无效（须小写字母开头，仅 a-z0-9_-）`
    }
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
      return `服务器 "${id}" 的配置须为对象`
    }
    const c = cfg as Record<string, unknown>
    if (!c.command && !c.url) {
      return `服务器 "${id}" 缺少 url（http/sse）或 command（stdio）`
    }
    if (c.type && !['stdio', 'http', 'sse'].includes(String(c.type))) {
      return `服务器 "${id}" 的 type 无效（支持 stdio / http / sse）`
    }
  }
  return null
}

function formatJson(raw: string): string | null {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return null
  }
}

export default function McpServersSettingsSection() {
  const s = useStyles()
  const { showToast } = useSettingsToast()
  const [mode, setMode] = useState<Mode>('preset')

  // ── 预设模式状态 ──
  const [presets, setPresets] = useState<McpPresetDef[]>([])
  const [presetsLoading, setPresetsLoading] = useState(true)
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [testing, setTesting] = useState<Record<string, boolean>>({})
  const [applying, setApplying] = useState<Record<string, boolean>>({})

  // ── JSON 模式状态 ──
  const [raw, setRaw] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // ── 加载预设 ──
  const loadPresets = useCallback(async () => {
    setPresetsLoading(true)
    try {
      const { presets: data } = await getMcpPresets()
      setPresets(data.sort((a, b) => a.sortOrder - b.sortOrder))
      // 预设 API key 回填：只合并后端返回的有效 key，不覆盖本地已有 key
      const keys: Record<string, string> = {}
      for (const p of data) {
        const svc = p.services.find(s => s.apiKeyPreview)
        if (svc?.apiKeyPreview) keys[p.id] = svc.apiKeyPreview
      }
      if (Object.keys(keys).length) setApiKeys(prev => ({ ...prev, ...keys }))
    } catch (e) {
      showToast(e instanceof Error ? e.message : '加载预设失败', 'error')
    } finally {
      setPresetsLoading(false)
    }
  }, [showToast])

  // ── 加载 JSON ──
  const loadJson = useCallback(async () => {
    setLoading(true)
    try {
      const data = await exportMcpServers()
      setRaw(JSON.stringify({ mcpServers: data.mcpServers }, null, 2))
      setDirty(false)
    } catch (e) {
      showToast(e instanceof Error ? e.message : '加载失败', 'error')
      setRaw(EMPTY_CONFIG)
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (mode === 'preset') {
      void loadPresets()
    } else {
      void loadJson()
    }
  }, [mode, loadPresets, loadJson])

  // ── 预设操作 ──

  /** Switch 切换：开→启用，关→停用 */
  const handleTogglePreset = async (presetId: string, enabled: boolean) => {
    const preset = presets.find(p => p.id === presetId)
    if (enabled) {
      const needsKey = preset ? mcpPresetNeedsSecret(preset) : true
      const apiKey = (apiKeys[presetId] ?? '').trim()
      if (needsKey && (!apiKey || apiKey.length < 4)) {
        showToast('请先填写有效的数据密钥', 'warning')
        return
      }
      setApplying(prev => ({ ...prev, [presetId]: true }))
      try {
        await applyMcpPreset(presetId, needsKey ? apiKey : undefined)
        showToast(`${preset?.title ?? presetId} 已启用`, 'success')
        await loadPresets()
      } catch (e) {
        showToast(e instanceof Error ? e.message : '启用失败', 'error')
      } finally {
        setApplying(prev => ({ ...prev, [presetId]: false }))
      }
    } else {
      setApplying(prev => ({ ...prev, [presetId]: true }))
      try {
        await removeMcpPreset(presetId)
        showToast('已停用', 'success')
        await loadPresets()
      } catch (e) {
        showToast(e instanceof Error ? e.message : '停用失败', 'error')
      } finally {
        setApplying(prev => ({ ...prev, [presetId]: false }))
      }
    }
  }

  /** 测试连接：对预设的第一个子服务测试 */
  const handleTestPreset = async (preset: McpPresetDef) => {
    const svc = preset.services[0]
    if (!svc || !svc.configured) {
      showToast('请先启用后再测试', 'warning')
      return
    }
    setTesting(prev => ({ ...prev, [preset.id]: true }))
    try {
      const result = await testMcpServer(svc.serverId)
      if (result.ok) {
        showToast(`✅ ${svc.title} 连接成功${result.tools?.length ? `（${result.tools.length} 个工具）` : ''}`, 'success')
      } else {
        showToast(result.message || '连接失败', 'error')
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : '测试请求失败', 'error')
    } finally {
      setTesting(prev => ({ ...prev, [preset.id]: false }))
    }
  }

  /** 自动保存：API Key 变化 1.5s 后自动保存到后端（无论启用与否） */
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    const targets: Array<{ id: string; key: string }> = []
    for (const p of presets) {
      if (!mcpPresetNeedsSecret(p)) continue
      const k = (apiKeys[p.id] ?? '').trim()
      if (k.length >= 4) targets.push({ id: p.id, key: k })
    }
    if (!targets.length) return
    autoSaveTimer.current = setTimeout(() => {
      for (const t of targets) {
        void applyMcpPreset(t.id, t.key)
      }
    }, 300)
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [apiKeys, presets])

  /** 失焦立即保存 */
  const handleSavePresetKey = useCallback(async (presetId: string) => {
    const preset = presets.find(p => p.id === presetId)
    if (preset && !mcpPresetNeedsSecret(preset)) return
    const k = (apiKeys[presetId] ?? '').trim()
    if (k.length >= 4) {
      try { await applyMcpPreset(presetId, k) } catch {}
    }
  }, [apiKeys, presets])

  // ── JSON 操作 ──
  const validationError = useMemo(() => {
    if (!dirty) return null
    return validateConfig(raw)
  }, [raw, dirty])

  const handleSaveJson = async () => {
    const err = validateConfig(raw)
    if (err) { showToast(err, 'error'); return }
    setSaving(true)
    try {
      const parsed = JSON.parse(raw) as { mcpServers: Record<string, McpServerFlatConfig> }
      await importMcpServers(parsed.mcpServers)
      showToast('已保存', 'success')
      setDirty(false)
    } catch (e) {
      showToast(e instanceof Error ? e.message : '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleFormat = useCallback(() => {
    const formatted = formatJson(raw)
    if (formatted) {
      setRaw(formatted)
      showToast('已格式化', 'success')
    } else {
      showToast('内容格式有误，无法格式化；请检查后重试', 'error')
    }
  }, [raw, showToast])

  // ── 渲染 ──
  return (
    <div className={s.root}>
      <SettingsModeTabs
        value={mode}
        onChange={setMode}
        items={[
          { id: 'preset', label: '预设', icon: <CloudRegular fontSize={14} /> },
          { id: 'json', label: 'JSON', icon: <CodeRegular fontSize={14} /> },
        ]}
        ariaLabel="配置方式"
      />

      {mode === 'preset' ? (
        <McpPresetPanel
          presets={presets}
          presetsLoading={presetsLoading}
          apiKeys={apiKeys}
          testing={testing}
          applying={applying}
          onToggle={(id, enabled) => { void handleTogglePreset(id, enabled) }}
          onTest={preset => { void handleTestPreset(preset) }}
          onKeyChange={(id, value) => setApiKeys(prev => ({ ...prev, [id]: value }))}
          onKeyBlur={id => { void handleSavePresetKey(id) }}
          onSwitchToJson={() => setMode('json')}
        />
      ) : (
        <McpJsonPanel
          raw={raw}
          loading={loading}
          saving={saving}
          dirty={dirty}
          validationError={validationError}
          onRawChange={value => { setRaw(value); setDirty(true) }}
          onFormat={handleFormat}
          onReset={() => { void loadJson() }}
          onSave={() => { void handleSaveJson() }}
          onSwitchToPreset={() => setMode('preset')}
        />
      )}
    </div>
  )
}
