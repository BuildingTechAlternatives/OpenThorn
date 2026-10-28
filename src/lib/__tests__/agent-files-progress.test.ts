import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentProgressEvent } from '../agent'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const PROVIDER_KEY_ROW = {
  id: 'key-1',
  provider_id: 'openai',
  provider_name: 'OpenAI',
  api_key: 'plain-test-key',
  base_url: null,
  models: '',
  enabled: true,
  is_custom: false,
}

function tableResult(table: string): { data: unknown; error: null } {
  if (table === 'profiles') return { data: { custom_instructions: null }, error: null }
  if (table === 'provider_keys') return { data: [PROVIDER_KEY_ROW], error: null }
  return { data: null, error: null }
}

function makeQuery(table: string) {
  const result = tableResult(table)
  // Chainable + thenable stub: every builder method returns the query itself,
  // awaiting it (or calling single/maybeSingle) resolves the canned result.
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order', 'update', 'insert', 'upsert', 'limit']) {
    q[m] = () => q
  }
  q.single = () => Promise.resolve(result)
  q.maybeSingle = () => Promise.resolve(result)
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return q
}

vi.mock('../supabase', () => ({
  supabase: { from: (table: string) => makeQuery(table) },
}))

vi.mock('../crypto', () => ({
  decryptApiKey: async (key: string) => key,
  encryptApiKey: async (key: string) => key,
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

function sseResponse(events: string[]): Response {
  const body = events.map((e) => `data: ${e}\n`).join('\n') + '\ndata: [DONE]\n\n'
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

/** Turn 1: the model writes src/App.tsx. */
function writeFileTurn(): Response {
  const args = JSON.stringify({
    path: 'src/App.tsx',
    language: 'tsx',
    code: 'export default function App() { return <div>hi</div> }',
  })
  return sseResponse([
    JSON.stringify({
      choices: [{
        delta: {
          tool_calls: [{ index: 0, id: 'call_1', function: { name: 'write_file', arguments: args } }],
        },
      }],
    }),
    JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }),
  ])
}

/** Turn 2: text only, no tool calls. */
function textOnlyTurn(): Response {
  return sseResponse([
    JSON.stringify({ choices: [{ delta: { content: 'Continuing.' } }] }),
  ])
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('mid-run files progress events', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it('emits a files event when a file-mutating tool succeeds, so the UI can persist partial progress', async () => {
    fetchMock
      .mockResolvedValueOnce(writeFileTurn())
      .mockResolvedValueOnce(textOnlyTurn())

    const { runOpenThornAgent } = await import('../agent')

    const events: AgentProgressEvent[] = []
    const result = await runOpenThornAgent({
      userId: 'user-1',
      prompt: 'Build a landing page',
      title: 'Test project',
      files: [],
      selectedModel: null,
      mode: 'create',
      maxTurns: 2,
      onProgress: (event) => events.push(event),
    })

    // The run mutated files and hit the turn cap.
    expect(result.filesMutated).toBe(true)

    // A 'files' event must fire during the run (not only the final 'done') so
    // the UI persists partial progress and a page reload can resume from it.
    const filesEvents = events.filter((e) => e.type === 'files')
    expect(filesEvents.length).toBeGreaterThan(0)
    expect(filesEvents[0].filesMutated).toBe(true)
    expect(filesEvents[0].files?.some((f) => f.path === 'src/App.tsx')).toBe(true)

    // It must arrive before the run-ending 'done' event.
    const firstFilesIdx = events.findIndex((e) => e.type === 'files')
    const doneIdx = events.findIndex((e) => e.type === 'done')
    expect(firstFilesIdx).toBeGreaterThanOrEqual(0)
    expect(firstFilesIdx).toBeLessThan(doneIdx)

    const writeResult = events.find((e) => e.type === 'tool_result' && e.toolName === 'write_file')
    expect(writeResult?.toolInput).toMatchObject({ path: 'src/App.tsx' })
  })

  it('does not emit files events on a purely conversational run', async () => {
    fetchMock.mockResolvedValueOnce(textOnlyTurn())

    const { runOpenThornAgent } = await import('../agent')

    const events: AgentProgressEvent[] = []
    const result = await runOpenThornAgent({
      userId: 'user-1',
      prompt: 'hey, what is this app?',
      title: 'Test project',
      files: [],
      selectedModel: null,
      mode: 'create',
      maxTurns: 2,
      onProgress: (event) => events.push(event),
    })

    expect(result.filesMutated).toBe(false)
    expect(events.filter((e) => e.type === 'files')).toHaveLength(0)
  })
})
