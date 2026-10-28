import { describe, expect, it, vi } from 'vitest'
import { createToolStreamProgressEmitter, type AgentProgressEvent } from '../agent'

describe('createToolStreamProgressEmitter', () => {
  it('emits a generating event when a tool name first appears', () => {
    const onProgress = vi.fn<(e: AgentProgressEvent) => void>()
    const emit = createToolStreamProgressEmitter(onProgress)

    emit('write_file', '')

    expect(onProgress).toHaveBeenCalledTimes(1)
    expect(onProgress).toHaveBeenCalledWith({ type: 'generating', toolName: 'write_file' })
  })

  it('emits the path once it can be sniffed from partial JSON fragments', () => {
    const onProgress = vi.fn<(e: AgentProgressEvent) => void>()
    const emit = createToolStreamProgressEmitter(onProgress)

    emit('write_file', '')
    emit('write_file', '{"pa')
    emit('write_file', 'th": "src/components/Ga')
    emit('write_file', 'me.tsx", "content": "...')

    const events = onProgress.mock.calls.map(([e]) => e)
    expect(events).toEqual([
      { type: 'generating', toolName: 'write_file' },
      { type: 'generating', toolName: 'write_file', toolInput: { path: 'src/components/Game.tsx' } },
    ])
  })

  it('does not re-emit while more argument fragments stream after the path', () => {
    const onProgress = vi.fn<(e: AgentProgressEvent) => void>()
    const emit = createToolStreamProgressEmitter(onProgress)

    emit('write_file', '{"path": "src/App.tsx", "content": "')
    onProgress.mockClear()
    emit('write_file', 'const a = 1\\n')
    emit('write_file', 'const b = 2\\n')

    expect(onProgress).not.toHaveBeenCalled()
  })

  it('resets when the streamed tool changes', () => {
    const onProgress = vi.fn<(e: AgentProgressEvent) => void>()
    const emit = createToolStreamProgressEmitter(onProgress)

    emit('read_file', '{"path": "src/App.tsx"}')
    emit('write_file', '{"path": "src/main.tsx"}')

    const events = onProgress.mock.calls.map(([e]) => e)
    expect(events).toEqual([
      { type: 'generating', toolName: 'read_file' },
      { type: 'generating', toolName: 'read_file', toolInput: { path: 'src/App.tsx' } },
      { type: 'generating', toolName: 'write_file' },
      { type: 'generating', toolName: 'write_file', toolInput: { path: 'src/main.tsx' } },
    ])
  })

  it('handles tools without a path argument by emitting only the name', () => {
    const onProgress = vi.fn<(e: AgentProgressEvent) => void>()
    const emit = createToolStreamProgressEmitter(onProgress)

    emit('compile', '{}')

    expect(onProgress).toHaveBeenCalledTimes(1)
    expect(onProgress).toHaveBeenCalledWith({ type: 'generating', toolName: 'compile' })
  })
})
