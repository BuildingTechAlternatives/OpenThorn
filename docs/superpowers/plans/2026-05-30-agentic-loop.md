# Agentic Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Bloom's single-turn chat with an autonomous agentic loop where the AI analyzes, plans, builds files one-by-one, auto-detects errors, and fixes them.

**Architecture:** Tool-use loop (Claude Code nO pattern) — AI receives system prompt + workspace context, chooses tools (list_files, read_file, write_file, edit_file, delete_file, execute_build, get_errors), tools execute and return results, AI decides next step. Loop continues until AI outputs plain text without a tool call.

**Tech Stack:** React 19, TypeScript 6, Vite 8, CSS Modules, @webcontainer/api (for in-browser build)

---

### Task 1: Workspace Module

**Files:**
- Create: `src/lib/workspace.ts`

- [ ] **Step 1: Create workspace module with file store and WebContainer integration**

```typescript
// src/lib/workspace.ts
// Project file store + WebContainer lifecycle + build/error capture

export interface WorkspaceFile {
  path: string        // e.g. "src/components/Header.tsx"
  content: string
  lastModified: number
}

export interface BuildResult {
  success: boolean
  errors: string[]     // parsed error messages
  warnings: string[]
  logs: string[]       // console.log output from vite
}

export interface WorkspaceState {
  files: WorkspaceFile[]
  buildResult: BuildResult | null
  previewUrl: string | null
}

// Pre-initialized Vite + React + TS scaffold
const DEFAULT_FILES: WorkspaceFile[] = [
  {
    path: 'index.html',
    content: `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Bloom Project</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`,
    lastModified: Date.now(),
  },
  {
    path: 'package.json',
    content: JSON.stringify({
      name: 'bloom-project',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      dependencies: { react: '^19.2.0', 'react-dom': '^19.2.0' },
      devDependencies: { '@vitejs/plugin-react': '^6.0.0', typescript: '~6.0.0', vite: '^8.0.0', '@types/react': '^19.0.0', '@types/react-dom': '^19.0.0' },
    }, null, 2),
    lastModified: Date.now(),
  },
  {
    path: 'tsconfig.json',
    content: JSON.stringify({
      compilerOptions: { target: 'ES2022', lib: ['ES2022', 'DOM', 'DOM.Iterable'], module: 'ESNext', skipLibCheck: true, moduleResolution: 'bundler', allowImportingTsExtensions: true, isolatedModules: true, noEmit: true, jsx: 'react-jsx', strict: true, noUnusedLocals: true, noUnusedParameters: true, noFallthroughCasesInSwitch: true },
      include: ['src'],
    }, null, 2),
    lastModified: Date.now(),
  },
  {
    path: 'vite.config.ts',
    content: `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n})\n`,
    lastModified: Date.now(),
  },
  {
    path: 'src/main.tsx',
    content: `import { StrictMode } from 'react'\nimport { createRoot } from 'react-dom/client'\nimport App from './App'\nimport './styles/globals.css'\n\ncreateRoot(document.getElementById('root')!).render(\n  <StrictMode>\n    <App />\n  </StrictMode>,\n)\n`,
    lastModified: Date.now(),
  },
  {
    path: 'src/App.tsx',
    content: `import styles from './App.module.css'\n\nexport default function App() {\n  return (\n    <div className={styles.app}>\n      <h1>Hello Bloom</h1>\n    </div>\n  )\n}\n`,
    lastModified: Date.now(),
  },
  {
    path: 'src/App.module.css',
    content: `.app {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  min-height: 100vh;\n  font-family: system-ui, sans-serif;\n}\n`,
    lastModified: Date.now(),
  },
  {
    path: 'src/styles/globals.css',
    content: `*,\n*::before,\n*::after {\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n}\n\nbody {\n  font-family: system-ui, -apple-system, sans-serif;\n  -webkit-font-smoothing: antialiased;\n}\n`,
    lastModified: Date.now(),
  },
]

let workspace: WorkspaceState = {
  files: [...DEFAULT_FILES],
  buildResult: null,
  previewUrl: null,
}

const listeners = new Set<() => void>()
function notify() { listeners.forEach(l => l()) }

export function getWorkspace(): WorkspaceState { return workspace }

export function subscribeToWorkspace(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function resetWorkspace() {
  workspace = {
    files: DEFAULT_FILES.map(f => ({ ...f, lastModified: Date.now() })),
    buildResult: null,
    previewUrl: null,
  }
  notify()
}

// File CRUD
export function writeFile(path: string, content: string): WorkspaceFile {
  const existing = workspace.files.find(f => f.path === path)
  if (existing) {
    existing.content = content
    existing.lastModified = Date.now()
    notify()
    return existing
  }
  const file: WorkspaceFile = { path, content, lastModified: Date.now() }
  workspace.files.push(file)
  notify()
  return file
}

export function readFile(path: string): string | null {
  return workspace.files.find(f => f.path === path)?.content ?? null
}

export function deleteFile(path: string): boolean {
  const idx = workspace.files.findIndex(f => f.path === path)
  if (idx === -1) return false
  workspace.files.splice(idx, 1)
  notify()
  return true
}

export function editFile(path: string, oldString: string, newString: string): { success: boolean; error?: string } {
  const file = workspace.files.find(f => f.path === path)
  if (!file) return { success: false, error: `File not found: ${path}` }
  if (!file.content.includes(oldString)) return { success: false, error: 'old_string not found in file' }
  file.content = file.content.replace(oldString, newString)
  file.lastModified = Date.now()
  notify()
  return { success: true }
}

export function listFiles(): WorkspaceFile[] {
  return [...workspace.files]
}

// Build
export async function executeBuild(): Promise<BuildResult> {
  // TODO: Integrate @webcontainer/api for real in-browser builds
  // For now: type-check + validate files syntactically
  const errors: string[] = []
  const warnings: string[] = []
  const logs: string[] = []

  for (const file of workspace.files) {
    if (file.path.endsWith('.ts') || file.path.endsWith('.tsx')) {
      try {
        // Basic syntax check via Function constructor
        const code = file.content
          .replace(/import\s+.*?from\s+['"].*?['"]\s*;?/g, '')
          .replace(/export\s+(default\s+)?/g, '')
        new Function(code)
      } catch (e) {
        errors.push(`${file.path}: ${(e as Error).message}`)
      }
    }
  }

  const result: BuildResult = {
    success: errors.length === 0,
    errors,
    warnings,
    logs,
  }
  workspace.buildResult = result
  notify()
  return result
}

export function getErrors(): BuildResult | null {
  return workspace.buildResult
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/workspace.ts
git commit -m "feat: add workspace module with file store and build pipeline"
```

