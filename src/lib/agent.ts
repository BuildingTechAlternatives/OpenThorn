import { AGENT_SYSTEM_PROMPT, AGENT_TOOLS, type ToolDefinition } from './agent-prompt'
import { buildPreview } from './preview-bundle'
import { supabase } from './supabase'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AgentCodeFile {
  path: string
  language: string
  code: string
}

export interface SelectedAgentModel {
  provider_id: string
  provider_name: string
  model_name: string
  model_id: string
}

export interface AgentProgressEvent {
  type: 'text' | 'tool_start' | 'tool_result' | 'files' | 'done' | 'status'
  text?: string
  toolName?: string
  toolInput?: Record<string, unknown>
  toolResult?: string
  toolError?: boolean
  files?: AgentCodeFile[]
  message?: string
}

export interface AgentRunInput {
  userId: string
  prompt: string
  title: string
  files: AgentCodeFile[]
  selectedModel?: SelectedAgentModel | null
  mode?: 'create' | 'refine'
  maxTurns?: number
  signal?: AbortSignal
  onProgress?: (event: AgentProgressEvent) => void
}

export interface AgentRunResult {
  files: AgentCodeFile[]
  turns: number
  providerName: string
  modelName: string
}

// ─── Internal Types ─────────────────────────────────────────────────────────

interface ProviderKeyRow {
  id: string
  provider_id: string
  provider_name: string
  api_key: string
  base_url: string | null
  models: string | null
  enabled: boolean
  is_custom: boolean | null
}

interface ModelInfo {
  name: string
  id: string
}

interface ResolvedProvider {
  key: ProviderKeyRow
  baseUrl: string
  model: ModelInfo
}

interface LlmMessage {
  role: 'user' | 'assistant'
  content: string | LlmContentBlock[]
}

interface LlmContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: string
  is_error?: boolean
}

interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  deepseek: 'https://api.deepseek.com/v1',
  mistral: 'https://api.mistral.ai/v1',
  groq: 'https://api.groq.com/openai/v1',
  together: 'https://api.together.xyz/v1',
}

/** Allowed provider hostnames — prevents SSRF via user-controlled base URLs. */
const ALLOWED_PROVIDER_HOSTS = new Set([
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  'api.deepseek.com',
  'api.mistral.ai',
  'api.groq.com',
  'api.together.xyz',
  'openrouter.ai',
  'api.openrouter.ai',
  'api.x.ai',
  'api.together.ai',
  'api.perplexity.ai',
  'api.fireworks.ai',
  'api.cerebras.ai',
  'api.github.com',
  'models.github.com',
  'integrate.api.nvidia.com',
])

/** Validate that a URL points to an allowed provider host. */
function validateProviderUrl(raw: string): string {
  const clean = raw.replace(/\/+$/, '')
  let hostname: string
  try {
    hostname = new URL(clean).hostname.toLowerCase()
  } catch {
    throw new Error(`Invalid base URL: ${clean.slice(0, 100)}`)
  }
  if (!ALLOWED_PROVIDER_HOSTS.has(hostname)) {
    throw new Error(
      `Provider URL host "${hostname}" is not in the allowed list. ` +
      `Use one of: ${[...ALLOWED_PROVIDER_HOSTS].sort().join(', ')}`,
    )
  }
  return clean
}

const MAX_OUTPUT_TOKENS = 8192
const MAX_TOOL_TURNS = 20

// ─── Main Agent Loop ────────────────────────────────────────────────────────

