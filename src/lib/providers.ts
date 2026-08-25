export interface ProviderModel {
  name: string
  id: string
  recommended?: boolean
  cheapest?: boolean
  /**
   * Context window in tokens. Drives the agent's auto-compaction budget. When
   * omitted, the agent falls back to providerDefaultContextWindow(providerId).
   */
  contextWindow?: number
}

export type ProviderApiFormat =
  | 'openai'
  | 'anthropic'
  | 'gemini'

export interface ProviderDef {
  id: string
  name: string
  baseUrl: string
  color: string
  logo: string
  apiFormat: ProviderApiFormat
  modelListPath?: string
  syncModels?: boolean
  testable: boolean
  testNote?: string
  /** Provider offers a usable free tier — surfaced as a badge in the UI. */
  freeTier?: boolean
  /** Direct link to the provider's "create API key" page. */
  getKeyUrl?: string
  /** Short, ordered steps shown in the key editor to guide first-time setup. */
  setupSteps?: string[]
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    color: '#74AA9C',
    logo: '/assets/openai.png',
    apiFormat: 'openai',
    testable: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    color: '#D4A574',
    logo: '/assets/anthropic.png',
    apiFormat: 'anthropic',
    testable: true,
  },
  {
    id: 'google',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    color: '#4285F4',
    logo: '/assets/google.png',
    apiFormat: 'gemini',
    testable: true,
    freeTier: true,
    getKeyUrl: 'https://aistudio.google.com/apikey',
    setupSteps: [
      'Click “Open Google AI Studio” below and sign in with your Google account.',
      'Press “Create API key” — Gemini has a free tier, so no credit card is needed to start.',
      'Copy the key, paste it into the field below, and hit “Save provider”.',
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    color: '#4D6BFE',
    logo: '/assets/deepseek.webp',
    apiFormat: 'openai',
    testable: true,
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    color: '#F59E0B',
    logo: '/assets/mistralai.png',
    apiFormat: 'openai',
    testable: true,
  },
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    color: '#F97316',
    logo: '/assets/groq.png',
    apiFormat: 'openai',
    testable: true,
  },
  {
    id: 'xai',
    name: 'xAI',
    baseUrl: 'https://api.x.ai/v1',
    color: '#E5E7EB',
    logo: '/assets/xai.png',
    apiFormat: 'openai',
    testable: true,
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    baseUrl: 'https://api.perplexity.ai',
    color: '#20B2AA',
    logo: '/assets/perplexity.png',
    apiFormat: 'openai',
    modelListPath: '/v1/models',
    syncModels: false,
    testable: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    color: '#6B46C1',
    logo: '/assets/openrouter.png',
    apiFormat: 'openai',
    testable: true,
  },
  {
    id: 'ollama',
    name: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    color: '#374151',
    logo: '/assets/ollama.png',
    apiFormat: 'openai',
    testable: true,
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    color: '#F59E0B',
    logo: '/assets/celebras.png',
    apiFormat: 'openai',
    testable: true,
  },
]

export const PROVIDER_DEFS = Object.fromEntries(
  PROVIDERS.map((provider) => [provider.id, provider]),
) as Record<string, ProviderDef>

export const LOGO_MAP = Object.fromEntries(
  PROVIDERS.map((provider) => [provider.id, provider.logo]),
) as Record<string, string>

export const DEFAULT_BASE_URLS = Object.fromEntries(
  PROVIDERS.map((provider) => [provider.id, provider.baseUrl]),
) as Record<string, string>