---

### Task 2: System Prompt Module

**Files:**
- Create: `src/lib/system-prompt.ts`

- [ ] **Step 1: Create system prompt builder**

```typescript
// src/lib/system-prompt.ts
import type { WorkspaceFile } from './workspace'

const BASE_PROMPT = `You are Bloom, an autonomous website builder agent. You build complete, working web applications by directly creating and modifying files in the user's project workspace. You have access to tools that let you read, write, edit, and delete files, run builds, and check errors.

## HOW YOU WORK
You operate in a Plan → Act → Reflect loop:

1. ANALYZE: Start every task by listing and reading the workspace files.
   Say "Let me analyze the current workspace..." before any tool calls.
2. PLAN: Think through what files need to be created or changed. Share your plan briefly.
3. ACT: Use your tools to create/modify files ONE AT A TIME.
   - Use write_file for new files or complete rewrites
   - Use edit_file for small targeted changes to existing files
   - NEVER output file contents directly in your chat messages
4. VERIFY: Run the build after finishing all file changes to verify your work.
5. FIX: If the build fails, call get_errors, understand what went wrong,
   fix the files, and rebuild. Do this up to 3 times.
6. REPORT: When the build passes, summarize what you built and which files changed.

## TOOL SELECTION GUIDELINES
- list_files: Use first to understand the project structure
- read_file(path): Use to read specific files before modifying them
- write_file(path, content): Use for NEW files or when replacing an entire file
- edit_file(path, old_string, new_string): Use for small targeted changes to EXISTING files. Prefer this over write_file when changing < 20 lines.
- delete_file(path): Use to remove files
- execute_build(): Call after finishing all file changes to verify your work
- get_errors(): Call when the build fails to see what went wrong