export async function runBloomAgent(input: AgentRunInput): Promise<AgentRunResult> {
  const provider = await resolveProvider(input.userId, input.selectedModel ?? null)
  const providerName = provider.key.provider_name || input.selectedModel?.provider_name || provider.key.provider_id
  const modelName = input.selectedModel?.model_name || provider.model.name || provider.model.id

  input.onProgress?.({ type: 'status', message: `Connected to ${providerName} / ${modelName}` })

  const isNewProject = input.files.length === 0 || input.files[0].path === 'No files yet'

  // Build initial messages
  const messages: LlmMessage[] = [
    {
      role: 'user',
      content: buildUserPrompt(input.prompt, input.title, input.files, input.mode ?? 'create', isNewProject),
    },
  ]

  let currentFiles = normalizeFiles(input.files)
  let turnCount = 0

  // Tool execution loop
  while (turnCount < MAX_TOOL_TURNS) {
    throwIfAborted(input.signal)
    turnCount++

    // Call the model with tools
    const { text, toolCalls, rawContent } = await callModelWithTools({
      providerId: provider.key.provider_id,
      baseUrl: provider.baseUrl,
      apiKey: provider.key.api_key,
      modelId: provider.model.id,
      system: AGENT_SYSTEM_PROMPT,
      tools: AGENT_TOOLS,
      messages,
      signal: input.signal,
      onText: (chunk) => {
        input.onProgress?.({ type: 'text', text: chunk })
      },
    })

    // Build assistant message blocks
    const assistantBlocks: LlmContentBlock[] = []

    if (text) {
      assistantBlocks.push({ type: 'text', text })
    }

    // Collect tool_use blocks for the assistant message
    for (const tc of toolCalls) {
      assistantBlocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input })
    }

    // Push assistant message FIRST (before tool results)
    if (assistantBlocks.length > 0) {
      messages.push({ role: 'assistant', content: assistantBlocks })
    } else if (!text && toolCalls.length === 0) {
      break
    }

    // Now execute tools and push tool results AFTER the assistant message
    for (const tc of toolCalls) {
      input.onProgress?.({ type: 'tool_start', toolName: tc.name, toolInput: tc.input })

      const result = await executeTool(tc, currentFiles, input.signal)

      input.onProgress?.({
        type: 'tool_result',
        toolName: tc.name,
        toolResult: result.content,
        toolError: result.isError,
        files: result.files,
      })

      if (result.files) {
        currentFiles = result.files
      }

      // Push tool result — must come AFTER the assistant message with tool_use
      messages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: tc.id,
            content: result.content,
            is_error: result.isError,
          },
        ],
      })

      // If done tool was called, return
      if (tc.name === 'done') {
        input.onProgress?.({ type: 'done', files: currentFiles })
        return {
          files: currentFiles,
          turns: turnCount,
          providerName,
          modelName,
        }
      }
    }
  }

  input.onProgress?.({ type: 'done', files: currentFiles })
  return {
    files: currentFiles,
    turns: turnCount,
    providerName,
    modelName,
  }
}

// ─── Tool Execution ─────────────────────────────────────────────────────────

interface ToolResult {
  content: string
  isError: boolean
  files?: AgentCodeFile[]
}

