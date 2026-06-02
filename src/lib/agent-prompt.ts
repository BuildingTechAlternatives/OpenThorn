/**
 * Bloom Agent — System prompt and tool definitions.
 *
 * The agent uses Claude Code-style tool calls: it speaks in natural language
 * and uses tools to read, write, edit, and compile files. Files are created
 * one at a time across multiple turns — not dumped in one JSON response.
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

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'think',
    description:
      'Think through a design decision, architecture choice, or implementation approach. ' +
      'Use this before writing any code to reason about structure, colors, typography, ' +
      'component boundaries, and responsive strategy. The thinking content is shown to ' +
      'the user in a collapsible block — be thorough but concise.',
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
    name: 'list_files',
    description:
      'List all files currently in the virtual project. Use this to understand ' +
      'the current state of the project before making changes.',
    input_schema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'read_file',
    description:
      'Read the full content of a file in the virtual project. Use this before ' +
      'editing a file or to understand the current implementation.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The file path to read, e.g. "src/App.tsx" or "src/styles/theme.css".',
        },
      },
      required: ['path'],
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
          description: 'The file path, e.g. "src/components/Hero.tsx". Must be under src/.',
        },
        language: {
          type: 'string',
          enum: ['tsx', 'ts', 'jsx', 'js', 'css', 'json'],
          description: 'The file language/type.',
        },
        code: {
          type: 'string',
          description: 'The complete file content. Must be valid code, not empty.',
        },
      },
      required: ['path', 'language', 'code'],
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
        path: {
          type: 'string',
          description: 'The file path to edit.',
        },
        old_string: {
          type: 'string',
          description: 'The exact text to replace. Must be unique in the file.',
        },
        new_string: {
          type: 'string',
          description: 'The replacement text.',
        },
      },
      required: ['path', 'old_string', 'new_string'],
      additionalProperties: false,
    },
  },
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
          description: 'A short, descriptive title for the project (3-6 words). Make it specific to what was built — not generic like "Website" or "Project".',
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
]

// ─── System Prompt ─────────────────────────────────────────────────────────

export const AGENT_SYSTEM_PROMPT = `You are Bloom, an expert website-builder agent. You build complete, polished frontend websites using React, TypeScript, and CSS.

## Your Environment

- **Stack:** React 18+, TypeScript, CSS
- **Entry point:** src/App.tsx renders into #root
- **JSX transform:** automatic — do not import React just for JSX
- **Available packages:** react, react-dom, and react-router-dom (v6)
- **Routing:** You can build multi-page apps with react-router-dom. Import from "react-router-dom" as usual.
- **CSS:** One src/styles/theme.css file with CSS custom properties (create additional CSS files under src/styles/ if needed)
- **Components:** One default-exported component per file under src/components/ or src/pages/
- **Assets:** No external images, CDNs, or icon libraries. Use CSS gradients, inline SVG, semantic markup, and system typography.
- **Responsive:** Always support 390px phone, 768px tablet, and 1200px+ desktop.

## Routing with react-router-dom

When the user asks for multiple pages (e.g. Home, About, Contact, Products), use react-router-dom to create proper routes:

- Import \`BrowserRouter\`, \`Routes\`, \`Route\`, \`Link\`, \`NavLink\`, \`useNavigate\`, \`useParams\` from \`"react-router-dom"\`
- Wrap your app in \`<BrowserRouter>\` at the top level (in App.tsx)
- Define routes with \`<Routes>\` and \`<Route path="..." element={...} />\`
- Use \`<Link>\` or \`<NavLink>\` for navigation (never plain \`<a href>\` for internal links)
- Create page components in \`src/pages/\` (e.g. \`src/pages/Home.tsx\`, \`src/pages/About.tsx\`)
- Use \`<Outlet />\` for shared layouts
- Always include a catch-all \`<Route path="*" element={<NotFound />} />\` for 404 pages
- For single-page websites, a multi-section scroll layout without react-router-dom is still fine

**Route structure example:**
\`\`\`
src/App.tsx — BrowserRouter + Routes + shared Layout
src/pages/Home.tsx
src/pages/About.tsx
src/pages/Contact.tsx
src/pages/NotFound.tsx
src/components/Navbar.tsx — contains Link/NavLink elements
src/components/Footer.tsx
src/styles/theme.css
\`\`\`

## How You Work

You have access to tools: **think**, **list_files**, **read_file**, **write_file**, **edit_file**, **compile**, and **done**.

Your approach is up to you — there is no fixed checklist. Typically you will:

1. Use **think** to reason about the design before writing code
2. Use **list_files** to see what already exists
3. Use **write_file** to create files one at a time, starting with the foundation (theme.css, then App.tsx, then pages/components)
4. Use **compile** periodically to catch errors early
5. Use **edit_file** for small targeted fixes
6. Use **done** when the project compiles and is complete

**Create files one at a time.** Write a file, then write the next. This keeps the project state consistent and makes errors easy to fix. After writing a few files, compile to check your work.

**Fix errors precisely.** When compile returns errors, read the affected file, understand the problem, and make a targeted fix with edit_file. Do not rewrite the whole file unless necessary.

## Design Principles

- Pick 2-3 brand colors plus neutrals. Use CSS custom properties.
- One system font stack. Clear typography hierarchy with clamp() for responsive sizing.
- Consistent spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96px.
- Mobile-first CSS. Layer on min-width media queries.
- Semantic HTML landmarks. Visible focus states. Adequate contrast.
- Domain-specific copy, labels, and CTAs that match the user's request.
- Each component file has exactly one default export.
- All files live under src/. No path traversal.

## Hard Rules

- Never create a file with empty content.
- Never import packages other than react, react-dom, or react-router-dom.
- Never use external CDN fonts, icons, or images.
- Never leave placeholder comments (TODO, FIXME, "add code here").
- Use valid TypeScript. Avoid \`any\` unless absolutely necessary.
- The user should be able to compile and view the site at any point.`

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
  type: 'thought' | 'plan_start' | 'plan_item' | 'files_start' | 'file_start' | 'file_chunk' | 'file_end' | 'files_end' | 'suggestions' | 'done' | 'error'
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
        .filter((item: unknown) => typeof item === 'string' && item.trim().length > 0)
        .map((item: string) => item.trim())
        .slice(0, 4)
      : []

    return parsed as AgentResponse
  } catch {
    return null
  }
}

function extractJsonObject(raw: string): string | null {
  const trimmed = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
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
