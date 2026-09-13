import { useCallback, useState } from 'react'
import { getHealth, listAvailableModels } from '../../api/client'
import type { AvailableModel } from '../../types/chat'

/** 服务健康 + 可用模型（原 ChatAppShell availableModels/defaultModel/llmLabel/backendOk 与 refresh 段逐字迁移） */
export function useSessionHealth() {
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([])
  const [defaultModel, setDefaultModel] = useState<string | undefined>()
  const [llmLabel, setLlmLabel] = useState('连接中…')
  const [backendOk, setBackendOk] = useState(false)

  const refreshModels = useCallback(async () => {
    try {
      const { models, default_model } = await listAvailableModels()
      setAvailableModels(models)
      setDefaultModel(default_model?.trim() || undefined)
      return models
    } catch {
      // 失败时保留已有列表，避免首启超时把选择器清空
      return []
    }
  }, [])

  const refreshHealth = useCallback(async () => {
    try {
      const health = await getHealth()
      setBackendOk(true)
      const models = await refreshModels()
      if (health.llm_configured && models.length) {
        setLlmLabel(`${models.length} 个可用模型`)
      } else if (health.llm_configured) {
        // health 已表示有模型，但列表请求失败：保持文案，勿暗示「未配置」
        setLlmLabel((prev) => (prev.includes('可用模型') ? prev : '模型已就绪'))
      } else {
        setLlmLabel('请先在设置中配置 AI 模型')
      }
    } catch {
      setBackendOk(false)
      setLlmLabel('服务未连接，请检查网络')
    }
  }, [refreshModels])

  return {
    availableModels,
    defaultModel,
    setDefaultModel,
    llmLabel,
    backendOk,
    refreshModels,
    refreshHealth,
  }
}