async function executeTool(
  toolCall: ToolCall,
  currentFiles: AgentCodeFile[],
  signal?: AbortSignal,
): Promise<ToolResult> {
  throwIfAborted(signal)

  switch (toolCall.name) {
    case 'think': {
      const thought = String(toolCall.input.thought ?? '')
      return { content: thought, isError: false }
    }

    case 'list_files': {
      if (currentFiles.length === 0) {
        return { content: 'No files in the project yet.', isError: false }
      }
      const listing = currentFiles
        .map((f) => `  ${f.path}  (${f.language}, ${f.code.split('\n').length} lines)`)
        .join('\n')
      return { content: `${currentFiles.length} files:\n${listing}`, isError: false }
    }

    case 'read_file': {
      const path = normalizePath(String(toolCall.input.path ?? ''))
      const file = currentFiles.find((f) => f.path === path)
      if (!file) {
        return { content: `File not found: ${path}`, isError: true }
      }
      const numbered = file.code
        .split('\n')
        .map((line, i) => `${String(i + 1).padStart(4, ' ')}  ${line}`)
        .join('\n')
      return { content: numbered, isError: false }
    }

    case 'write_file': {
      const path = normalizePath(String(toolCall.input.path ?? ''))
      const language = String(toolCall.input.language ?? 'tsx')
      const code = String(toolCall.input.code ?? '')

      if (!code.trim()) {
        return { content: 'Error: file code must not be empty.', isError: true }
      }
      if (!path.startsWith('src/')) {
        return { content: `Error: file path must be under src/. Got: ${path}`, isError: true }
      }
      if (path.includes('..')) {
        return { content: `Error: path traversal not allowed: ${path}`, isError: true }
      }

      const newFiles = upsertFile(currentFiles, { path, language, code })
      return {
        content: `Wrote ${path} (${code.split('\n').length} lines, ${code.length} chars).`,
        isError: false,
        files: newFiles,
      }
    }

    case 'edit_file': {
      const path = normalizePath(String(toolCall.input.path ?? ''))
      const oldStr = String(toolCall.input.old_string ?? '')
      const newStr = String(toolCall.input.new_string ?? '')

      const file = currentFiles.find((f) => f.path === path)
      if (!file) {
        return { content: `File not found: ${path}. Use list_files to see what exists.`, isError: true }
      }
      if (!oldStr) {
        return { content: 'Error: old_string must not be empty.', isError: true }
      }
      if (oldStr === newStr) {
        return { content: 'Error: old_string and new_string are identical.', isError: true }
      }

      const count = file.code.split(oldStr).length - 1
      if (count === 0) {
        return {
          content: `Error: old_string not found in ${path}. The text must match exactly including indentation.`,
          isError: true,
        }
      }
      if (count > 1) {
        return {
          content: `Error: old_string appears ${count} times in ${path}. Make it more specific to be unique.`,
          isError: true,
        }
      }

      const newCode = file.code.replace(oldStr, newStr)
      const newFiles = currentFiles.map((f) => (f.path === path ? { ...f, code: newCode } : f))
      return {
        content: `Edited ${path}: replaced ${oldStr.length} chars with ${newStr.length} chars.`,
        isError: false,
        files: newFiles,
      }
    }

    case 'compile': {
      if (currentFiles.length === 0) {
        return { content: 'No files to compile.', isError: false }
      }

      try {
        const preview = await buildPreview(currentFiles.map((f) => ({ path: f.path, content: f.code })))
        if (preview.errors.length === 0) {
          return { content: 'Compilation successful. No errors.', isError: false }
        }
        return {
          content: `Compilation found ${preview.errors.length} error(s):\n${preview.errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n')}`,
          isError: true,
        }
      } catch (err) {
        return {
          content: `Compilation crashed: ${err instanceof Error ? err.message : String(err)}`,
          isError: true,
        }
      }
    }

    case 'done': {
      const summary = String(toolCall.input.summary ?? 'Project complete.')
      const nextSuggestions = Array.isArray(toolCall.input.nextSuggestions)
        ? toolCall.input.nextSuggestions.filter((s: unknown) => typeof s === 'string')
        : []
      return {
        content: JSON.stringify({ summary, nextSuggestions }),
        isError: false,
        files: currentFiles,
      }
    }

    default:
      return { content: `Unknown tool: ${toolCall.name}`, isError: true }
  }
}

// ─── Model Calling with Tools ───────────────────────────────────────────────

interface ModelCallResult {
  text: string
  toolCalls: ToolCall[]
  rawContent: string
}

async function callModelWithTools({
  providerId,
  baseUrl,
  apiKey,
  modelId,
  system,
  tools,
  messages,
  signal,
  onText,
}: {
  providerId: string
  baseUrl: string
  apiKey: string
  modelId: string
  system: string
  tools: ToolDefinition[]
  messages: LlmMessage[]
  signal?: AbortSignal
  onText: (chunk: string) => void
}): Promise<ModelCallResult> {
  if (providerId === 'anthropic') {
    return callAnthropicWithTools({ baseUrl, apiKey, modelId, system, tools, messages, signal, onText })
  }
  if (providerId === 'google') {
    return callGeminiWithTools({ baseUrl, apiKey, modelId, system, tools, messages, signal, onText })
  }
  return callOpenAIWithTools({ baseUrl, apiKey, modelId, system, tools, messages, signal, onText })
}

// ─── OpenAI-compatible (function calling) ───────────────────────────────────

function toolsToOpenAIFormat(tools: ToolDefinition[]) {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }))
}

function toolsToAnthropicFormat(tools: ToolDefinition[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }))
}

