/**
 * Agent Loop — master orchestrator for the Plan → Act → Reflect cycle.
 * Equivalent to Claude Code's nO master loop.
 *
 * Flow:
 *   User prompt → build system prompt → API call with tools →
 *   parse response → execute tools → feed results back →
 *   repeat until done or limit reached.
 */

import type { Message } from '../components/chat/ChatPanel'
import type { ProviderConfig } from './providers'
import { getAdapter } from './adapters'
import { buildSystemPrompt } from './system-prompt'
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

const MAX_ITERATIONS = 15 // Absolute safety limit
const MAX_FIX_CYCLES = 3 // Max consecutive build-fix cycles

/* ── The Loop ─────────────────────────────────────── */

export async function* runAgentLoop(
  userMessage: string,
  provider: ProviderConfig,
  model: string,
  existingMessages: Message[] = []
): AsyncGenerator<AgentStreamEvent> {
  const adapter = getAdapter(provider.provider_key)
  const systemPrompt = buildSystemPrompt(getWorkspace().files)

  // Build initial message list
  const messages: {
    role: string
    content: string | null
    tool_calls?: unknown[]
    tool_call_id?: string
    name?: string
  }[] = [
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

    // ── Call the AI provider ──────────────────────
    const baseUrl = provider.base_url ?? 'https://api.openai.com/v1'
    const url = adapter.buildUrl(baseUrl, model)
    const headers = adapter.buildHeaders(provider.api_key)

    // Build provider-specific payload
    const payload = buildProviderPayload(
      adapter.name,
      messages,
      model,
      lastBuildFailed ? 0.1 : 0.7
    )

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(120000),
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

    const data = (await res.json()) as Record<string, unknown>

    // ── Parse response ────────────────────────────
    const parsed = parseResponse(data, adapter.name)

    // Yield text content as thinking/text
    if (parsed.content) {
      yield { type: 'text', content: parsed.content }
    }

    // If no tool calls, agent considers itself done
    if (!parsed.toolCalls || parsed.toolCalls.length === 0) {
      // Auto-verify: trigger a build to confirm everything works
      if (!lastBuildFailed) {
        const verifyCall: ToolCall = {
          id: `verify_${Date.now()}`,
          name: 'execute_build',
          arguments: {},
        }
        yield { type: 'tool_call', toolCall: verifyCall }
        const verifyResult = await executeTool(verifyCall)
        yield { type: 'tool_result', toolResult: verifyResult }

        // Add verification to message history
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
          // Build failed — continue the loop so AI can fix
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
    // Reset fix cycle tracking when AI makes progress
    lastBuildFailed = false

    // Build the assistant message with tool calls
    const assistantMsg: {
      role: string
      content: string | null
      tool_calls: unknown[]
    } = {
      role: 'assistant',
      content: parsed.content || null,
      tool_calls: parsed.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      })),
    }
    messages.push(assistantMsg)

    for (const tc of parsed.toolCalls) {
      yield { type: 'tool_call', toolCall: tc }
      const result = await executeTool(tc)
      yield { type: 'tool_result', toolResult: result }

      // Track build state
      if (tc.name === 'execute_build') {
        lastBuildFailed = !result.display.includes('passed')
        if (lastBuildFailed) {
          fixCycles++
        } else {
          fixCycles = 0
        }
      }

      // Add tool result to message history
      messages.push({
        role: 'tool',
        content: result.result,
        tool_call_id: tc.id,
      })
    }

    // Safety: check fix cycle limit
    if (fixCycles > MAX_FIX_CYCLES) {
      yield {
        type: 'error',
        content: `Build still failing after ${MAX_FIX_CYCLES} fix cycles. Review the errors above and try again with more specific instructions.`,
      }
      return
    }

    // Check if the last tool call was execute_build and it passed
    const lastCall = parsed.toolCalls[parsed.toolCalls.length - 1]
    if (
      lastCall?.name === 'execute_build' &&
      !lastBuildFailed
    ) {
      // Build passed at the end of a tool call sequence — consider done
      // But let the AI have one more turn to confirm/summarize
      continue
    }
  }

  yield {
    type: 'error',
    content: `Reached maximum of ${MAX_ITERATIONS} tool iterations. The task may be too complex — try breaking it into smaller steps.`,
  }
}

/* ── Provider Payload Building ────────────────────── */

function buildProviderPayload(
  adapterName: string,
  messages: {
    role: string
    content: string | null
    tool_calls?: unknown[]
    tool_call_id?: string
    name?: string
  }[],
  model: string,
  temperature: number
): Record<string, unknown> {
  // Build clean messages — omit null content for assistant messages with tool_calls
  const cleanMessages = messages.map((m) => {
    const msg: Record<string, unknown> = { role: m.role }
    if (m.content !== null && m.content !== undefined) msg.content = m.content
    if (m.tool_calls) msg.tool_calls = m.tool_calls
    if (m.tool_call_id) msg.tool_call_id = m.tool_call_id
    if (m.name) msg.name = m.name
    return msg
  })

  if (adapterName === 'anthropic') {
    // Anthropic uses a different format
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
      tools: TOOL_DEFINITIONS.map((t) => ({
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
        return {
          role,
          parts: [{ text: m.content || '' }],
        }
      })
    return {
      contents,
      systemInstruction: systemMsg
        ? { parts: [{ text: systemMsg.content }] }
        : undefined,
      tools: TOOL_DEFINITIONS.map((t) => ({
        functionDeclarations: [
          {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters,
          },
        ],
      })),
      generationConfig: {
        maxOutputTokens: 8192,
        temperature,
      },
    }
  }

  // Default: OpenAI-compatible
  return {
    model,
    messages: cleanMessages,
    max_tokens: 8192,
    temperature,
    tools: TOOL_DEFINITIONS,
    tool_choice: 'auto',
  }
}

/* ── Response Parsing ─────────────────────────────── */

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
      | Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown>; id?: string }>
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

    return {
      content: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : null,
    }
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
      if (part.text) {
        textContent = (textContent ?? '') + part.text
      }
      if (part.functionCall) {
        toolCalls.push({
          id: `tc_${Date.now()}_${toolCalls.length}`,
          name: part.functionCall.name,
          arguments: part.functionCall.args,
        })
      }
    }

    return {
      content: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : null,
    }
  }

  // Default: OpenAI-compatible
  const choice = (data.choices as Array<Record<string, unknown>> | undefined)?.[0]
  if (!choice) return { content: null, toolCalls: null }

  const msg = choice.message as
    | { content?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }
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
