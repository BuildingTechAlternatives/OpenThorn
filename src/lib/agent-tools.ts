/**
 * Agent Tools — tool definitions (OpenAI function-calling JSON Schema)
 * and execution layer. Defines the 7 tools the AI agent can use
 * during the Plan → Act → Reflect loop.
 */

import {
  listFiles,
  readFile,
  writeFile,
  editFile,
  deleteFile,
  executeBuild,
  getErrors,
} from './workspace'
/* ── Tool Definitions ─────────────────────────────── */

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
      description:
        'List all files in the project workspace. Always call this FIRST to understand the project structure before planning any changes.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description:
        'Read the complete contents of a file. Call this before modifying existing files so you know their exact current content.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description:
              'The file path relative to the project root (e.g. "src/App.tsx", "src/components/Header.tsx")',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description:
        'Create a new file or completely overwrite an existing file. Use this for NEW files or when rewriting an ENTIRE file. For small targeted changes to existing files, prefer edit_file instead.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description:
              'File path relative to project root (e.g. "src/components/Header.tsx")',
          },
          content: {
            type: 'string',
            description:
              'The COMPLETE file content. Must be fully implemented — no stubs, TODOs, or placeholders.',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description:
        'Make a surgical string replacement in an existing file. Use this for small targeted changes (less than ~20 lines). The old_string must match the file content EXACTLY including whitespace and indentation. Read the file first if unsure about the exact content.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path relative to project root',
          },
          old_string: {
            type: 'string',
            description:
              'The EXACT text to replace — must match file content character-for-character including indentation',
          },
          new_string: {
            type: 'string',
            description: 'The replacement text',
          },
        },
        required: ['path', 'old_string', 'new_string'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_file',
      description:
        'Delete a file from the project workspace. Only use this for files that are truly no longer needed.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to delete (e.g. "src/old/DebugTools.tsx")',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_build',
      description:
        'Run the build to verify all files compile without errors. Call this after finishing ALL file changes. If it fails, call get_errors to see what went wrong.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_errors',
      description:
        'Get the errors and warnings from the last build. Call this when execute_build fails to understand exactly what needs to be fixed.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
]

/* ── Tool Execution ────────────────────────────────── */

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, string>
}

export interface ToolResult {
  id: string
  name: string
  result: string // JSON-stringified result for the model
  display: string // Human-readable for the chat UI
}

export async function executeTool(call: ToolCall): Promise<ToolResult> {
  const base = { id: call.id, name: call.name }

  try {
    switch (call.name) {
      case 'list_files': {
        const files = listFiles()
        const listing = files
          .map(
            (f) =>
              `${f.path} (${(f.content.length / 1024).toFixed(1)}KB, modified ${new Date(f.lastModified).toLocaleTimeString()})`
          )
          .join('\n')
        return {
          ...base,
          result: `Files in workspace (${files.length} total):\n${listing}`,
          display: '📂 Listed workspace files',
        }
      }

      case 'read_file': {
        const content = readFile(call.arguments.path)
        if (content === null) {
          return {
            ...base,
            result: `Error: File not found: ${call.arguments.path}`,
            display: `❌ File not found: ${call.arguments.path}`,
          }
        }
        return {
          ...base,
          result: content,
          display: `📖 Read ${call.arguments.path}`,
        }
      }

      case 'write_file': {
        const existed = readFile(call.arguments.path) !== null
        writeFile(call.arguments.path, call.arguments.content)
        const icon = existed ? '✏️' : '📄'
        const action = existed ? 'Modified' : 'Created'
        return {
          ...base,
          result: `File written successfully: ${call.arguments.path}`,
          display: `${icon} ${action} ${call.arguments.path}`,
        }
      }

      case 'edit_file': {
        const editResult = editFile(
          call.arguments.path,
          call.arguments.old_string,
          call.arguments.new_string
        )
        if (!editResult.success) {
          return {
            ...base,
            result: `Edit failed: ${editResult.error}`,
            display: `❌ Edit failed on ${call.arguments.path}: ${editResult.error}`,
          }
        }
        return {
          ...base,
          result: `Edit applied successfully to ${call.arguments.path}`,
          display: `✏️ Edited ${call.arguments.path}`,
        }
      }

      case 'delete_file': {
        const ok = deleteFile(call.arguments.path)
        if (!ok) {
          return {
            ...base,
            result: `Error: File not found: ${call.arguments.path}`,
            display: `❌ Delete failed: ${call.arguments.path} not found`,
          }
        }
        return {
          ...base,
          result: `File deleted: ${call.arguments.path}`,
          display: `🗑️ Deleted ${call.arguments.path}`,
        }
      }

      case 'execute_build': {
        const buildResult = await executeBuild()
        const summary = buildResult.success
          ? 'Build passed with no errors.'
          : `Build failed with ${buildResult.errors.length} error(s):\n${buildResult.errors.join('\n')}`
        const display = buildResult.success
          ? '✅ Build passed'
          : `🔨 Build failed — ${buildResult.errors.length} error(s)`
        return { ...base, result: summary, display }
      }

      case 'get_errors': {
        const errs = getErrors()
        if (!errs) {
          return {
            ...base,
            result: 'No build has been run yet. Call execute_build first.',
            display: '⚠️ No build data available',
          }
        }
        if (errs.errors.length === 0 && errs.warnings.length === 0) {
          return {
            ...base,
            result: 'No errors or warnings from the last build.',
            display: '✅ No errors or warnings',
          }
        }
        const text = [
          errs.errors.length > 0
            ? `Build errors (${errs.errors.length}):\n${errs.errors.join('\n')}`
            : '',
          errs.warnings.length > 0
            ? `Warnings (${errs.warnings.length}):\n${errs.warnings.join('\n')}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n')
        return {
          ...base,
          result: text,
          display: `🔍 ${errs.errors.length} error(s), ${errs.warnings.length} warning(s)`,
        }
      }

      default:
        return {
          ...base,
          result: `Unknown tool: ${call.name}. Available tools: list_files, read_file, write_file, edit_file, delete_file, execute_build, get_errors`,
          display: `❌ Unknown tool: ${call.name}`,
        }
    }
  } catch (e) {
    return {
      ...base,
      result: `Tool execution error: ${(e as Error).message}`,
      display: `❌ Error: ${(e as Error).message}`,
    }
  }
}

/* ── Tool Call Parsing ─────────────────────────────── */

/**
 * Parse tool calls from an OpenAI-compatible API response delta.
 */
export function parseToolCallsFromDelta(
  delta: Record<string, unknown>
): { index: number; id?: string; name?: string; arguments?: string }[] {
  const toolCalls = delta.tool_calls as
    | Array<{
        index: number
        id?: string
        function?: { name?: string; arguments?: string }
      }>
    | undefined
  if (!toolCalls) return []

  return toolCalls.map((tc) => ({
    index: tc.index,
    id: tc.id,
    name: tc.function?.name,
    arguments: tc.function?.arguments,
  }))
}
