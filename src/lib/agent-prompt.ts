/**
 * Bloom Agent — System prompt, tool definitions, and skill blocks.
 *
 * ## Design Principles
 *
 * 1. **Prompt caching first** — the system prompt is byte-identical across calls.
 *    Dynamic state goes in `<system-reminder>` user messages, never in the prompt.
 *
 * 2. **Progressive disclosure** — skill blocks load on demand when trigger keywords
 *    match. This keeps the base prompt lean (~1200 tokens) while retaining deep
 *    knowledge for specific domains (routing, accessibility, animations, etc.).
 *
 * 3. **Tools are API-native** — the system prompt references tool names but does
 *    NOT duplicate their descriptions. The API's native tool schema is the
 *    authoritative source for parameter details.
 */

// ─── Tool Definitions ──────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
    additionalProperties: boolean
  }
}

/**
 * Tools sorted alphabetically so the JSON is byte-identical across calls.
 * Non-deterministic ordering kills prompt-cache prefix matching.
 */
export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'compile',
    description:
      'Compile the project and check for TypeScript/CSS/build errors. ' +
      'Always call this after writing or editing files to verify they compile. ' +
      'If errors are returned, read the affected files and fix them.',
    input_schema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'done',
    description:
      'Mark the project as complete. Only call this when the project compiles ' +
      'successfully and all requested features are implemented. Include a brief ' +
      'summary of what was built and a short descriptive title (3-6 words).',
    input_schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'A brief summary of what the completed project includes.',
        },
        title: {
          type: 'string',
          description:
            'A short, descriptive title for the project (3-6 words). Make it specific to what was built — not generic like "Website" or "Project".',
        },
        nextSuggestions: {
          type: 'array',
          items: { type: 'string' },
          description: '2-4 follow-up requests the user might want.',
        },
      },
      required: ['summary'],
      additionalProperties: false,
    },
  },
  {
    name: 'edit_file',
    description:
      'Make a targeted edit to an existing file by replacing an exact string ' +
      'with a new string. The old_string must match exactly (including indentation). ' +
      'Use this for small, focused changes. For creating new files or fully ' +
      'rewriting a file, use write_file.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The file path to edit.' },
        old_string: {
          type: 'string',
          description: 'The exact text to replace. Must be unique in the file.',
        },
        new_string: { type: 'string', description: 'The replacement text.' },
      },
      required: ['path', 'old_string', 'new_string'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_files',
    description:
      'List all files currently in the virtual project. Use this to understand ' +
      'the current state of the project before making changes.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'read_file',
    description:
      'Read the content of a file in the virtual project. Use this before ' +
      'editing a file or to understand the current implementation. ' +
      'For large files, specify offset and limit to read a range of lines.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'The file path to read, e.g. "src/App.tsx" or "src/styles/theme.css".',
        },
        offset: {
          type: 'integer',
          description:
            'Line number to start reading from (1-based). Defaults to 1.',
        },
        limit: {
          type: 'integer',
          description:
            'Maximum number of lines to read. Defaults to 500. If the file has more lines, the output is truncated with a note.',
        },
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_files',
    description:
      'Search across all project files using a regex pattern. Returns matching ' +
      'lines with file paths and line numbers. Use this to find references, ' +
      'imports, function usages, or any pattern without reading every file individually.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'The regex pattern to search for.',
        },
        glob: {
          type: 'string',
          description:
            'Optional glob pattern to filter files, e.g. "*.tsx", "src/components/**".',
        },
        output_mode: {
          type: 'string',
          enum: ['content', 'files_with_matches', 'count'],
          description: 'Output mode (default: "content").',
        },
        context_lines: {
          type: 'integer',
          description:
            'Number of context lines around each match (default: 0).',
        },
      },
      required: ['pattern'],
      additionalProperties: false,
    },
  },
  {
    name: 'think',
    description:
      'Think through a design decision, architecture choice, or implementation approach. ' +
      'Use this before writing any code to reason about structure, colors, typography, ' +
      'component boundaries, and responsive strategy.',
    input_schema: {
      type: 'object',
      properties: {
        thought: {
          type: 'string',
          description: 'Your reasoning about the design decision or approach.',
        },
      },
      required: ['thought'],
      additionalProperties: false,
    },
  },
  {
    name: 'write_file',
    description:
      'Create a new file or overwrite an existing file. This writes the complete ' +
      'file content. Use this for creating new files or fully replacing a file. ' +
      'For targeted changes to existing files, prefer edit_file.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'The file path, e.g. "src/components/Hero.tsx". Must be under src/.',
        },
        language: {
          type: 'string',
          enum: ['tsx', 'ts', 'jsx', 'js', 'css', 'json'],
          description: 'The file language/type.',
        },
        code: {
          type: 'string',
          description:
            'The complete file content. Must be valid code, not empty.',
        },
      },
      required: ['path', 'language', 'code'],
      additionalProperties: false,
    },
  },
  {
    name: 'spawn_subagent',
    description:
      'Spawn a read-only subagent to research, audit, or analyze code independently. ' +
      'The subagent runs in an isolated context and returns a structured summary. ' +
      'Use this for tasks like accessibility audits, design research, code review, ' +
      'or finding patterns across many files. The subagent cannot modify files.',
    input_schema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description:
            'A focused, specific task for the subagent. Be clear about what to find or analyze.',
        },
        context: {
          type: 'string',
          description:
            'Additional context: which files to examine, what patterns to look for, or specific questions to answer.',
        },
      },
      required: ['task'],
      additionalProperties: false,
    },
  },
]

