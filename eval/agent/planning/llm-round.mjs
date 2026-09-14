import { joinCompletionsUrl, parseToolCallsFromResponse } from '../component/llm-client.mjs'

export async function completePlanningRound(opts) {
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
  const msg = data?.choices?.[0]?.message ?? { role: 'assistant', content: '', tool_calls: [] }
  const raw = parseToolCallsFromResponse(data)
  const calls = raw.map((c, i) => ({ ...c, id: c.id || `call_${i + 1}` }))
  return {
    message: { role: 'assistant', content: msg.content ?? null, tool_calls: calls.length ? calls : undefined },
    calls,
  }
}
