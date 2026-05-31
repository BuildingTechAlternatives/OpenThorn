import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, enhanceUserPrompt, type AgentMode } from '../system-prompt'
import type { WorkspaceFile } from '../workspace'

const sampleFiles: WorkspaceFile[] = [
  { path: 'index.html', content: '<html><title>Test</title></html>', lastModified: 1 },
  { path: 'package.json', content: '{}', lastModified: 1 },
  { path: 'src/App.tsx', content: 'export default function App() {}', lastModified: 1 },
  { path: 'src/main.tsx', content: 'createRoot()', lastModified: 1 },
]

describe('buildSystemPrompt', () => {
  it('returns a string for build mode', () => {
    const prompt = buildSystemPrompt(sampleFiles, 'build')
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(500)
  })

  it('returns a string for plan mode', () => {
    const prompt = buildSystemPrompt(sampleFiles, 'plan')
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(500)
  })

  it('includes the workspace file listing', () => {
    const prompt = buildSystemPrompt(sampleFiles, 'build')
    expect(prompt).toContain('index.html')
    expect(prompt).toContain('package.json')
    expect(prompt).toContain('src/App.tsx')
    expect(prompt).toContain('src/main.tsx')
  })

  it('includes environment description', () => {
    const prompt = buildSystemPrompt(sampleFiles, 'build')
    expect(prompt).toContain('Node.js')
    expect(prompt).toContain('npm')
  })

  it('includes structured workflow', () => {
    const prompt = buildSystemPrompt(sampleFiles, 'build')
    expect(prompt).toContain('ANALYZE')
    expect(prompt).toContain('IMPLEMENT')
    expect(prompt).toContain('VERIFY')
    expect(prompt).toContain('WORKFLOW')
  })

  it('includes tool selection guide', () => {
    const prompt = buildSystemPrompt(sampleFiles, 'build')
    expect(prompt).toContain('list_files')
    expect(prompt).toContain('search_files')
    expect(prompt).toContain('write_file')
    expect(prompt).toContain('web_search')
    expect(prompt).toContain('web_fetch')
    expect(prompt).toContain('run_command')
    expect(prompt).toContain('execute_build')
  })

  it('build mode mentions all tools available', () => {
    const prompt = buildSystemPrompt(sampleFiles, 'build')
    expect(prompt).toContain('MODE: BUILD')
  })

  it('plan mode specifies read-only tools', () => {
    const prompt = buildSystemPrompt(sampleFiles, 'plan')
    expect(prompt).toContain('MODE: PLAN')
    expect(prompt).toContain('CANNOT write')
  })

  it('includes anti-patterns', () => {
    const prompt = buildSystemPrompt(sampleFiles, 'build')
    expect(prompt).toContain('NEVER output code in chat')
    expect(prompt).toContain('NEVER skip execute_build verification')
    expect(prompt).toContain('ANTI-PATTERNS')
  })

  it('includes styling philosophy', () => {
    const prompt = buildSystemPrompt(sampleFiles, 'build')
    expect(prompt).toContain('STYLING PHILOSOPHY')
  })

  it('includes all workspace files in the listing', () => {
    const prompt = buildSystemPrompt(sampleFiles, 'build')
    expect(prompt).toContain('index.html')
    expect(prompt).toContain('package.json')
    expect(prompt).toContain('src/App.tsx')
    expect(prompt).toContain('src/main.tsx')
  })

  it('defaults to build mode when mode is invalid', () => {
    const prompt = buildSystemPrompt(sampleFiles, 'invalid' as AgentMode)
    expect(prompt).toContain('MODE: BUILD')
  })
})

describe('enhanceUserPrompt', () => {
  it('returns a string with project context', () => {
    const result = enhanceUserPrompt('build a todo app', sampleFiles)
    expect(result).toContain('PROJECT CONTEXT')
    expect(result).toContain('build a todo app')
  })

  it('includes file count', () => {
    const result = enhanceUserPrompt('test', sampleFiles)
    expect(result).toContain('Files in workspace: 4')
  })

  it('includes tech stack info', () => {
    const result = enhanceUserPrompt('test', sampleFiles)
    expect(result).toContain('React 19')
    expect(result).toContain('TypeScript')
    expect(result).toContain('Vite')
  })

  it('shows empty project message when no files', () => {
    const result = enhanceUserPrompt('test', [])
    expect(result).toContain('Files in workspace: 0')
  })

  it('truncates file listing at 20 files', () => {
    const manyFiles: WorkspaceFile[] = Array.from({ length: 25 }, (_, i) => ({
      path: `src/file${i}.ts`,
      content: '',
      lastModified: 1,
    }))
    const result = enhanceUserPrompt('test', manyFiles)
    expect(result).toContain('and 5 more files')
  })
})

describe('buildSystemPrompt with capability', () => {
  it('includes WebContainer env when capability is webcontainer', () => {
    const prompt = buildSystemPrompt(sampleFiles, 'build', 'webcontainer')
    expect(prompt).toContain('WebContainer')
    expect(prompt).toContain('npm')
  })

  it('includes fallback instructions when capability is transpiler', () => {
    const prompt = buildSystemPrompt(sampleFiles, 'build', 'transpiler')
    expect(prompt).toContain('FALLBACK MODE')
    expect(prompt).toContain('browser-transpiler')
    expect(prompt).toContain('esm.sh')
  })

  it('warns against native Node.js packages in transpiler mode', () => {
    const prompt = buildSystemPrompt(sampleFiles, 'build', 'transpiler')
    expect(prompt).toContain('fs')
    expect(prompt).toContain('native Node.js')
  })

  it('uses browser transpiler runtime description in fallback', () => {
    const prompt = buildSystemPrompt(sampleFiles, 'build', 'transpiler')
    expect(prompt).toContain('Browser transpiler')
  })

  it('defaults to auto-detection when no capability passed', () => {
    const prompt = buildSystemPrompt(sampleFiles, 'build')
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(500)
  })
})

describe('enhanceUserPrompt with capability', () => {
  it('includes WebContainer in context by default', () => {
    const result = enhanceUserPrompt('test', sampleFiles)
    expect(result).toContain('WebContainer')
  })

  it('replaces WebContainer context with transpiler context in fallback', () => {
    const result = enhanceUserPrompt('test', sampleFiles, 'transpiler')
    expect(result).toContain('Browser transpiler')
    expect(result).not.toContain('full Node.js in-browser')
  })
})