export const DEFAULT_PROVIDER_MODELS: Record<string, ProviderModel[]> = {
  openai: [
    // GPT-5.6 family (GA July 2026); the bare `gpt-5.6` alias routes to sol.
    { name: 'GPT-5.6 Sol', id: 'gpt-5.6-sol', recommended: true, contextWindow: 1_000_000 },
    { name: 'GPT-5.6 Terra', id: 'gpt-5.6-terra', contextWindow: 1_000_000 },
    { name: 'GPT-5.6 Luna', id: 'gpt-5.6-luna', cheapest: true, contextWindow: 1_000_000 },
    { name: 'GPT-5.5', id: 'gpt-5.5', contextWindow: 1_000_000 },
    { name: 'GPT-5.4 mini', id: 'gpt-5.4-mini', contextWindow: 1_000_000 },
  ],
  anthropic: [
    // Fable/Mythos/Opus 5/Sonnet 5 all run the 1M window by default now.
    { name: 'Claude Fable 5', id: 'claude-fable-5', contextWindow: 1_000_000 },
    { name: 'Claude Opus 5', id: 'claude-opus-5', contextWindow: 1_000_000 },
    { name: 'Claude Sonnet 5', id: 'claude-sonnet-5', recommended: true, contextWindow: 1_000_000 },
    { name: 'Claude Haiku 4.5', id: 'claude-haiku-4-5-20251001', cheapest: true, contextWindow: 200_000 },
    { name: 'Claude Mythos 5', id: 'claude-mythos-5', contextWindow: 1_000_000 },
  ],
  google: [
    { name: 'Gemini 3.7 Flash', id: 'gemini-3.7-flash', recommended: true, contextWindow: 1_000_000 },
    { name: 'Gemini 3.6 Flash', id: 'gemini-3.6-flash', contextWindow: 1_000_000 },
    { name: 'Gemini 3.5 Flash', id: 'gemini-3.5-flash', contextWindow: 1_000_000 },
    { name: 'Gemini 3.5 Flash-Lite', id: 'gemini-3.5-flash-lite', cheapest: true, contextWindow: 1_000_000 },
    { name: 'Gemini 3.1 Pro Preview', id: 'gemini-3.1-pro-preview', contextWindow: 1_000_000 },
  ],
  deepseek: [
    // deepseek-chat/deepseek-reasoner were retired July 24, 2026.
    { name: 'DeepSeek V4 Pro', id: 'deepseek-v4-pro', contextWindow: 1_000_000 },
    { name: 'DeepSeek V4 Flash', id: 'deepseek-v4-flash', contextWindow: 1_000_000 },
    { name: 'DeepSeek V4 Flash Vision (Experimental)', id: 'deepseek-v4-flash-vision-exp', contextWindow: 1_000_000 },
  ],
  mistral: [
    { name: 'Mistral Medium 3.5', id: 'mistral-medium-3-5', contextWindow: 256_000 },
    { name: 'Mistral Small 4', id: 'mistral-small-2603', contextWindow: 256_000 },
    { name: 'Mistral Large 3', id: 'mistral-large-2512', contextWindow: 256_000 },
    { name: 'Ministral 3 14B', id: 'ministral-14b-2512', contextWindow: 256_000 },
    { name: 'Ministral 3 8B', id: 'ministral-8b-2512', contextWindow: 128_000 },
  ],
  groq: [
    // llama-3.3-70b / llama-3.1-8b / qwen3-32b were shut down Aug 16, 2026.
    { name: 'GPT-OSS 120B', id: 'openai/gpt-oss-120b', recommended: true, contextWindow: 128_000 },
    { name: 'Qwen3.6 27B', id: 'qwen/qwen3.6-27b', contextWindow: 128_000 },
    { name: 'GPT-OSS 20B', id: 'openai/gpt-oss-20b', cheapest: true, contextWindow: 128_000 },
  ],
  xai: [
    // Grok 4.6 (Aug 2026) is the frontier model; grok-code-fast-1 is no longer listed.
    { name: 'Grok 4.6', id: 'grok-4.6', recommended: true, contextWindow: 500_000 },
    { name: 'Grok 4.5', id: 'grok-4.5', contextWindow: 500_000 },
    { name: 'Grok 4.3', id: 'grok-4.3', contextWindow: 1_000_000 },
    { name: 'Grok Build 0.1', id: 'grok-build-0.1', contextWindow: 256_000 },
  ],
  perplexity: [
    { name: 'Sonar Pro', id: 'sonar-pro', contextWindow: 200_000 },
    { name: 'Sonar', id: 'sonar', contextWindow: 128_000 },
    { name: 'Sonar Reasoning Pro', id: 'sonar-reasoning-pro', contextWindow: 128_000 },
    { name: 'Sonar Deep Research', id: 'sonar-deep-research', contextWindow: 128_000 },
  ],
  openrouter: [
    { name: 'GPT-5.6 Sol', id: 'openai/gpt-5.6-sol', recommended: true, contextWindow: 1_000_000 },
    { name: 'Claude Opus 5', id: 'anthropic/claude-opus-5', contextWindow: 1_000_000 },
    { name: 'Gemini 3.7 Flash', id: 'google/gemini-3.7-flash', contextWindow: 1_000_000 },
    { name: 'Grok 4.6', id: 'x-ai/grok-4.6', contextWindow: 500_000 },
    { name: 'DeepSeek V4 Pro', id: 'deepseek/deepseek-v4-pro', contextWindow: 1_000_000 },
  ],
  ollama: [
    // Local pulls — context depends on the user's machine, keep conservative.
    { name: 'Qwen3.8', id: 'qwen3.8', contextWindow: 32_000 },
    { name: 'Qwen3 Coder', id: 'qwen3-coder', contextWindow: 32_000 },
    { name: 'GLM 4.7 Flash', id: 'glm-4.7-flash', contextWindow: 32_000 },
    { name: 'Gemma 4', id: 'gemma4', contextWindow: 32_000 },
    { name: 'DeepSeek R1', id: 'deepseek-r1', contextWindow: 32_000 },
  ],
  cerebras: [
    // Public endpoints currently serve gpt-oss-120b + gemma-4-31b (GLM is
    // dedicated-endpoint-only).
    { name: 'GPT-OSS 120B', id: 'gpt-oss-120b', recommended: true, contextWindow: 128_000 },
    { name: 'Gemma 4 31B', id: 'gemma-4-31b', cheapest: true, contextWindow: 128_000 },
  ],
}

