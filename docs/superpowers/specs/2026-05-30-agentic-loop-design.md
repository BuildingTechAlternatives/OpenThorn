# Agentic Loop — Website Building Process Redesign

**Date:** 2026-05-30  
**Status:** Design approved, ready for implementation plan

## Overview

Redesign Bloom's website building process from a single-turn prompt → response model to an autonomous agentic loop, mirroring Claude Code's architecture. The AI agent works in a tool-use loop: analyze → plan → act → verify → fix → repeat, until the build passes.

## Architecture

### Agentic Loop (mirrors Claude Code's `nO` master loop)

```
User prompt
  → AI analyzes workspace (list_files, read_file tools)
  → AI plans approach
  → AI writes files one by one (write_file tool)
  → AI triggers build (execute_build tool)
  → AI reads errors (get_errors tool)
  → AI fixes files → rebuilds → repeats until clean (max 3 cycles)
  → AI returns final summary
```

**Loop logic:** While the AI's response includes a tool call → execute it → feed result back → AI thinks again. When the AI produces plain text without a tool call → loop ends, message shown to user.

### Technology: WebContainer

Use `@webcontainer/api` to run a real Node/Vite dev server in the browser. This enables:
- Real TypeScript compilation with full error reporting
- React/TSX support with proper module resolution
- Build errors and runtime console errors captured for the fix loop
- Preview points to actual running dev server in the iframe

### Tool Set

| Tool | Purpose |
|------|---------|
| `list_files` | List all files in the project workspace |
| `read_file(path)` | Read a specific file's content |
| `write_file(path, content)` | Create or overwrite a file |
| `edit_file(path, old_string, new_string)` | Surgical string replacement in a file |
| `delete_file(path)` | Remove a file |
| `execute_build()` | Run the WebContainer build (vite) |
| `get_errors()` | Get build errors + runtime console errors |

## New Files

```
src/
  lib/
    agent-loop.ts        ← Master agent loop (nO-equivalent)
    agent-tools.ts        ← Tool definitions + execution
    workspace.ts          ← Project file store + WebContainer integration
    system-prompt.ts      ← Smart system prompt builder
  components/
    chat/
      FileChangeCard.tsx   ← Compact "Created/Modified X" card
      AgentThinking.tsx    ← Streaming thinking indicator
```

## System Prompt Design

5-section structure based on Anthropic's agent prompting principles:

1. **Role & Identity** — Autonomous website builder
2. **Dynamic Workspace Context** — Injected file tree and project state
3. **Tool Use Rules** — Heuristics (budgets, irreversibility, stopping conditions)
4. **Thinking Rhythm** — Plan → Act → Reflect → Repeat
5. **Critical Rules** — Repeated at end for emphasis

### Key Heuristics

- "You modify real files" — irreversibility awareness
- "Stop when it works" — don't over-engineer
- "3 tries, then ask" — max fix cycles
- "Tools over text" — use write_file, never dump code in chat
- "Analyze first" — always list_files + read_file before planning

## Thinking Rhythm (Plan → Act → Reflect)

```
💭 "Let me analyze the current workspace..."
   → list_files() tool call
   
💭 Analysis → plan

⚡ write_file("src/components/X.tsx", ...)
   → UI: 📄 Created src/components/X.tsx

⚡ execute_build()
   → UI: ✅ Build passed or 🔨 Build failed

💭 Fix or finish → report
```

## Pre-Initialized Workspace

New projects start with a Vite + React + TypeScript scaffold:

```
project/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  src/
    main.tsx
    App.tsx
    App.module.css
    styles/
      globals.css
```

## File Change Display

Files are NEVER shown as full content in chat. Instead, compact cards:
- 📄 Created `src/components/Header.tsx`
- ✏️ Modified `src/utils/api.ts`
- 🗑️ Deleted `src/old/legacy.ts`

Cards are expandable to view diffs/code on demand.

## Chat UX — Claude Code Style

- Streaming character-by-character with markdown rendering
- 💭 Thinking blocks (dimmed, planning text) vs ⚡ Action blocks (file cards)
- Build status: 🔨 building → ✅ passed or ❌ failed
- Final summary after successful build

## Error Handling

1. Build fails → AI reads errors → fixes files → rebuilds (automatic)
2. Max 3 retry cycles → then reports what couldn't be fixed
3. API errors during streaming → shown inline, user can retry
4. WebContainer fails to start → fallback message with troubleshooting