## CODE QUALITY STANDARDS
- Write strict TypeScript. No \`any\` unless absolutely necessary.
- Follow the existing project conventions (imports, naming, structure).
- Every React component gets its own file with a co-located CSS module.
- Implement everything fully — no stubs, no TODOs, no placeholders.
- Use proper React patterns: hooks, event handlers, conditional rendering.
- CSS modules should use the design tokens from globals.css when appropriate.

## PROJECT CONVENTIONS
- Components: \`src/components/ComponentName.tsx\` + \`ComponentName.module.css\`
- Utilities: \`src/utils/utilityName.ts\`
- Types: \`src/types.ts\` or co-located with components
- Styles: CSS Modules with \`var(--token)\` from globals.css

## STOPPING CONDITIONS
- ✅ Build passes with zero errors → summarize what you built, list files changed
- ❌ 3 fix cycles without success → report what's broken and explain why
- 🛑 User interrupts → stop and explain current state

## CRITICAL RULES
- NEVER output file contents in your chat messages. Always use write_file or edit_file.
- ALWAYS start with list_files to understand the workspace before planning.
- Build errors mean YOU fix the files — don't ask the user for help.
- After each file operation, briefly note what you did and why.
- When using edit_file, make sure old_string matches the file content exactly.
`

export function buildSystemPrompt(files: WorkspaceFile[]): string {
  const fileTree = files
    .map(f => `  ${f.path} (${(f.content.length / 1024).toFixed(1)}KB)`)
    .join('\n')

  const context = `\n## WORKSPACE CONTEXT\nCurrent project files:\n${fileTree}\n\nThis is a Vite + React + TypeScript project. The dev server runs on localhost:5173.`

  return BASE_PROMPT + context
}
```

- [ ] **Step 2: Commit**

---

### Task 3: Agent Tools Module

**Files:**
- Create: `src/lib/agent-tools.ts`

- [ ] **Step 1: Create tool definitions and execution layer**

```typescript
// src/lib/agent-tools.ts
// Tool definitions (JSON Schema) and execution layer for the agentic loop

import { listFiles, readFile, writeFile, editFile, deleteFile, executeBuild, getErrors } from './workspace'
import type { BuildResult } from './workspace'

// ── Tool Definitions (OpenAI/Anthropic function-calling format) ──

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List all files in the project workspace. Use this first to understand the project structure before making changes.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the complete contents of a file. Use this before modifying existing files to understand their current state.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'The file path relative to the project root (e.g. "src/App.tsx")' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create a new file or completely overwrite an existing file. Use this for new files or when rewriting an entire file. For small changes to existing files, prefer edit_file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to project root' },
          content: { type: 'string', description: 'The complete file content' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Make a surgical string replacement in an existing file. Use this for small targeted changes. The old_string must match the file content exactly (including whitespace/indentation).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to project root' },
          old_string: { type: 'string', description: 'The exact text to replace (must match file content including indentation)' },
          new_string: { type: 'string', description: 'The replacement text' },
        },
        required: ['path', 'old_string', 'new_string'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_file',
      description: 'Delete a file from the project workspace.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'File path to delete' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_build',
      description: 'Run the build to verify all files compile correctly. Call this after finishing all file changes.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_errors',
      description: 'Get the build errors and runtime console errors from the last build. Use this when execute_build fails to understand what needs fixing.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
]

// ── Tool Execution ──

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, string>
}

export interface ToolResult {
  id: string
  name: string
  result: string   // JSON-stringified result for the model
  display: string  // Human-readable for the chat UI
}

