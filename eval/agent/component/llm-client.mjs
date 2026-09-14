export function joinCompletionsUrl(baseUrl) {
  const root = String(baseUrl ?? '').trim().replace(/\/+$/, '')
  if (!root) return '/chat/completions'
  if (/\/chat\/completions$/i.test(root)) return root
  return `${root}/chat/completions`
}

export function parseToolCallsFromResponse(data) {
  const msg = data?.choices?.[0]?.message
  return Array.isArray(msg?.tool_calls) ? msg.tool_calls : []
}

export function resolveLlmFromEnv(env = process.env) {
  const apiKey = String(env.EVAL_LLM_API_KEY || env.LLM_API_KEY || '').trim()
  const baseUrl = String(env.EVAL_LLM_BASE_URL || env.LLM_BASE_URL || '').trim()
  const model = String(env.EVAL_LLM_MODEL || env.LLM_MODEL || '').trim()
  if (!apiKey || !baseUrl || !model) return null
  return { apiKey, baseUrl, model }
}

export async function completeOpenAiRound(opts) {
  const url = joinCompletionsUrl(opts.baseUrl)
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      tools: opts.tools,
      tool_choice: 'auto',
      temperature: 0,
      max_tokens: 1024,
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
  })
  if (!resp.ok) {
    const text = (await resp.text()).slice(0, 300)
    throw new Error(`LLM HTTP ${resp.status}: ${text}`)
  }
  const data = await resp.json()
  return { calls: parseToolCallsFromResponse(data), model: opts.model }
}