async function callOpenAIWithTools({
  baseUrl,
  apiKey,
  modelId,
  system,
  tools,
  messages,
  signal,
  onText,
}: {
  baseUrl: string
  apiKey: string
  modelId: string
  system: string
  tools: ToolDefinition[]
  messages: LlmMessage[]
  signal?: AbortSignal
  onText: (chunk: string) => void
}): Promise<ModelCallResult> {
  const url = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`

  // Convert messages to OpenAI format
  const openaiMessages = [
    { role: 'system', content: system },
    ...messages.map(convertToOpenAIMessage),
  ]

  const openaiTools = toolsToOpenAIFormat(tools)

  // Try with function calling first, fall back without.
  // Different providers support different parameter combinations.
  const attempts: Array<Record<string, unknown>> = [
    { tools: openaiTools, stream: true },
    { tools: openaiTools, stream: true, tool_choice: 'auto' },
    { tools: openaiTools, stream: false },
    { stream: true },
  ]

  let lastError = ''
  for (const attempt of attempts) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: openaiMessages,
          temperature: 0.22,
          max_tokens: MAX_OUTPUT_TOKENS,
          ...attempt,
        }),
        signal,
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        let errorPayload: unknown = ''
        try { errorPayload = JSON.parse(errorText) } catch { errorPayload = errorText }
        lastError = `${response.status}: ${typeof errorPayload === 'string' ? errorPayload.slice(0, 300) : JSON.stringify(errorPayload).slice(0, 300)}`
        if (response.status !== 400 && response.status !== 422) break
        continue
      }

      // Check if this is a streaming response
      const isStream = attempt.stream === true
      const result = isStream
        ? await parseOpenAIToolStream(response, onText)
        : await parseOpenAINonStream(response, onText)
      if (result) return result
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      lastError = err instanceof Error ? err.message : String(err)
    }
  }

  throw new Error(lastError || 'Provider request failed.')
}

async function parseOpenAINonStream(
  response: Response,
  onText: (chunk: string) => void,
): Promise<ModelCallResult | null> {
  const payload = await response.json().catch(() => null)
  if (!payload) return null

  const choice = payload?.choices?.[0]
  const message = choice?.message
  if (!message) return null

  const text = typeof message.content === 'string' ? message.content : ''
  if (text) onText(text)

  const toolCalls: ToolCall[] = []
  if (Array.isArray(message.tool_calls)) {
    for (const tc of message.tool_calls) {
      if (tc.type === 'function' && tc.function) {
        try {
          toolCalls.push({
            id: tc.id || `call_${toolCalls.length}`,
            name: tc.function.name,
            input: typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : (tc.function.arguments ?? {}),
          })
        } catch {
          // Skip invalid tool calls
        }
      }
    }
  }

  return { text, toolCalls, rawContent: text }
}

async function parseOpenAIToolStream(
  response: Response,
  onText: (chunk: string) => void,
): Promise<ModelCallResult | null> {
  const reader = response.body?.getReader()
  if (!reader) return null

  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const choice = parsed?.choices?.[0]
          const delta = choice?.delta

          if (delta?.content) {
            fullText += delta.content
            onText(delta.content)
          }

          // Handle tool calls from streaming
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0
              if (!toolCalls.has(idx)) {
                toolCalls.set(idx, { id: tc.id ?? `call_${idx}`, name: tc.function?.name ?? '', arguments: '' })
              }
              const existing = toolCalls.get(idx)!
              if (tc.id) existing.id = tc.id
              if (tc.function?.name) existing.name = tc.function.name
              if (tc.function?.arguments) existing.arguments += tc.function.arguments
            }
          }
        } catch {
          // Skip unparseable lines
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  const parsedToolCalls: ToolCall[] = []
  for (const tc of toolCalls.values()) {
    if (tc.name) {
      try {
        parsedToolCalls.push({
          id: tc.id,
          name: tc.name,
          input: JSON.parse(tc.arguments || '{}'),
        })
      } catch {
        // Skip tool calls with invalid JSON arguments
      }
    }
  }

  return { text: fullText, toolCalls: parsedToolCalls, rawContent: fullText }
}

// ─── Anthropic (native tool_use) ────────────────────────────────────────────

async function callAnthropicWithTools({
  baseUrl,
  apiKey,
  modelId,
  system,
  tools,
  messages,
  signal,
  onText,
}: {
  baseUrl: string
  apiKey: string
  modelId: string
  system: string
  tools: ToolDefinition[]
  messages: LlmMessage[]
  signal?: AbortSignal
  onText: (chunk: string) => void
}): Promise<ModelCallResult> {
  const anthropicMessages = messages.map(convertToAnthropicMessage)

  const response = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.22,
      system,
      tools: toolsToAnthropicFormat(tools),
      messages: anthropicMessages,
      stream: true,
    }),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    let errorPayload: unknown = ''
    try { errorPayload = JSON.parse(errorText) } catch { errorPayload = errorText }
    throw new Error(`Anthropic ${response.status}: ${typeof errorPayload === 'string' ? errorPayload.slice(0, 400) : JSON.stringify(errorPayload).slice(0, 400)}`)
  }

  return parseAnthropicToolStream(response, onText)
}

async function parseAnthropicToolStream(
  response: Response,
  onText: (chunk: string) => void,
): Promise<ModelCallResult> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body not readable')

  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  const toolCalls: Map<number, { id: string; name: string; input: string }> = new Map()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()

        try {
          const parsed = JSON.parse(data)

          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            fullText += parsed.delta.text
            onText(parsed.delta.text)
          }

          if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'tool_use') {
            const cb = parsed.content_block
            toolCalls.set(parsed.index, { id: cb.id, name: cb.name, input: '' })
          }

          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'input_json_delta') {
            const existing = toolCalls.get(parsed.index)
            if (existing) {
              existing.input += parsed.delta.partial_json
            }
          }
        } catch {
          // Skip unparseable
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  const parsedToolCalls: ToolCall[] = []
  for (const tc of toolCalls.values()) {
    try {
      parsedToolCalls.push({
        id: tc.id,
        name: tc.name,
        input: tc.input ? JSON.parse(tc.input) : {},
      })
    } catch {
      // Skip invalid
    }
  }

  return { text: fullText, toolCalls: parsedToolCalls, rawContent: fullText }
}

// ─── Gemini (function calling) ──────────────────────────────────────────────

async function callGeminiWithTools({
  baseUrl,
  apiKey,
  modelId,
  system,
  tools,
  messages,
  signal,
  onText,
}: {
  baseUrl: string
  apiKey: string
  modelId: string
  system: string
  tools: ToolDefinition[]
  messages: LlmMessage[]
  signal?: AbortSignal
  onText: (chunk: string) => void
}): Promise<ModelCallResult> {
  const cleanModel = modelId.replace(/^models\//, '')
  const url = `${baseUrl}/models/${encodeURIComponent(cleanModel)}:streamGenerateContent?alt=sse`

  // Convert tools to Gemini format
  const functionDeclarations = tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  }))

  const systemParts = system ? [{ text: system }] : []

  // Convert messages
  const contents = messages.map((msg) => {
    const role = msg.role === 'assistant' ? 'model' : 'user'
    if (typeof msg.content === 'string') {
      return { role, parts: [{ text: msg.content }] }
    }
    // Convert content blocks to Gemini parts
    const parts: Array<Record<string, unknown>> = []
    for (const block of msg.content) {
      if (block.type === 'text' && block.text) {
        parts.push({ text: block.text })
      } else if (block.type === 'tool_use') {
        parts.push({
          functionCall: {
            name: block.name,
            args: block.input ?? {},
          },
        })
      } else if (block.type === 'tool_result') {
        parts.push({
          functionResponse: {
            name: 'tool_result', // Gemini requires a name
            response: { content: block.content, is_error: block.is_error },
          },
        })
      }
    }
    return { role, parts: parts.length > 0 ? parts : [{ text: '' }] }
  })

  const response = await fetch(url, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: systemParts.length > 0 ? { parts: systemParts } : undefined,
      contents,
      tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined,
      generationConfig: {
        temperature: 0.22,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
    }),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Gemini ${response.status}: ${errorText.slice(0, 400)}`)
  }

  return parseGeminiToolStream(response, onText)
}