export function executeTool(call: ToolCall): ToolResult {
  const base = { id: call.id, name: call.name }
  
  try {
    switch (call.name) {
      case 'list_files': {
        const files = listFiles()
        const listing = files.map(f => `${f.path} (${(f.content.length / 1024).toFixed(1)}KB, modified ${new Date(f.lastModified).toLocaleTimeString()})`).join('\n')
        return { ...base, result: `Files in workspace:\n${listing}`, display: '📂 Listed workspace files' }
      }
      
      case 'read_file': {
        const content = readFile(call.arguments.path)
        if (content === null) return { ...base, result: `Error: File not found: ${call.arguments.path}`, display: `❌ File not found: ${call.arguments.path}` }
        return { ...base, result: content, display: `📖 Read ${call.arguments.path}` }
      }
      
      case 'write_file': {
        const isNew = !readFile(call.arguments.path)
        writeFile(call.arguments.path, call.arguments.content)
        const icon = isNew ? '📄' : '✏️'
        const action = isNew ? 'Created' : 'Modified'
        return { ...base, result: `File written successfully: ${call.arguments.path}`, display: `${icon} ${action} ${call.arguments.path}` }
      }
      
      case 'edit_file': {
        const result = editFile(call.arguments.path, call.arguments.old_string, call.arguments.new_string)
        if (!result.success) return { ...base, result: `Edit failed: ${result.error}`, display: `❌ Edit failed on ${call.arguments.path}: ${result.error}` }
        return { ...base, result: `Edit applied successfully to ${call.arguments.path}`, display: `✏️ Edited ${call.arguments.path}` }
      }
      
      case 'delete_file': {
        const ok = deleteFile(call.arguments.path)
        if (!ok) return { ...base, result: `Error: File not found: ${call.arguments.path}`, display: `❌ Delete failed: ${call.arguments.path} not found` }
        return { ...base, result: `File deleted: ${call.arguments.path}`, display: `🗑️ Deleted ${call.arguments.path}` }
      }
      
      case 'execute_build': {
        const buildResult = await executeBuild()
        const summary = buildResult.success
          ? 'Build passed with no errors.'
          : `Build failed with ${buildResult.errors.length} error(s):\n${buildResult.errors.join('\n')}`
        const display = buildResult.success ? '✅ Build passed' : `🔨 Build failed — ${buildResult.errors.length} error(s)`
        return { ...base, result: summary, display }
      }
      
      case 'get_errors': {
        const errs = getErrors()
        if (!errs) return { ...base, result: 'No build has been run yet.', display: '⚠️ No build data available' }
        const text = errs.errors.length > 0
          ? `Build errors:\n${errs.errors.join('\n')}\n\nWarnings:\n${errs.warnings.join('\n')}`
          : 'No errors from the last build.'
        return { ...base, result: text, display: `🔍 Found ${errs.errors.length} error(s), ${errs.warnings.length} warning(s)` }
      }
      
      default:
        return { ...base, result: `Unknown tool: ${call.name}`, display: `❌ Unknown tool: ${call.name}` }
    }
  } catch (e) {
    return { ...base, result: `Tool execution error: ${(e as Error).message}`, display: `❌ Error: ${(e as Error).message}` }
  }
}

// ── Parse tool calls from model response ──

export function parseToolCalls(content: string, provider: string): ToolCall[] {
  // Most providers return tool_calls in the API response delta, not in content.
  // This handles the case where tool calls appear in the text content.
  // Primary path: tool_calls array in the API response (handled in agent-loop.ts)
  return []
}
```

- [ ] **Step 2: Commit**

---

### Task 4: Agent Loop Module

**Files:**
- Create: `src/lib/agent-loop.ts`

- [ ] **Step 1: Create the master agent loop**

```typescript
// src/lib/agent-loop.ts
// Master agent loop — orchestrates the Plan → Act → Reflect cycle
// Equivalent to Claude Code's nO loop

import type { Message } from '../components/chat/ChatPanel'
import type { ProviderConfig } from './providers'
import { getAdapter } from './adapters'
import { buildSystemPrompt } from './system-prompt'
import { TOOL_DEFINITIONS, executeTool, type ToolCall, type ToolResult } from './agent-tools'
import { getWorkspace } from './workspace'

export interface AgentStreamEvent {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'text' | 'error' | 'done'
  content?: string
  toolCall?: ToolCall
  toolResult?: ToolResult
}

const MAX_ITERATIONS = 15   // Safety limit — prevent infinite loops
const MAX_FIX_CYCLES = 3

