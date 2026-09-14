function pickProvider(doc, modelRef) {
  const providers = Array.isArray(doc?.providers) ? doc.providers : []
  if (typeof modelRef === 'string' && modelRef.includes(':')) {
    const i = modelRef.indexOf(':')
    const id = modelRef.slice(0, i)
    const hit = providers.find((p) => p.id === id)
    if (hit) return { provider: hit, model: modelRef.slice(i + 1) }
  }
  const fallback = providers.find((p) => p.api_key && p.base_url && p.models?.[0])
  if (!fallback) return null
  return { provider: fallback, model: fallback.models[0] }
}

export function llmFromAppConfigDoc(doc) {
  const picked = pickProvider(doc, doc?.default_model)
  if (!picked) return null
  const apiKey = String(picked.provider.api_key ?? '').trim()
  const baseUrl = String(picked.provider.base_url ?? '').trim()
  const model = String(picked.model ?? '').trim()
  if (!apiKey || !baseUrl || !model) return null
  return { apiKey, baseUrl, model }
}

export async function resolveLlmFromUserStore() {
  try {
    const { getUserDataStore } = await import('@opptrix/user-store')
    const doc = getUserDataStore().getDocument('app_config', 'default')
    return llmFromAppConfigDoc(doc)
  } catch {
    return null
  }
}