async function parseGeminiToolStream(
  response: Response,
  onText: (chunk: string) => void,
): Promise<ModelCallResult> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body not readable')

  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  const toolCalls: ToolCall[] = []
  let toolIdCounter = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()

        try {
          const parsed = JSON.parse(data)
          const parts = parsed?.candidates?.[0]?.content?.parts

          if (parts) {
            for (const part of parts) {
              if (part.text) {
                fullText += part.text
                onText(part.text)
              }
              if (part.functionCall) {
                toolIdCounter++
                toolCalls.push({
                  id: `call_${toolIdCounter}`,
                  name: part.functionCall.name,
                  input: part.functionCall.args ?? {},
                })
              }
            }
          }
        } catch {
          // Skip
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return { text: fullText, toolCalls, rawContent: fullText }
}

// ─── Message Conversion Helpers ─────────────────────────────────────────────

function convertToOpenAIMessage(msg: LlmMessage): Record<string, unknown> {
  if (typeof msg.content === 'string') {
    return { role: msg.role, content: msg.content }
  }

  // Check if this is a tool result message
  const toolResults = msg.content.filter((b) => b.type === 'tool_result')
  if (toolResults.length > 0) {
    // OpenAI expects ONE tool result per message with role: "tool" and tool_call_id
    // We send the first one if there's only one, or return an array of tool messages
    if (toolResults.length === 1) {
      return {
        role: 'tool',
        tool_call_id: toolResults[0].tool_use_id,
        content: toolResults[0].content ?? '',
      }
    }
    // Multiple tool results — handled by the caller splitting them
    return {
      role: 'tool',
      tool_call_id: toolResults[0].tool_use_id,
      content: toolResults[0].content ?? '',
    }
  }

  // Convert content blocks to OpenAI format for assistant messages
  const openaiContent: Record<string, unknown>[] = []
  const toolCalls: Record<string, unknown>[] = []

  for (const block of msg.content) {
    if (block.type === 'text' && block.text) {
      openaiContent.push({ type: 'text', text: block.text })
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        type: 'function',
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input ?? {}),
        },
      })
    }
  }

  if (toolCalls.length > 0 && msg.role === 'assistant') {
    return { role: 'assistant', content: openaiContent.length > 0 ? openaiContent : null, tool_calls: toolCalls }
  }

  if (msg.role === 'assistant' && openaiContent.length > 0) {
    return { role: 'assistant', content: openaiContent }
  }

  return { role: msg.role, content: msg.content.map((b) => b.content ?? b.text ?? '').join('\n') }
}