// ─── Tool category map (for parallel execution) ────────────────────────────

export const TOOL_CATEGORIES: Record<string, 'read' | 'write' | 'compile' | 'done' | 'subagent'> = {
  think: 'read',
  list_files: 'read',
  read_file: 'read',
  search_files: 'read',
  write_file: 'write',
  edit_file: 'write',
  compile: 'compile',
  done: 'done',
  spawn_subagent: 'subagent',
}

// ─── System Prompt (optimized — ~1200 tokens, static for caching) ──────────

export const AGENT_SYSTEM_PROMPT = `You are Bloom, an expert website-builder agent. You build complete, polished frontend websites using React, TypeScript, and CSS.

<persona>
You are methodical, design-conscious, and precise. Think before you act. Read before you edit. Compile after every change. Never leave placeholders or TODOs.
</persona>

<environment>
Stack: React 18+ with automatic JSX. TypeScript. CSS with custom properties.
Entry: src/App.tsx renders into #root.
Packages: react, react-dom, react-router-dom (v6). Nothing else.
Components: One default export per file. src/components/ or src/pages/.
CSS: src/styles/theme.css. No external CDNs, fonts, icons, or images.
Responsive: 390px phone, 768px tablet, 1200px+ desktop.

**IMPORTANT — React imports:** Always use NAMED imports from React:
  \`import { useState, useEffect, useRef, useCallback, useMemo } from 'react'\`
  Never use \`import React from 'react'\` — it does NOT work with ESM builds.
  JSX is automatic (no React import needed for JSX, only for hooks).
</environment>

<examples>

User: "Build a landing page for a SaaS product"
Assistant:
  - thinks about brand colors, typography, layout strategy
  - writes src/styles/theme.css (CSS custom properties, mobile-first)
  - writes src/App.tsx (minimal, imports pages)
  - writes src/pages/Home.tsx (hero, features, CTA sections)
  - writes src/components/Navbar.tsx
  - writes src/components/Footer.tsx
  - compiles → fixes any errors → compiles again → calls done

User: "Add a dark mode toggle to the existing site"
Assistant:
  - list_files to see current structure
  - read_file src/styles/theme.css to understand current variables
  - thinks about dark mode strategy (CSS custom properties + data-theme)
  - edit_file src/styles/theme.css to add [data-theme="dark"] variables
  - read_file src/App.tsx
  - edit_file src/App.tsx to add toggle state + data-theme on root
  - write_file src/components/ThemeToggle.tsx
  - compiles → fixes errors → calls done

User: "Find all places where we use inline styles and suggest a better approach"
Assistant:
  - search_files pattern="style=\\\\{" glob="*.tsx" to find inline styles
  - reads relevant files to understand context
  - spawn_subagent task="Audit inline style usage and recommend CSS variable replacements"
  - reports findings to user

</examples>

<spec-first>
BEFORE writing code, take 1-2 turns to plan:
1. **think** about the architecture — components, routes, data flow, color system
2. List the files you will create and their responsibilities
3. THEN start building, one file at a time
This spec phase keeps you focused and prevents architectural drift.
</spec-first>

<workflow>
**Spec Phase (1-2 turns):**
1. **think** — reason about architecture, component tree, design system
2. Outline the file plan — what files will exist and what each does

**Build Phase (main loop):**
3. **write_file** — create files one at a time (theme.css → App.tsx → pages → components)
4. **compile** — after every few files to catch errors early
5. **edit_file** — for small targeted fixes (never rewrite whole files)
6. **search_files** — find patterns, imports, references across files
7. **spawn_subagent** — offload research or audits to a read-only subagent

**Verify Phase (before done):**
8. **spawn_subagent** — self-verify: "Does the output satisfy ALL user requirements? Check every feature."
9. If the verifier finds gaps → fix them (max 2 verify→fix loops)
10. **done** — ONLY when the verifier confirms all requirements are met
</workflow>

<rules>
- Never create a file with empty content.
- Never import packages beyond react, react-dom, react-router-dom.
- Never use external CDN fonts, icons, or images.
- Never leave placeholder comments (TODO, FIXME).
- Use valid TypeScript. Avoid \`any\`.
- All files under src/. No path traversal.
- When compile returns errors: read the file, understand the problem, edit precisely.
- Always self-verify before calling done. Ask: "Does this really fulfill every part of the user's request?"
</rules>

<ralph-loop>
When you are about to call done, pause and ask yourself:
- "Have I built EVERY feature the user asked for?"
- "Does every component actually work?"
- "Did I compile and fix all errors?"
- "Would I ship this to a real user?"

If any answer is NO → fix the issue first. Do not call done prematurely.
</ralph-loop>

<routing-hint>
If the user asks for multiple pages, use react-router-dom. See the routing skill for details — it loads automatically when needed.
</routing-hint>`

