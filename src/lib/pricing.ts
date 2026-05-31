export interface ModelEntry {
  id: string
  name: string
  provider: string
  inputPer1M: number
  outputPer1M: number
  contextLength: number
  qualityIndex: number
  strengths: string
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/models'

// Quality index (0–100) and strengths for flagship models
const qualityMap: Record<string, { index: number; strengths: string }> = {
  'anthropic/claude-opus-4.8': { index: 95, strengths: 'Deep reasoning, creative coding, system analysis' },
  'anthropic/claude-opus-4.7': { index: 94, strengths: 'Creative coding, nuanced system analysis' },
  'anthropic/claude-sonnet-4.6': { index: 88, strengths: 'Fast coding, balanced performance' },
  'anthropic/claude-sonnet-4.5': { index: 85, strengths: 'Reliable coding, cost-effective' },
  'anthropic/claude-haiku-4.5': { index: 75, strengths: 'Quick tasks, lightweight coding' },
  'openai/gpt-5.5': { index: 100, strengths: 'Advanced reasoning, math, coding agents' },
  'openai/gpt-5.4': { index: 92, strengths: 'Strong reasoning, large context' },
  'openai/gpt-4.1': { index: 82, strengths: 'Solid general coding, mature SDK' },
  'openai/o3': { index: 90, strengths: 'Deep reasoning, complex problem-solving' },
  'openai/o4-mini': { index: 78, strengths: 'Fast reasoning, cost-efficient' },
  'google/gemini-3.1-pro': { index: 90, strengths: 'Multimodal, 1M+ context' },
  'google/gemini-2.5-pro': { index: 87, strengths: 'Large context, strong reasoning' },
  'google/gemini-2.5-flash': { index: 78, strengths: 'High-speed, low-cost operations' },
  'deepseek/deepseek-v4-pro': { index: 86, strengths: 'Extreme cost-to-performance value' },
  'deepseek/deepseek-v4-flash': { index: 72, strengths: 'Budget coding, high volume' },
  'mistral/mistral-large-3': { index: 80, strengths: 'Open-weight, strong multilingual' },
  'mistral/mistral-medium-3.5': { index: 83, strengths: 'Strong coding, mid-tier pricing' },
  'qwen/qwen3.6-27b': { index: 79, strengths: 'Open model, strong for size' },
  'moonshot/kimi-k2.6': { index: 84, strengths: 'Long context, strong Chinese + English' },
}

const flagshipIds = [
  // Anthropic
  'anthropic/claude-opus-4.8', 'anthropic/claude-opus-4.7',
  'anthropic/claude-sonnet-4.6', 'anthropic/claude-sonnet-4.5',
  'anthropic/claude-haiku-4.5',
  // OpenAI
  'openai/gpt-5.5', 'openai/gpt-5.4', 'openai/gpt-4.1',
  'openai/o3', 'openai/o4-mini',
  // Google
  'google/gemini-3.1-pro', 'google/gemini-2.5-pro', 'google/gemini-2.5-flash',
  // DeepSeek
  'deepseek/deepseek-v4-pro', 'deepseek/deepseek-v4-flash',
  // Mistral
  'mistral/mistral-large-3', 'mistral/mistral-medium-3.5',
  // Others
  'qwen/qwen3.6-27b', 'moonshot/kimi-k2.6',
]

function getProvider(id: string): string {
  const p = id.split('/')[0]
  const map: Record<string, string> = {
    anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google',
    deepseek: 'DeepSeek', mistral: 'Mistral', qwen: 'Alibaba',
    moonshot: 'Moonshot', meta: 'Meta', xai: 'xAI',
  }
  return map[p] || p.charAt(0).toUpperCase() + p.slice(1)
}

let cached: ModelEntry[] | null = null
let lastFetch = 0
const TTL = 1800000 // 30 min

export async function fetchModels(): Promise<ModelEntry[]> {
  if (cached && Date.now() - lastFetch < TTL) return cached

  const res = await fetch(OPENROUTER_URL)
  if (!res.ok) {
    if (cached) return cached
    throw new Error(`OpenRouter fetch failed: ${res.status}`)
  }

  const json = await res.json()
  const all: ModelEntry[] = (json.data || []).map((m: { id: string; name: string; pricing: { prompt: string; completion: string }; context_length: number }) => {
    const inputPer1M = parseFloat(m.pricing?.prompt || '0') * 1_000_000
    const outputPer1M = parseFloat(m.pricing?.completion || '0') * 1_000_000
    const q = qualityMap[m.id] || { index: 0, strengths: '' }
    // Strip "Provider: " prefix and fix casing
    let cleanName = (m.name || m.id).replace(/^[^:]+:\s*/, '')
    // Fix common capitalization issues
    cleanName = cleanName
      .replace(/\bGpt\b/g, 'GPT')
      .replace(/\bO4\b/g, 'O4')
      .replace(/\bO3\b/g, 'O3')
      .replace(/\bClaude\b/g, 'Claude')
      .replace(/\bGemini\b/g, 'Gemini')
      .replace(/\bDeepseek\b/gi, 'DeepSeek')
      .replace(/\bQwen\b/g, 'Qwen')
      .replace(/\bKimi\b/g, 'Kimi')
      .replace(/\bMistral\b/g, 'Mistral')
    return {
      id: m.id,
      name: cleanName,
      provider: getProvider(m.id),
      inputPer1M: Math.round(inputPer1M * 10000) / 10000,
      outputPer1M: Math.round(outputPer1M * 10000) / 10000,
      contextLength: m.context_length || 0,
      qualityIndex: q.index,
      strengths: q.strengths,
    }
  })

  cached = all
  lastFetch = Date.now()
  return all
}

export function getFlagshipModels(all: ModelEntry[]): ModelEntry[] {
  return flagshipIds
    .map((id) => all.find((m) => m.id === id))
    .filter(Boolean) as ModelEntry[]
}