function convertToAnthropicMessage(msg: LlmMessage): Record<string, unknown> {
  if (typeof msg.content === 'string') {
    return { role: msg.role, content: msg.content }
  }

  const content: Record<string, unknown>[] = []
  for (const block of msg.content) {
    if (block.type === 'text' && block.text) {
      content.push({ type: 'text', text: block.text })
    } else if (block.type === 'tool_use') {
      content.push({
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: block.input ?? {},
      })
    } else if (block.type === 'tool_result') {
      content.push({
        type: 'tool_result',
        tool_use_id: block.tool_use_id,
        content: block.content,
        is_error: block.is_error,
      })
    }
  }

  return { role: msg.role, content }
}

// ─── User Prompt Builder ────────────────────────────────────────────────────

function buildUserPrompt(
  prompt: string,
  title: string,
  files: AgentCodeFile[],
  mode: 'create' | 'refine',
  isNew: boolean,
): string {
  if (isNew || mode === 'create') {
    return `Create a website for: ${prompt}\n\nProject title: ${title}\n\nThis is a new project. Start by thinking about the design, then create files one at a time. Begin with the theme.css, then App.tsx, then components. Compile after every few files to catch errors early.`
  }

  const fileList = files
    .filter((f) => f.path !== 'No files yet')
    .map((f) => `- ${f.path} (${f.language}, ${f.code.split('\n').length} lines)`)
    .join('\n')

  return `Update the existing project based on this request: ${prompt}\n\nProject title: ${title}\n\nCurrent files:\n${fileList || '(none)'}\n\nRead files before editing them. Make minimal, focused changes. Compile after edits to verify.`
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/^\/+/, '')
}

function normalizeFiles(files: AgentCodeFile[]): AgentCodeFile[] {
  const byPath = new Map<string, AgentCodeFile>()

  for (const file of files) {
    const path = normalizePath(file.path)
    if (!path) continue

    const language = normalizeLanguage(file.language, path)
    byPath.set(path, {
      path,
      language,
      code: file.code.replace(/\r\n/g, '\n'),
    })
  }

  return [...byPath.values()].sort((a, b) => {
    if (a.path === 'src/App.tsx') return -1
    if (b.path === 'src/App.tsx') return 1
    if (a.path === 'src/styles/theme.css') return 1
    if (b.path === 'src/styles/theme.css') return -1
    return a.path.localeCompare(b.path)
  })
}