export async function* runAgentLoop(
  userMessage: string,
  provider: ProviderConfig,
  model: string,
  existingMessages: Message[] = []
): AsyncGenerator<AgentStreamEvent> {
  const adapter = getAdapter(provider.provider_key)
  const systemPrompt = buildSystemPrompt(getWorkspace().files)
  
  // Build the message list
  const messages: { role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string; name?: string }[] = [
    { role: 'system', content: systemPrompt },
    ...existingMessages.slice(-6).map(m => ({ role: m.role as string, content: m.text })),
    { role: 'user', content: userMessage },
  ]

  let iterations = 0
  let fixCycles = 0
  let lastBuildFailed = false

  while (iterations < MAX_ITERATIONS) {
    iterations++
    
    // Build the API request
    const baseUrl = provider.base_url ?? 'https://api.openai.com/v1'
    const url = adapter.buildUrl(baseUrl, model)
    const headers = adapter.buildHeaders(provider.api_key)
    
    // Convert messages to provider format
    const apiMessages = messages.map(m => {
      const msg: Record<string, unknown> = { role: m.role }
      if (m.content) msg.content = m.content
      if (m.tool_calls) msg.tool_calls = m.tool_calls
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id
      if (m.name) msg.name = m.name
      return msg
    })

    const body = {
      model,
      messages: apiMessages,
      max_tokens: 8192,
      temperature: lastBuildFailed ? 0.1 : 0.7,
      tools: TOOL_DEFINITIONS,
      tool_choice: 'auto',
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
      redirect: 'manual',
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      yield { type: 'error', content: adapter.parseError(res.status, errBody) }
      return
    }

    const data = await res.json()
    
    // Extract from OpenAI-compatible response
    const choice = data.choices?.[0]
    if (!choice) {
      yield { type: 'error', content: 'No response from model' }
      return
    }

    const assistantMsg = choice.message
    const textContent = assistantMsg.content || ''
    const toolCalls = assistantMsg.tool_calls

    // If there's text content, yield it
    if (textContent) {
      yield { type: 'text', content: textContent }
    }

    // If no tool calls, the agent is done
    if (!toolCalls || toolCalls.length === 0) {
      // Check if we need to auto-build
      if (!lastBuildFailed) {
        // Agent thinks it's done — trigger a verification build
        const buildTool: ToolCall = {
          id: `auto_${Date.now()}`,
          name: 'execute_build',
          arguments: {},
        }
        yield { type: 'tool_call', toolCall: buildTool }
        const buildResult = executeTool(buildTool)
        yield { type: 'tool_result', toolResult: buildResult }
        
        if (buildResult.display.includes('failed')) {
          // Build failed — feed the error back and continue the loop
          messages.push({ role: 'assistant', content: null, tool_calls: [{ id: buildTool.id, type: 'function', function: { name: 'execute_build', arguments: '{}' } }] })
          messages.push({ role: 'tool', content: buildResult.result, tool_call_id: buildTool.id })
          lastBuildFailed = true
          fixCycles++
          if (fixCycles > MAX_FIX_CYCLES) {
            yield { type: 'error', content: `Build still failing after ${MAX_FIX_CYCLES} fix cycles. Please review the errors above.` }
            return
          }
          continue
        }
      }
      
      yield { type: 'done' }
      return
    }

    // Process each tool call
    for (const tc of toolCalls) {
      const toolCall: ToolCall = {
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }
      
      yield { type: 'tool_call', toolCall }
      
      const result = executeTool(toolCall)
      yield { type: 'tool_result', toolResult: result }

      // Track build state
      if (toolCall.name === 'execute_build') {
        lastBuildFailed = result.display.includes('failed')
        if (lastBuildFailed) fixCycles++
        else fixCycles = 0
      }

      // Add assistant tool call + tool result to messages
      messages.push({
        role: 'assistant',
        content: textContent || null,
        tool_calls: [{ id: tc.id, type: 'function', function: { name: tc.function.name, arguments: tc.function.arguments } }],
      })
      messages.push({
        role: 'tool',
        content: result.result,
        tool_call_id: tc.id,
      })
    }

    // Safety: check if we hit the max fix cycles
    if (fixCycles > MAX_FIX_CYCLES) {
      yield { type: 'error', content: `Build still failing after ${MAX_FIX_CYCLES} fix cycles. Please review the errors above.` }
      return
    }
  }

  yield { type: 'error', content: `Reached maximum of ${MAX_ITERATIONS} tool iterations.` }
}
```

- [ ] **Step 2: Commit**

---

### Task 5: File Change Card Component

**Files:**
- Create: `src/components/chat/FileChangeCard.tsx`
- Create: `src/components/chat/FileChangeCard.module.css`

- [ ] **Step 1: Create the file change card**

```tsx
// src/components/chat/FileChangeCard.tsx
import { useState } from 'react'
import { readFile } from '../../lib/workspace'
import styles from './FileChangeCard.module.css'