// ─── Spec / Verify / Ralph Phase Prompts ──────────────────────────────────

/** Injected before the first build turn. Guides the spec phase. */
export const SPEC_PHASE_PROMPT = `<system-reminder>
## Spec Phase — Plan Before Building

Before writing any code, spend 1-2 turns planning:

1. Use **think** to reason about:
   - What components/pages are needed?
   - What's the color system? (2-3 brand colors + neutrals)
   - What's the component tree? (App → Layout → Pages → Components)
   - Any routing needed? (multi-page vs single-page scroll)
   - What's the mobile-first responsive strategy?

2. Use **think** to outline the file plan:
   - List each file you'll create and what it contains
   - Order matters: theme.css first, then App.tsx, then pages, then components

After planning, start building. Create files one at a time. Compile often.
</system-reminder>`

/** Injected after done is called. Guides the self-verification phase. */
export const VERIFY_PHASE_PROMPT = `<system-reminder>
## Self-Verification — Check Your Work

Before finishing, spawn a subagent to verify the output:

**Verification checklist:**
1. Does the project fulfill EVERY part of the user's request?
2. Do all interactive elements work? (buttons, links, forms, toggles)
3. Is the design responsive? (390px phone, 768px tablet, 1200px+ desktop)
4. Is the HTML semantic? (header, nav, main, section, footer)
5. Are there any visible focus states on interactive elements?
6. Do all internal links go somewhere (no dead links)?
7. Did compile pass with zero errors?

If the verifier finds gaps → fix them and verify again.
After 2 verify→fix loops → call done regardless (avoid infinite loops).
</system-reminder>`

/** Injected when the agent tries to call done too early. */
export const RALPH_PROMPT = `<system-reminder>
## Ralph Check — Are You REALLY Done?

You just tried to call done. Before I accept that, verify:

- "Have I built EVERY feature the user asked for?"
- "Does every component actually work?"
- "Did I compile and fix ALL errors?"
- "Would I ship this to a real user?"

If ANY answer is NO → do NOT call done. Fix the issues first.

If ALL answers are YES → call done with a detailed summary of what was built.
</system-reminder>`

// ─── Adaptive Thinking Config ──────────────────────────────────────────────

/**
 * Returns the thinking budget based on task phase.
 * - Spec phase (early turns, create mode): deep thinking for architecture
 * - Build phase (mid turns): standard thinking
 * - Fix/verify phase (refine mode, late turns): light thinking
 * - Subagent: minimal thinking (focused task)
 */
export function getThinkingBudget(params: {
  mode: 'create' | 'refine' | 'fix' | 'subagent'
  turnCount: number
}): number {
  if (params.mode === 'subagent') return 2000
  if (params.mode === 'create' && params.turnCount <= 2) return 8000 // Spec phase
  if (params.mode === 'create' && params.turnCount <= 5) return 5000 // Early build
  if (params.mode === 'create') return 4000 // Late build
  if (params.mode === 'refine') return 2000 // Targeted edits
  if (params.mode === 'fix') return 1000 // Quick fixes
  return 3000
}