function normalizeLanguage(language: string, path: string): string {
  const lower = language.toLowerCase().trim()
  if (['tsx', 'ts', 'jsx', 'js', 'css', 'json'].includes(lower)) return lower
  if (path.endsWith('.tsx')) return 'tsx'
  if (path.endsWith('.ts')) return 'ts'
  if (path.endsWith('.jsx')) return 'jsx'
  if (path.endsWith('.js')) return 'js'
  if (path.endsWith('.css')) return 'css'
  if (path.endsWith('.json')) return 'json'
  return 'tsx'
}

function upsertFile(files: AgentCodeFile[], file: AgentCodeFile): AgentCodeFile[] {
  const normalized = normalizeFiles([file])[0]
  if (!normalized) return files

  const existing = files.findIndex((f) => f.path === normalized.path)
  if (existing >= 0) {
    const updated = [...files]
    updated[existing] = normalized
    return updated
  }
  return [...files, normalized]
}

// ─── Provider Resolution ────────────────────────────────────────────────────

function parseModels(raw: string | null | undefined): ModelInfo[] {
  return (raw ?? '')
    .split(',')
    .map((item) => {
      const [name, id] = item.split('|').map((part) => part.trim())
      return { name: name || id || '', id: id || name || '' }
    })
    .filter((model) => model.id.length > 0)
}

async function resolveProvider(userId: string, selectedModel: SelectedAgentModel | null): Promise<ResolvedProvider> {
  let key: ProviderKeyRow | null = null

  if (selectedModel) {
    const { data, error } = await supabase
      .from('provider_keys')
      .select('id, provider_id, provider_name, api_key, base_url, models, enabled, is_custom')
      .eq('user_id', userId)
      .eq('provider_id', selectedModel.provider_id)
      .eq('enabled', true)
      .maybeSingle()

    if (error) throw new Error(`Could not load selected provider: ${error.message}`)
    key = data as ProviderKeyRow | null
  } else {
    const { data, error } = await supabase
      .from('provider_keys')
      .select('id, provider_id, provider_name, api_key, base_url, models, enabled, is_custom')
      .eq('user_id', userId)
      .eq('enabled', true)
      .order('created_at', { ascending: true })
      .limit(1)

    if (error) throw new Error(`Could not load provider: ${error.message}`)
    key = (data?.[0] ?? null) as ProviderKeyRow | null
  }

  if (!key) {
    throw new Error(selectedModel ? 'The selected provider is not enabled.' : 'No enabled provider found.')
  }

  const { data: defaultRow } = await supabase
    .from('default_models')
    .select('provider_id, models')
    .eq('provider_id', key.provider_id)
    .maybeSingle()

  const defaultModels = parseModels(getRecordString(defaultRow, 'models'))
  const customModels = parseModels(key.models)
  const merged = mergeModels(defaultModels, customModels)
  const selected = selectedModel && selectedModel.provider_id === key.provider_id
    ? { name: selectedModel.model_name, id: selectedModel.model_id }
    : merged[0]

  if (!selected?.id) {
    throw new Error(`No model configured for ${key.provider_name || key.provider_id}.`)
  }

  const rawBaseUrl = (key.base_url?.trim() || DEFAULT_BASE_URLS[key.provider_id] || '').replace(/\/+$/, '')
  if (!rawBaseUrl) {
    throw new Error(`No base URL configured for ${key.provider_name || key.provider_id}.`)
  }
  const baseUrl = validateProviderUrl(rawBaseUrl)

  return { key, baseUrl, model: selected }
}

function mergeModels(defaults: ModelInfo[], custom: ModelInfo[]): ModelInfo[] {
  const seen = new Set<string>()
  const merged: ModelInfo[] = []

  for (const model of [...defaults, ...custom]) {
    if (seen.has(model.id)) continue
    seen.add(model.id)
    merged.push(model)
  }

  return merged
}

function getRecordString(value: unknown, key: string): string {
  const record = value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
  const result = record[key]
  return typeof result === 'string' ? result : ''
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('The agent run was cancelled.', 'AbortError')
  }
}
