/**
 * Agent Loop — master orchestrator for the Plan → Act → Reflect cycle.
 * Equivalent to Claude Code's nO master loop.
 *
 * Flow:
 *   User prompt → build system prompt → streaming API call with tools →
 *   stream text tokens → accumulate tool calls → execute tools →
 *   feed results back → repeat until done or limit reached.
 */

import type { Message } from '../components/chat/ChatPanel'
import type { ProviderConfig } from './providers'
import { getAdapter } from './adapters'
import { buildSystemPrompt, type AgentMode } from './system-prompt'
import {
  TOOL_DEFINITIONS,
  executeTool,
  type ToolCall,
  type ToolResult,
} from './agent-tools'
import { getWorkspace } from './workspace'

/* ── Event Types ──────────────────────────────────── */

export interface AgentStreamEvent {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'text' | 'error' | 'done'
  content?: string
  toolCall?: ToolCall
  toolResult?: ToolResult
}

/* ── Configuration ────────────────────────────────── */

const MAX_ITERATIONS = 15
const MAX_FIX_CYCLES = 3

/* ── Message Types ────────────────────────────────── */

interface LoopMessage {
  role: string
  content: string | null
  tool_calls?: unknown[]
  tool_call_id?: string
  name?: string
}

/* ── The Loop ─────────────────────────────────────── */

export async function* runAgentLoop(
  userMessage: string,
  provider: ProviderConfig,
  model: string,
  mode: AgentMode = 'build',
  existingMessages: Message[] = []
): AsyncGenerator<AgentStreamEvent> {
  const adapter = getAdapter(provider.provider_key)
  const systemPrompt = buildSystemPrompt(getWorkspace().files, mode)

  // Filter tools based on mode — plan mode gets read-only tools
  const availableTools =
    mode === 'plan'
      ? TOOL_DEFINITIONS.filter((t) =>
          ['list_files', 'read_file', 'get_errors'].includes(
            t.function.name
          )
        )
      : TOOL_DEFINITIONS

  const messages: LoopMessage[] = [
    { role: 'system', content: systemPrompt },
    ...existingMessages.slice(-6).map((m) => ({
      role: m.role as string,
      content: m.text,
    })),
    { role: 'user', content: userMessage },
  ]

  let iterations = 0
  let fixCycles = 0
  let lastBuildFailed = false

  while (iterations < MAX_ITERATIONS) {
    iterations++

    // ── Streaming API call ────────────────────────
    const baseUrl = provider.base_url ?? 'https://api.openai.com/v1'
    const url = adapter.buildUrl(baseUrl, model)
    const headers = adapter.buildHeaders(provider.api_key)

    const payload = buildStreamingPayload(
      adapter.name,
      messages,
      model,
      lastBuildFailed ? 0.1 : 0.7,
      availableTools
    )

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(300000),
        redirect: 'manual',
      })
    } catch (e) {
      yield { type: 'error', content: `Network error: ${(e as Error).message}` }
      return
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      yield {
        type: 'error',
        content: adapter.parseError(res.status, errBody),
      }
      return
    }

    // ── Read the response ─────────────────────────
    let textContent: string
    let toolCalls: ToolCall[] | null
    try {
      const data = (await res.json()) as Record<string, unknown>
      const parsed = parseResponse(data, adapter.name)
      textContent = parsed.content ?? ''
      toolCalls = parsed.toolCalls
    } catch (e) {
      const msg = (e as Error).message
      yield { type: 'error', content: `Response error: ${msg}` }
      return
    }

    // Yield accumulated text from this turn
    if (textContent) {
      yield { type: 'text', content: textContent }
    }

    // ── No tool calls → agent considers itself done ──
    if (!toolCalls || toolCalls.length === 0) {
      if (!lastBuildFailed) {
        // Auto-verify: trigger build
        const verifyCall: ToolCall = {
          id: `verify_${Date.now()}`,
          name: 'execute_build',
          arguments: {},
        }
        yield { type: 'tool_call', toolCall: verifyCall }
        const verifyResult = await executeTool(verifyCall)
        yield { type: 'tool_result', toolResult: verifyResult }

        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: verifyCall.id,
              type: 'function',
              function: {
                name: 'execute_build',
                arguments: JSON.stringify({}),
              },
            },
          ],
        })
        messages.push({
          role: 'tool',
          content: verifyResult.result,
          tool_call_id: verifyCall.id,
        })

        if (!verifyResult.display.includes('passed')) {
          lastBuildFailed = true
          fixCycles++
          if (fixCycles > MAX_FIX_CYCLES) {
            yield {
              type: 'error',
              content: `Build still failing after ${MAX_FIX_CYCLES} fix cycles. The errors are shown above — you may need to step in.`,
            }
            return
          }
          continue
        }
      }

      yield { type: 'done' }
      return
    }

    // ── Execute tool calls ─────────────────────────
    lastBuildFailed = false

    const assistantMsg: LoopMessage = {
      role: 'assistant',
      content: textContent || null,
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      })),
    }
    messages.push(assistantMsg)

    for (const tc of toolCalls) {
      yield { type: 'tool_call', toolCall: tc }
      const result = await executeTool(tc)
      yield { type: 'tool_result', toolResult: result }

      if (tc.name === 'execute_build') {
        lastBuildFailed = !result.display.includes('passed')
        if (lastBuildFailed) fixCycles++
        else fixCycles = 0
      }

      messages.push({
        role: 'tool',
        content: result.result,
        tool_call_id: tc.id,
      })
    }

    if (fixCycles > MAX_FIX_CYCLES) {
      yield {
        type: 'error',
        content: `Build still failing after ${MAX_FIX_CYCLES} fix cycles. Try again with more specific instructions.`,
      }
      return
    }
  }

  yield {
    type: 'error',
    content: `Reached maximum of ${MAX_ITERATIONS} tool iterations. Try breaking the task into smaller steps.`,
  }
}

