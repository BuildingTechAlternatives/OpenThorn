export interface ProviderModel {
  name: string
  id: string
}

export type ProviderApiFormat =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'azure-openai'
  | 'bedrock'

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
    id: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    color: '#6366F1',
    logo: '/assets/togetherai.png',
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
    id: 'cohere',
    name: 'Cohere',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    color: '#39D353',
    logo: '/assets/cohere.png',
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
    id: 'rodiumai',
    name: 'RodiumAi',
    baseUrl: 'https://api.rodiumai.io/v1',
    color: '#4F46E5',
    logo: '/assets/rodiumai.png',
    apiFormat: 'openai',
    testable: true,
    getKeyUrl: 'https://rodiumai.io/dashboard/api-keys',
    setupSteps: [
      'Create a free account at rodiumai.io and open Dashboard → API Keys.',
      'Generate a production key (starts with rd_sk_) and copy it — shown only once.',
      'Recharge your wallet in RODI via Mobile Money if needed (billing uses prepaid balance, not a subscription).',
      'Paste the key below, test the connection, and pick a model for your project.',
    ],
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
    id: 'fireworks',
    name: 'Fireworks AI',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    color: '#EF4444',
    logo: '/assets/fireworks.png',
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
  {
    id: 'azure',
    name: 'Azure OpenAI',
    baseUrl: 'https://YOUR_RESOURCE.openai.azure.com/openai/v1',
    color: '#0078D4',
    logo: '/assets/azure.png',
    apiFormat: 'azure-openai',
    testable: true,
  },
  {
    id: 'bedrock',
    name: 'Amazon Bedrock',
    baseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com',
    color: '#FF9900',
    logo: '/assets/bedrock.png',
    apiFormat: 'bedrock',
    testable: false,
    testNote: 'Bedrock uses the AWS runtime/Converse API and cannot be tested through the generic browser model-list endpoint.',
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
    { name: 'GPT-5.5', id: 'gpt-5.5' },
    { name: 'GPT-5.5 Pro', id: 'gpt-5.5-pro' },
    { name: 'GPT-5.4', id: 'gpt-5.4' },
    { name: 'GPT-5.4 Pro', id: 'gpt-5.4-pro' },
    { name: 'GPT-5.4 mini', id: 'gpt-5.4-mini' },
  ],
  anthropic: [
    { name: 'Claude Fable 5', id: 'claude-fable-5' },
    { name: 'Claude Opus 4.8', id: 'claude-opus-4-8' },
    { name: 'Claude Sonnet 4.6', id: 'claude-sonnet-4-6' },
    { name: 'Claude Haiku 4.5', id: 'claude-haiku-4-5-20251001' },
    { name: 'Claude Mythos 5', id: 'claude-mythos-5' },
  ],
  google: [
    { name: 'Gemini 3.5 Flash', id: 'gemini-3.5-flash' },
    { name: 'Gemini 3.1 Pro Preview', id: 'gemini-3.1-pro-preview' },
    { name: 'Gemini 3 Flash Preview', id: 'gemini-3-flash-preview' },
    { name: 'Gemini 3.1 Flash-Lite', id: 'gemini-3.1-flash-lite' },
    { name: 'Gemini 3.1 Pro Preview (Custom Tools)', id: 'gemini-3.1-pro-preview-customtools' },
  ],
  deepseek: [
    { name: 'DeepSeek V4 Pro', id: 'deepseek-v4-pro' },
    { name: 'DeepSeek V4 Flash', id: 'deepseek-v4-flash' },
    { name: 'DeepSeek Chat (alias)', id: 'deepseek-chat' },
    { name: 'DeepSeek Reasoner (alias)', id: 'deepseek-reasoner' },
  ],
  mistral: [
    { name: 'Mistral Medium 3.5', id: 'mistral-medium-3-5' },
    { name: 'Mistral Small 4', id: 'mistral-small-2603' },
    { name: 'Mistral Large 3', id: 'mistral-large-2512' },
    { name: 'Ministral 3 14B', id: 'ministral-14b-2512' },
    { name: 'Ministral 3 8B', id: 'ministral-8b-2512' },
  ],
  groq: [
    { name: 'Llama 3.3 70B Versatile', id: 'llama-3.3-70b-versatile' },
    { name: 'GPT-OSS 120B', id: 'openai/gpt-oss-120b' },
    { name: 'Qwen3 32B', id: 'qwen/qwen3-32b' },
    { name: 'Llama 3.1 8B Instant', id: 'llama-3.1-8b-instant' },
    { name: 'Kimi K2 Instruct', id: 'moonshotai/kimi-k2-instruct-0905' },
  ],
  together: [
    { name: 'DeepSeek V4 Pro', id: 'deepseek-ai/DeepSeek-V4-Pro' },
    { name: 'Kimi K2.6', id: 'moonshotai/Kimi-K2.6' },
    { name: 'GLM-5.1', id: 'zai-org/GLM-5.1' },
    { name: 'Qwen3.5 397B A17B', id: 'Qwen/Qwen3.5-397B-A17B' },
    { name: 'GPT-OSS 120B', id: 'openai/gpt-oss-120b' },
  ],
  xai: [
    { name: 'Grok 4.3', id: 'grok-4.3' },
    { name: 'Grok 4.3 Latest', id: 'grok-4.3-latest' },
    { name: 'Grok Latest', id: 'grok-latest' },
    { name: 'Grok Build 0.1', id: 'grok-build-0.1' },
    { name: 'Grok Code Fast', id: 'grok-code-fast-1' },
  ],
  cohere: [
    { name: 'Command A+', id: 'command-a-plus-05-2026' },
    { name: 'Command A', id: 'command-a-03-2025' },
    { name: 'Command A Reasoning', id: 'command-a-reasoning-08-2025' },
    { name: 'Command A Vision', id: 'command-a-vision-07-2025' },
    { name: 'Command R7B', id: 'command-r7b-12-2024' },
  ],
  perplexity: [
    { name: 'Sonar Pro', id: 'sonar-pro' },
    { name: 'Sonar', id: 'sonar' },
    { name: 'Sonar Reasoning Pro', id: 'sonar-reasoning-pro' },
    { name: 'Sonar Deep Research', id: 'sonar-deep-research' },
  ],
  openrouter: [
    { name: 'GPT-5.5 Pro', id: 'openai/gpt-5.5-pro' },
    { name: 'Claude Opus 4.8', id: 'anthropic/claude-opus-4.8' },
    { name: 'Claude Fable 5', id: 'anthropic/claude-fable-5' },
    { name: 'Gemini 3.5 Flash', id: 'google/gemini-3.5-flash' },
    { name: 'DeepSeek V4 Pro', id: 'deepseek/deepseek-v4-pro' },
  ],
  rodiumai: [
    // Anthropic — full Claude lineup (tool_use); Fable excluded (creative/narrative, not ideal for site codegen)
    { name: 'Claude Haiku 4.5', id: 'anthropic/claude-haiku-4-5-20251001' },
    { name: 'Claude Sonnet 4.5', id: 'anthropic/claude-sonnet-4-5-20250929' },
    { name: 'Claude Sonnet 4.6', id: 'anthropic/claude-sonnet-4-6' },
    { name: 'Claude Opus 4.1', id: 'anthropic/claude-opus-4-1-20250805' },
    { name: 'Claude Opus 4.5', id: 'anthropic/claude-opus-4-5-20251101' },
    { name: 'Claude Opus 4.6', id: 'anthropic/claude-opus-4-6' },
    { name: 'Claude Opus 4.7', id: 'anthropic/claude-opus-4-7' },
    { name: 'Claude Opus 4.8', id: 'anthropic/claude-opus-4-8' },
    // Google
    { name: 'Gemini 3.5 Flash', id: 'google/gemini-3.5-flash' },
    { name: 'Gemini 2.5 Pro', id: 'google/gemini-2.5-pro' },
    { name: 'Gemini 3.1 Pro Preview', id: 'google/gemini-3.1-pro-preview' },
    // DeepSeek
    { name: 'DeepSeek V4 Pro', id: 'deepseek/deepseek-v4-pro' },
    { name: 'DeepSeek V4 Flash', id: 'deepseek/deepseek-v4-flash' },
    { name: 'DeepSeek V3.2', id: 'deepseek/deepseek-v3.2' },
    // OpenAI
    { name: 'GPT-5.4 mini', id: 'openai/gpt-5.4-mini' },
    { name: 'GPT-5.4', id: 'openai/gpt-5.4' },
    { name: 'GPT-5.3 Codex', id: 'openai/gpt-5.3-codex' },
    { name: 'GPT-5.5 Pro', id: 'openai/gpt-5.5-pro' },
    // Moonshot, Mistral, Meta, xAI
    { name: 'Kimi K2.6', id: 'moonshot-ai/kimi-k2.6' },
    { name: 'Kimi K2.5', id: 'moonshot-ai/kimi-k2.5' },
    { name: 'Mistral Large 3', id: 'mistral/mistral-large-3' },
    { name: 'Llama 3.3 70B Instruct', id: 'meta/llama-3.3-70b-instruct' },
    { name: 'Grok 4.3', id: 'xai/grok-4.3' },
  ],
  ollama: [
    { name: 'Llama 3.3', id: 'llama3.3' },
    { name: 'DeepSeek V3', id: 'deepseek-v3' },
    { name: 'Qwen3-VL', id: 'qwen3-vl' },
    { name: 'Llama 3.2 Vision', id: 'llama3.2-vision' },
    { name: 'Mistral Small', id: 'mistral-small' },
  ],
  fireworks: [
    { name: 'DeepSeek V4 Pro', id: 'accounts/fireworks/models/deepseek-v4-pro' },
    { name: 'Kimi K2.6', id: 'accounts/fireworks/models/kimi-k2p6' },
    { name: 'GLM 5.1', id: 'accounts/fireworks/models/glm-5p1' },
    { name: 'Qwen3.6 Plus', id: 'accounts/fireworks/models/qwen3p6-plus' },
    { name: 'MiniMax M2.7', id: 'accounts/fireworks/models/minimax-m2p7' },
  ],
  cerebras: [
    { name: 'Z.ai GLM 4.7', id: 'zai-glm-4.7' },
    { name: 'GPT-OSS 120B', id: 'gpt-oss-120b' },
  ],
  azure: [
    { name: 'GPT-5.5', id: 'gpt-5.5' },
    { name: 'GPT-5.4 Pro', id: 'gpt-5.4-pro' },
    { name: 'GPT-5.4', id: 'gpt-5.4' },
    { name: 'GPT-5.4 mini', id: 'gpt-5.4-mini' },
    { name: 'GPT-5.4 nano', id: 'gpt-5.4-nano' },
  ],
  bedrock: [
    { name: 'OpenAI GPT-5.5', id: 'openai.gpt-5.5' },
    { name: 'Claude Opus 4.8', id: 'anthropic.claude-opus-4-8' },
    { name: 'Claude Sonnet 4.6', id: 'anthropic.claude-sonnet-4-6' },
    { name: 'DeepSeek V3.2', id: 'deepseek.v3.2' },
    { name: 'GPT-OSS 120B', id: 'openai.gpt-oss-120b' },
  ],
  nvidia: [
    { name: 'DeepSeek R1', id: 'deepseek-ai/deepseek-r1' },
    { name: 'Llama 3.1 Nemotron Ultra 253B', id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1' },
  ],
}

export function parseProviderModels(raw: string | null | undefined): ProviderModel[] {
  return (raw ?? '')
    .split(',')
    .map((item) => {
      const [name, id] = item.split('|').map((part) => part.trim())
      return { name: name || id || '', id: id || name || '' }
    })
    .filter((model) => model.id.length > 0)
}

export function serializeProviderModels(models: ProviderModel[]): string {
  return models.map((model) => `${model.name}|${model.id}`).join(', ')
}

export function providerModelsFor(providerId: string): ProviderModel[] {
  return DEFAULT_PROVIDER_MODELS[providerId] ?? []
}