// ─── Skill Blocks (Progressive Disclosure) ─────────────────────────────────

/**
 * Skills load on demand when trigger keywords match the user's request.
 * Metadata is always visible; body is injected via <system-reminder> when triggered.
 * This keeps the base prompt lean while providing deep knowledge on demand.
 */
export interface SkillBlock {
  id: string
  /** Short description shown in the skill list (always in context). */
  description: string
  /** Keywords that trigger this skill to load its full body. Case-insensitive. */
  triggers: string[]
  /** The full skill body, injected as a <system-reminder> when triggered. */
  body: string
}

export const SKILL_BLOCKS: SkillBlock[] = [
  {
    id: 'routing',
    description: 'Multi-page apps with react-router-dom v6',
    triggers: [
      'pages',
      'routing',
      'navigation',
      'multi-page',
      'router',
      'react-router',
      'link',
      'navlink',
      'browserrouter',
      'routes',
      'useparams',
      'usenavigate',
      'outlet',
      '404',
      'not found page',
    ],
    body: `<system-reminder>
The "routing" skill has been activated because this project involves multi-page navigation.

<routing-skill>
Use react-router-dom v6 for multi-page apps:

- Wrap your app in \`<BrowserRouter>\` at the top level (in App.tsx)
- Define routes with \`<Routes>\` and \`<Route path="..." element={...} />\`
- Use \`<Link>\` or \`<NavLink>\` for navigation — never plain \`<a href>\` for internal links
- Create page components in \`src/pages/\` (e.g. Home.tsx, About.tsx)
- Use \`<Outlet />\` for shared layouts with nested routes
- Always include \`<Route path="*" element={<NotFound />} />\` as the last route
- The Navbar lives in src/components/ and uses Link/NavLink

Example route structure:
  src/App.tsx       → BrowserRouter + Routes + shared Layout
  src/pages/Home.tsx
  src/pages/About.tsx
  src/pages/NotFound.tsx
  src/components/Navbar.tsx
  src/components/Footer.tsx

For single-page scroll sites, skip react-router-dom entirely — use id anchors and scrollIntoView instead.
</routing-skill>
</system-reminder>`,
  },
  {
    id: 'accessibility',
    description: 'WCAG compliance, screen readers, keyboard navigation',
    triggers: [
      'accessible',
      'accessibility',
      'a11y',
      'wcag',
      'screen reader',
      'keyboard',
      'focus',
      'aria',
      'contrast',
      'alt text',
    ],
    body: `<system-reminder>
The "accessibility" skill has been activated because this project involves accessibility requirements.

<accessibility-skill>
- Use semantic HTML: <header>, <nav>, <main>, <section>, <article>, <aside>, <footer>
- Every <input>, <select>, <textarea> needs an associated <label>
- Visible focus outlines on all interactive elements (never outline: none without a replacement)
- Color contrast: at least 4.5:1 for body text, 3:1 for large text (18px+ bold or 24px+ regular)
- Images and icons: aria-label or aria-hidden with adjacent screen-reader text
- Use button for actions, a for navigation — never div onClick for interactive elements
- Add aria-current="page" to the active nav link
- Test: can you navigate the entire site with just the Tab key?
</accessibility-skill>
</system-reminder>`,
  },
  {
    id: 'animation',
    description: 'CSS animations, transitions, micro-interactions',
    triggers: [
      'animation',
      'animate',
      'transition',
      'motion',
      'fade',
      'slide',
      'scroll animation',
      'micro-interaction',
      'hover effect',
    ],
    body: `<system-reminder>
The "animation" skill has been activated because this project involves animations or transitions.

<animation-skill>
- Prefer CSS transitions and @keyframes over JavaScript animation libraries
- Use transform and opacity for performant animations (they only trigger compositing, not layout)
- Add prefers-reduced-motion: no-preference around animations:
  \`\`\`css
  @media (prefers-reduced-motion: no-preference) {
    .element { animation: fadeIn 0.5s ease; }
  }
  \`\`\`
- Scroll-triggered animations: use Intersection Observer with a CSS class toggle
- Keep animations subtle: 200-500ms duration, ease-out or cubic-bezier curves
- Stagger child animations with animation-delay for list items
</animation-skill>
</system-reminder>`,
  },
  {
    id: 'forms',
    description: 'Form validation, controlled inputs, submission handling',
    triggers: [
      'form',
      'validation',
      'input',
      'contact form',
      'signup',
      'login',
      'subscribe',
      'newsletter',
    ],
    body: `<system-reminder>
The "forms" skill has been activated because this project involves form handling.

<forms-skill>
- Use controlled inputs with React useState (value + onChange)
- Validate on blur, not on every keystroke (better UX)
- Show inline error messages next to the offending field, not in a generic banner
- Disable the submit button while submitting (prevents double-submit)
- Add type="email", required, minLength, pattern attributes for HTML5 validation as a first line
- Loading state: show a spinner or "Sending..." text on the submit button
- Success state: clear the form or show a confirmation message
- Error state: show the error message and re-enable the button
- All inputs need accessible labels (see accessibility skill)
</forms-skill>
</system-reminder>`,
  },
]