export function parseProviderModels(raw: string | null | undefined): ProviderModel[] {
  return (raw ?? '')
    .split(',')
    .map((item) => {
      // Format: name|id[|flag][|contextWindow]. flag is '', 'recommended' or
      // 'cheapest'; contextWindow (when present) is the 4th field. Older rows
      // without a contextWindow still parse cleanly.
      const [name, id, flag, ctx] = item.split('|').map((part) => part.trim())
      const contextWindow = ctx && /^\d+$/.test(ctx) ? parseInt(ctx, 10) : undefined
      return {
        name: name || id || '',
        id: id || name || '',
        recommended: flag === 'recommended',
        cheapest: flag === 'cheapest',
        contextWindow,
      }
    })
    .filter((model) => model.id.length > 0)
}

export function serializeProviderModels(models: ProviderModel[]): string {
  return models.map((model) => {
    const flag = model.recommended ? 'recommended' : model.cheapest ? 'cheapest' : ''
    const parts = [model.name, model.id]
    // Keep a flag placeholder so the contextWindow stays in the 4th position.
    if (flag || model.contextWindow != null) parts.push(flag)
    if (model.contextWindow != null) parts.push(String(model.contextWindow))
    return parts.join('|')
  }).join(', ')
}

/**
 * Fallback context window (tokens) for a provider when an individual model has
 * no explicit contextWindow — e.g. a user-added custom model. Conservative:
 * underestimating just compacts a little early, while overestimating risks a
 * hard context-overflow error from the provider.
 */
export function providerDefaultContextWindow(providerId: string): number {
  switch (providerId) {
    case 'openai':
    case 'google':
      return 1_000_000
    case 'anthropic':
      return 200_000
    case 'xai':
      return 256_000
    case 'ollama':
      return 32_000
    // deepseek, mistral, groq, perplexity, openrouter, cerebras and
    // anything unknown.
    default:
      return 128_000
  }
}

export function providerModelsFor(providerId: string): ProviderModel[] {
  return DEFAULT_PROVIDER_MODELS[providerId] ?? []
}