/* ── Non-Streaming Response Parsing ──────────────── */

interface ParsedResponse {
  content: string | null
  toolCalls: ToolCall[] | null
}

function parseResponse(
  data: Record<string, unknown>,
  adapterName: string
): ParsedResponse {
  if (adapterName === 'anthropic') {
    const contentBlocks = data.content as
      | Array<{
          type: string
          text?: string
          name?: string
          input?: Record<string, unknown>
          id?: string
        }>
      | undefined
    if (!contentBlocks) return { content: null, toolCalls: null }

    let textContent: string | null = null
    const toolCalls: ToolCall[] = []

    for (const block of contentBlocks) {
      if (block.type === 'text' && block.text) {
        textContent = (textContent ?? '') + block.text
      }
      if (block.type === 'tool_use' && block.name && block.input) {
        toolCalls.push({
          id: block.id ?? `tc_${Date.now()}`,
          name: block.name,
          arguments: block.input as Record<string, string>,
        })
      }
    }
    return { content: textContent, toolCalls: toolCalls.length > 0 ? toolCalls : null }
  }

  if (adapterName === 'gemini') {
    const candidates = data.candidates as
      | Array<{
          content?: {
            parts?: Array<{
              text?: string
              functionCall?: { name: string; args: Record<string, string> }
            }>
          }
        }>
      | undefined
    if (!candidates?.[0]?.content?.parts) {
      return { content: null, toolCalls: null }
    }

    let textContent: string | null = null
    const toolCalls: ToolCall[] = []

    for (const part of candidates[0].content.parts) {
      if (part.text) textContent = (textContent ?? '') + part.text
      if (part.functionCall) {
        toolCalls.push({
          id: `tc_${Date.now()}_${toolCalls.length}`,
          name: part.functionCall.name,
          arguments: part.functionCall.args,
        })
      }
    }
    return { content: textContent, toolCalls: toolCalls.length > 0 ? toolCalls : null }
  }

  // Default: OpenAI-compatible
  const choice = (
    data.choices as Array<Record<string, unknown>> | undefined
  )?.[0]
  if (!choice) return { content: null, toolCalls: null }

  const msg = choice.message as
    | {
        content?: string
        tool_calls?: Array<{
          id: string
          function: { name: string; arguments: string }
        }>
      }
    | undefined
  if (!msg) return { content: null, toolCalls: null }

  const parsedCalls: ToolCall[] = (msg.tool_calls ?? []).map((tc) => {
    let args: Record<string, string> = {}
    try {
      args = JSON.parse(tc.function.arguments)
    } catch {
      args = {}
    }
    return { id: tc.id, name: tc.function.name, arguments: args }
  })

  return {
    content: msg.content ?? null,
    toolCalls: parsedCalls.length > 0 ? parsedCalls : null,
  }
}

/* ── Provider Payload Building ────────────────────── */

function buildStreamingPayload(
  adapterName: string,
  messages: LoopMessage[],
  model: string,
  temperature: number,
  availableTools: typeof TOOL_DEFINITIONS
): Record<string, unknown> {
  // Build clean messages
  const cleanMessages = messages.map((m) => {
    const msg: Record<string, unknown> = { role: m.role }
    if (m.content !== null && m.content !== undefined) msg.content = m.content
    if (m.tool_calls) msg.tool_calls = m.tool_calls
    if (m.tool_call_id) msg.tool_call_id = m.tool_call_id
    if (m.name) msg.name = m.name
    return msg
  })

  if (adapterName === 'anthropic') {
    const systemMsg = cleanMessages.find((m) => m.role === 'system')
    const other = cleanMessages.filter((m) => m.role !== 'system')
    return {
      model,
      system: systemMsg?.content,
      messages: other.map((m) => ({
        role: m.role,
        content: m.content ? [{ type: 'text', text: m.content }] : m.content,
      })),
      max_tokens: 8192,
      stream: false,
      tools: availableTools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      })),
      tool_choice: { type: 'auto' },
    }
  }

  if (adapterName === 'gemini') {
    const systemMsg = cleanMessages.find((m) => m.role === 'system')
    const contents = cleanMessages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        let role: string
        if (m.role === 'assistant') role = 'model'
        else if (m.role === 'tool') role = 'tool'
        else role = 'user'
        return { role, parts: [{ text: m.content || '' }] }
      })
    return {
      contents,
      systemInstruction: systemMsg
        ? { parts: [{ text: systemMsg.content }] }
        : undefined,
      tools: availableTools.map((t) => ({
        functionDeclarations: [
          {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters,
          },
        ],
      })),
      generationConfig: { maxOutputTokens: 8192, temperature },
    }
  }

  // Default: OpenAI-compatible with streaming
  return {
    model,
    messages: cleanMessages,
    max_tokens: 8192,
    temperature,
    stream: false,
    tools: availableTools,
    tool_choice: 'auto',
  }
}