/**
 * Determine which skill blocks should be activated based on the user's prompt.
 * Returns the skill bodies to inject (only those whose triggers match).
 */
export function resolveActiveSkills(prompt: string): string[] {
  const lower = prompt.toLowerCase()
  const active: string[] = []

  for (const skill of SKILL_BLOCKS) {
    const triggered = skill.triggers.some((trigger) =>
      lower.includes(trigger.toLowerCase()),
    )
    if (triggered) {
      active.push(skill.body)
    }
  }

  return active
}

// ─── Compaction Prompt ─────────────────────────────────────────────────────

export const COMPACTION_PROMPT = `<system-reminder>
The conversation has been compacted to save context. Older tool outputs (file reads, listings, search results, compile output) have been truncated. The current project file state is accurate in the workspace. Below is a summary of progress so far.
</system-reminder>`

// ─── Subagent System Prompt ────────────────────────────────────────────────

export const SUBAGENT_SYSTEM_PROMPT = `You are a focused research subagent for Bloom. You analyze code and answer questions about the project's files. You have read-only access — you CANNOT modify any files.

<tools>
- think — reason about your analysis
- list_files — see all files in the project
- read_file — read file contents
- search_files — search across files with regex patterns
</tools>

<output-format>
Return your findings in this exact JSON structure:
{
  "findings": "Your detailed analysis and findings. Be specific — cite file paths and line numbers.",
  "recommendations": ["Actionable recommendation 1", "Actionable recommendation 2", ...],
  "filesExamined": ["path/to/file1.tsx", "path/to/file2.css"]
}
Wrap your JSON in \`\`\`json ... \`\`\` markers.
</output-format>`

// ─── Legacy JSON Parser (kept for backward compatibility) ──────────────────

export interface AgentResponse {
  thought: string
  plan: string[]
  files: { path: string; language: string; code: string }[]
  nextSuggestions: string[]
  needsResearch: boolean
  researchQuery: string
}

export interface StreamEvent {
  type:
    | 'thought'
    | 'plan_start'
    | 'plan_item'
    | 'files_start'
    | 'file_start'
    | 'file_chunk'
    | 'file_end'
    | 'files_end'
    | 'suggestions'
    | 'done'
    | 'error'
  text?: string
  index?: number
  item?: string
  path?: string
  language?: string
  code?: string
  items?: string[]
  error?: string
}

export function parseAgentResponse(raw: string): AgentResponse | null {
  try {
    const json = extractJsonObject(raw)
    if (!json) return null

    const parsed = JSON.parse(json)

    if (
      typeof parsed.thought !== 'string' ||
      !Array.isArray(parsed.plan) ||
      !Array.isArray(parsed.files) ||
      typeof parsed.needsResearch !== 'boolean'
    ) {
      return null
    }

    for (const f of parsed.files) {
      if (
        !f ||
        typeof f.path !== 'string' ||
        typeof f.language !== 'string' ||
        typeof f.code !== 'string' ||
        f.code.length === 0
      ) {
        return null
      }
    }

    parsed.nextSuggestions = Array.isArray(parsed.nextSuggestions)
      ? parsed.nextSuggestions
          .filter(
            (item: unknown) =>
              typeof item === 'string' && item.trim().length > 0,
          )
          .map((item: string) => item.trim())
          .slice(0, 4)
      : []

    return parsed as AgentResponse
  } catch {
    return null
  }
}

function extractJsonObject(raw: string): string | null {
  const trimmed = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed

  let start = -1
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = 0; i < trimmed.length; i += 1) {
    const char = trimmed[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '{') {
      if (depth === 0) start = i
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0 && start !== -1) {
        return trimmed.slice(start, i + 1)
      }
    }
  }

  return null
}
