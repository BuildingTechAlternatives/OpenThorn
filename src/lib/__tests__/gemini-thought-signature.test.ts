import { describe, it, expect } from 'vitest'
import {
  parseGeminiToolStream,
  convertToGeminiContents,
  GEMINI_SKIP_SIGNATURE,
} from '../agent'

function sseResponse(chunks: unknown[]): Response {
  const body = chunks.map((c) => `data: ${JSON.stringify(c)}`).join('\n\n') + '\n\n'
  return new Response(body)
}

function chunk(parts: unknown[]) {
  return { candidates: [{ content: { parts } }] }
}

const noop = () => {}

describe('parseGeminiToolStream — thoughtSignature extraction', () => {
  it('reads thoughtSignature from the part level (sibling of functionCall), per the REST API schema', async () => {
    const res = sseResponse([
      chunk([
        { functionCall: { name: 'set_title', args: { title: 'Hi' } }, thoughtSignature: 'sig-abc' },
      ]),
    ])
    const { toolCalls } = await parseGeminiToolStream(res, noop)
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].thoughtSignature).toBe('sig-abc')
  })

  it('keeps the signature from the first cumulative chunk when later snapshots omit it', async () => {
    const res = sseResponse([
      chunk([{ functionCall: { name: 'write_file', args: { path: 'a' } }, thoughtSignature: 'sig-1' }]),
      chunk([{ functionCall: { name: 'write_file', args: { path: 'a', content: 'full' } } }]),
    ])
    const { toolCalls } = await parseGeminiToolStream(res, noop)
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].input).toEqual({ path: 'a', content: 'full' })
    expect(toolCalls[0].thoughtSignature).toBe('sig-1')
  })

  it('propagates the first signature to all parallel calls', async () => {
    const res = sseResponse([
      chunk([
        { functionCall: { name: 'write_file', args: { path: 'a' } }, thoughtSignature: 'sig-1' },
        { functionCall: { name: 'set_title', args: { title: 'T' } } },
      ]),
    ])
    const { toolCalls } = await parseGeminiToolStream(res, noop)
    expect(toolCalls).toHaveLength(2)
    expect(toolCalls[0].thoughtSignature).toBe('sig-1')
    expect(toolCalls[1].thoughtSignature).toBe('sig-1')
  })
})

describe('convertToGeminiContents — thoughtSignature serialization', () => {
  it('emits thoughtSignature as a part-level sibling of functionCall', () => {
    const contents = convertToGeminiContents([
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'c1', name: 'set_title', input: { title: 'Hi' }, thoughtSignature: 'sig-abc' }],
      },
    ])
    expect(contents[0].parts[0]).toEqual({
      functionCall: { name: 'set_title', args: { title: 'Hi' } },
      thoughtSignature: 'sig-abc',
    })
  })

  it('falls back to the documented validator-bypass signature when a tool_use block has none', () => {
    const contents = convertToGeminiContents([
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'c1', name: 'set_title', input: { title: 'Hi' } }],
      },
    ])
    expect(contents[0].parts[0]).toEqual({
      functionCall: { name: 'set_title', args: { title: 'Hi' } },
      thoughtSignature: GEMINI_SKIP_SIGNATURE,
    })
  })

  it('does not attach signatures to text or tool_result parts', () => {
    const contents = convertToGeminiContents([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'working on it' },
          { type: 'tool_use', id: 'c1', name: 'set_title', input: {}, thoughtSignature: 'sig' },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'c1', content: 'ok', is_error: false }],
      },
    ])
    expect(contents[0].parts[0]).toEqual({ text: 'working on it' })
    expect(contents[1].parts[0]).toEqual({
      functionResponse: { name: 'set_title', response: { content: 'ok', is_error: false } },
    })
  })
})
