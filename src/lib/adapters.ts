/**
 * Provider Adapter Layer — abstracts differences between AI providers.
 * OpenAI-compatible format is the base; Anthropic and Gemini adapt accordingly.
 */

export interface UnifiedRequest {
  model: string
  messages: { role: string; content: string }[]
  maxTokens?: number
  temperature?: number
  stream?: boolean
}

export interface ProviderAdapter {
  readonly name: string
  readonly supportsCaching: boolean
  buildHeaders(apiKey: string): Record<string, string>
  buildPayload(req: UnifiedRequest): Record<string, unknown>
  parseStreamChunk(json: Record<string, unknown>): string | null
  parseError(status: number, body: unknown): string
  buildUrl(baseUrl: string, model: string): string
  applyCacheControl?(messages: { role: string; content: string }[]): unknown[]
}

/* ── OpenAI ───────────────────────────────────────── */

const openAiAdapter: ProviderAdapter = {
  name: 'openai',
  supportsCaching: true,

  buildHeaders(apiKey: string) {
    return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
  },

  buildPayload(req: UnifiedRequest) {
    return {
      model: req.model,
      messages: req.messages,
      max_tokens: req.maxTokens ?? 8192,
      temperature: req.temperature ?? 0.7,
      stream: req.stream ?? true,
    }
  },

  parseStreamChunk(json: Record<string, unknown>): string | null {
    const choices = json.choices as Array<{ delta?: { content?: string } }> | undefined
    return choices?.[0]?.delta?.content ?? null
  },

  parseError(status: number, body: unknown): string {
    const err = body as { error?: { message?: string; code?: string } }
    return err?.error?.message ?? `HTTP ${status}`
  },

  buildUrl(baseUrl: string) {
    return `${baseUrl}/chat/completions`
  },
}

/* ── Anthropic ────────────────────────────────────── */

const anthropicAdapter: ProviderAdapter = {
  name: 'anthropic',
  supportsCaching: true,

  buildHeaders(apiKey: string) {
    return {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    }
  },

  buildPayload(req: UnifiedRequest) {
    const systemMsg = req.messages.find((m) => m.role === 'system')
    const other = req.messages.filter((m) => m.role !== 'system')
    return {
      model: req.model,
      system: systemMsg?.content,
      messages: other.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: req.maxTokens ?? 8192,
      stream: req.stream ?? true,
    }
  },

  parseStreamChunk(json: Record<string, unknown>): string | null {
    if (json.type === 'content_block_delta') {
      return (json.delta as { text?: string })?.text ?? null
    }
    if (json.type === 'content_block_start') {
      const block = json.content_block as { text?: string }
      return block?.text ?? null
    }
    return null
  },

  applyCacheControl(messages: { role: string; content: string }[]): unknown[] {
    // Mark system content and large stable blocks as cacheable
    const result: unknown[] = []
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      if (i === 0 && msg.role === 'system') {
        result.push({
          role: msg.role,
          content: [{ type: 'text', text: msg.content, cache_control: { type: 'ephemeral' } }],
        })
      } else {
        result.push({ role: msg.role, content: msg.content })
      }
    }
    return result
  },

  parseError(status: number, body: unknown): string {
    const err = body as { error?: { message?: string } }
    return err?.error?.message ?? `HTTP ${status}`
  },

  buildUrl(baseUrl: string) {
    return `${baseUrl}/messages`
  },
}

/* ── Gemini ───────────────────────────────────────── */

const geminiAdapter: ProviderAdapter = {
  name: 'gemini',
  supportsCaching: true,

  buildHeaders(_apiKey: string) {
    return { 'Content-Type': 'application/json' }
  },

  buildPayload(req: UnifiedRequest) {
    const contents = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))
    const systemMsg = req.messages.find((m) => m.role === 'system')
    return {
      contents,
      systemInstruction: systemMsg
        ? { parts: [{ text: systemMsg.content }] }
        : undefined,
      generationConfig: {
        maxOutputTokens: req.maxTokens ?? 8192,
        temperature: req.temperature ?? 0.7,
      },
    }
  },

  parseStreamChunk(json: Record<string, unknown>): string | null {
    const candidates = json.candidates as Array<{
      content?: { parts?: Array<{ text?: string }> }
    }> | undefined
    return candidates?.[0]?.content?.parts?.[0]?.text ?? null
  },

  parseError(status: number, body: unknown): string {
    const err = body as { error?: { message?: string } }
    return err?.error?.message ?? `HTTP ${status}`
  },

  buildUrl(baseUrl: string, model: string) {
    return `${baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=`
  },
}

/* ── Registry ─────────────────────────────────────── */

export const ADAPTERS: Record<string, ProviderAdapter> = {
  openai: openAiAdapter,
  anthropic: anthropicAdapter,
  google: geminiAdapter,
  deepseek: openAiAdapter,
  groq: openAiAdapter,
  together: openAiAdapter,
  mistral: openAiAdapter,
}

export function getAdapter(providerKey: string): ProviderAdapter {
  return ADAPTERS[providerKey] ?? openAiAdapter
}