interface Props {
  icon: string       // "📄" | "✏️" | "🗑️"
  action: string     // "Created" | "Modified" | "Deleted" | "Edited"
  path: string
  language?: string
}

export default function FileChangeCard({ icon, action, path, language }: Props) {
  const [expanded, setExpanded] = useState(false)
  const content = action !== 'Deleted' ? readFile(path) : null
  const ext = path.split('.').pop()?.toLowerCase()
  const lang = language ?? ext ?? 'text'

  return (
    <div className={`${styles.card} ${styles[action.toLowerCase()]}`}>
      <button className={styles.header} onClick={() => setExpanded(!expanded)}>
        <span className={styles.icon}>{icon}</span>
        <span className={styles.action}>{action}</span>
        <span className={styles.path}>{path}</span>
        {content !== null && (
          <svg
            className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>
      {expanded && content !== null && (
        <div className={styles.codeBlock}>
          <div className={styles.codeHeader}>
            <span className={styles.lang}>{lang}</span>
            <span className={styles.lineCount}>{content.split('\n').length} lines</span>
          </div>
          <pre className={styles.code}><code>{content}</code></pre>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create styles**

```css
/* src/components/chat/FileChangeCard.module.css */

.card {
  margin: 6px 0;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  overflow: hidden;
  font-size: 13px;
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 13px;
  text-align: left;
}

.header:hover {
  background: var(--bg-hover);
}

.icon {
  font-size: 15px;
  flex-shrink: 0;
}

.action {
  color: var(--text-secondary);
  font-weight: 500;
  flex-shrink: 0;
}

.path {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--accent);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron {
  flex-shrink: 0;
  color: var(--text-tertiary);
  transition: transform 0.15s ease;
}

.chevronOpen {
  transform: rotate(180deg);
}

.created {
  border-left: 3px solid #4ade80;
}

.modified, .edited {
  border-left: 3px solid var(--accent);
}

.deleted {
  border-left: 3px solid #f87171;
  opacity: 0.7;
}

.codeBlock {
  border-top: 1px solid var(--border-subtle);
  background: #1a1a1e;
}

.codeHeader {
  display: flex;
  justify-content: space-between;
  padding: 6px 12px;
  font-size: 11px;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  border-bottom: 1px solid var(--border-subtle);
}

.code {
  padding: 12px;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  color: #d4d4d8;
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
}
```

- [ ] **Step 3: Commit**

---

### Task 6: Update ChatPanel for Agentic Loop

**Files:**
- Modify: `src/components/chat/ChatPanel.tsx`
- Modify: `src/components/chat/ChatMessage.tsx`
- Create: `src/components/chat/AgentThinking.tsx`
- Create: `src/components/chat/AgentThinking.module.css`

- [ ] **Step 1: Update Message interface and render agent stream events**

Key changes:
- Add `segments` array to Message for mixed content (text + file cards + thinking blocks)
- Update `handleSend` to use `runAgentLoop` instead of `streamChat`
- Render `FileChangeCard` for tool results
- Render `AgentThinking` for thinking state
- Wire up WebContainer for real builds (stub for now, integrate @webcontainer/api later)

- [ ] **Step 2: Commit**

---

### Task 7: Wire Up Chat Interface

**Files:**
- Modify: `src/lib/chat.ts` — Replace streamChat with agent loop integration
- Modify: `src/components/chat/ChatPanel.tsx` — Final integration

- [ ] **Step 1: Integrate and test the full loop**

- [ ] **Step 2: Commit**
```

- [ ] **Step 3: Commit plan**
