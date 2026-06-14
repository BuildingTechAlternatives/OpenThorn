const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.'

export function getErrorMessage(error: unknown, fallback = GENERIC_ERROR_MESSAGE): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}

export interface AgentErrorInfo {
  title: string
  detail?: string
  tip?: string
}

const GEMINI_FLASH_LITE_ID = 'gemini-3.1-flash-lite'

function isExpensiveGeminiModel(modelId: string | undefined): boolean {
  return !!modelId && modelId.startsWith('gemini-') && modelId !== GEMINI_FLASH_LITE_ID
}

const GEMINI_FLASH_LITE_TIP = " This model is expensive and burns through free-tier quota quickly. Consider switching to Gemini 3.1 Flash Lite in the model selector — it's much cheaper and works great for most projects."

/**
 * Classify a raw agent/provider error message into a short title and an
 * actionable tip for the user. The raw message is kept as `detail`.
 */
export function describeAgentError(error: unknown, modelId?: string): AgentErrorInfo {
  const raw = getErrorMessage(error, 'The generation failed.')
  const detail = raw.length > 280 ? `${raw.slice(0, 280)}...` : raw
  const m = raw.toLowerCase()

  if (/\b401\b|unauthorized|invalid[_ -]?api[_ -]?key|invalid x-api-key|authentication[_ ]error|incorrect api key/.test(m)) {
    return {
      title: 'Authentication failed',
      detail,
      tip: 'Your API key looks incorrect or expired. Open the Providers page, re-paste the full key, and make sure it has no extra spaces.',
    }
  }
  if (/\b403\b|forbidden|permission denied|not authorized/.test(m)) {
    return {
      title: 'Access denied',
      detail,
      tip: "The key is valid but not allowed to use this model. Check the key's permissions or model access in your provider dashboard.",
    }
  }
  if (/\b402\b|insufficient[_ ]quota|insufficient[_ ]credit|billing|exceeded your current quota|balance|payment required/.test(m)) {
    return {
      title: 'Out of credits',
      detail,
      tip: 'Your provider account has run out of quota or credits. Add credits or check your billing settings, then try again.' + (isExpensiveGeminiModel(modelId) ? GEMINI_FLASH_LITE_TIP : ''),
    }
  }
  if (/\b429\b|rate[_ -]?limit|too many requests/.test(m)) {
    return {
      title: 'Rate limited',
      detail,
      tip: 'The provider is throttling requests. Wait a minute and try again, or switch to another provider or model.' + (isExpensiveGeminiModel(modelId) ? GEMINI_FLASH_LITE_TIP : ''),
    }
  }
  if (/model.*(not found|does not exist|not available)|\b404\b|no such model/.test(m)) {
    return {
      title: 'Model not found',
      detail,
      tip: "This model isn't available with your key. Pick a different model from the selector or check the model ID for your provider.",
    }
  }
  if (/\b(500|502|503|529)\b|overloaded|server[_ ]error|internal error|service unavailable|bad gateway/.test(m)) {
    return {
      title: 'Provider unavailable',
      detail,
      tip: 'The AI provider is having a temporary outage or is overloaded. Wait a moment and try again, or switch providers.',
    }
  }
  if (/timed out|timeout/.test(m)) {
    return {
      title: 'Request timed out',
      detail,
      tip: 'The provider took too long to respond. This is usually temporary — try again, or pick a faster model.',
    }
  }
  if (/failed to fetch|networkerror|network error|load failed|fetch failed/.test(m)) {
    return {
      title: 'Connection problem',
      detail,
      tip: 'We could not reach the provider. Check your internet connection, and if you use a custom base URL, verify it allows browser (CORS) requests.',
    }
  }
  if (/no enabled provider/.test(m)) {
    return {
      title: 'No provider configured',
      detail,
      tip: 'Add and enable an API key on the Providers page to start generating.',
    }
  }
  if (/could not connect to any provider/.test(m)) {
    return {
      title: 'All providers failed',
      detail,
      tip: 'Every configured provider returned an error. Check your API keys and enabled models on the Providers page.',
    }
  }
  return {
    title: 'Generation failed',
    detail,
    tip: 'This was likely a temporary issue — try again. If it keeps happening, check your provider keys on the Providers page.',
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function logError(context: string, error: unknown): void {
  console.error(`[${context}]`, error)
}

export function parseStoredJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch (error) {
    logError('Storage', error)
    return fallback
  }
}
