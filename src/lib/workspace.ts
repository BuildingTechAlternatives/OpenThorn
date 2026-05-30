/**
 * Workspace — project file store + build pipeline.
 * Manages the pre-initialized Vite + React + TypeScript project,
 * file CRUD, build execution, and error capture.
 */

export interface WorkspaceFile {
  path: string // e.g. "src/components/Header.tsx"
  content: string
  lastModified: number
}

export interface BuildResult {
  success: boolean
  errors: string[]
  warnings: string[]
  logs: string[]
}

export interface WorkspaceState {
  files: WorkspaceFile[]
  buildResult: BuildResult | null
  previewUrl: string | null
}

/* ── Default Project Scaffold ─────────────────────── */

const DEFAULT_FILES: WorkspaceFile[] = [
  {
    path: 'index.html',
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bloom Project</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    lastModified: Date.now(),
  },
  {
    path: 'package.json',
    content: JSON.stringify(
      {
        name: 'bloom-project',
        private: true,
        version: '0.0.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'tsc -b && vite build',
          preview: 'vite preview',
        },
        dependencies: {
          react: '^19.2.0',
          'react-dom': '^19.2.0',
        },
        devDependencies: {
          '@types/react': '^19.0.0',
          '@types/react-dom': '^19.0.0',
          '@vitejs/plugin-react': '^6.0.0',
          typescript: '~6.0.0',
          vite: '^8.0.0',
        },
      },
      null,
      2
    ),
    lastModified: Date.now(),
  },
  {
    path: 'tsconfig.json',
    content: JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',
          strict: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          noFallthroughCasesInSwitch: true,
        },
        include: ['src'],
      },
      null,
      2
    ),
    lastModified: Date.now(),
  },
  {
    path: 'vite.config.ts',
    content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`,
    lastModified: Date.now(),
  },
  {
    path: 'src/main.tsx',
    content: `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)`,
    lastModified: Date.now(),
  },
  {
    path: 'src/App.tsx',
    content: `import styles from './App.module.css'

export default function App() {
  return (
    <div className={styles.app}>
      <h1>Hello Bloom</h1>
      <p>Describe what you want to build to get started.</p>
    </div>
  )
}`,
    lastModified: Date.now(),
  },
  {
    path: 'src/App.module.css',
    content: `.app {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-family: system-ui, sans-serif;
  text-align: center;
  padding: 2rem;
}

.app h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.app p {
  color: #888;
}`,
    lastModified: Date.now(),
  },
  {
    path: 'src/styles/globals.css',
    content: `*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}`,
    lastModified: Date.now(),
  },
]

/* ── Workspace State ──────────────────────────────── */

let workspace: WorkspaceState = {
  files: DEFAULT_FILES.map((f) => ({ ...f, lastModified: Date.now() })),
  buildResult: null,
  previewUrl: null,
}

const listeners = new Set<() => void>()
function notify() {
  listeners.forEach((l) => l())
}

export function getWorkspace(): WorkspaceState {
  return workspace
}

export function subscribeToWorkspace(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function resetWorkspace() {
  workspace = {
    files: DEFAULT_FILES.map((f) => ({ ...f, lastModified: Date.now() })),
    buildResult: null,
    previewUrl: null,
  }
  notify()
}

/* ── File CRUD ────────────────────────────────────── */

export function writeFile(path: string, content: string): WorkspaceFile {
  const existing = workspace.files.find((f) => f.path === path)
  if (existing) {
    existing.content = content
    existing.lastModified = Date.now()
    notify()
    return existing
  }
  const file: WorkspaceFile = { path, content, lastModified: Date.now() }
  workspace.files.push(file)
  // Keep files sorted by path
  workspace.files.sort((a, b) => a.path.localeCompare(b.path))
  notify()
  return file
}

export function readFile(path: string): string | null {
  return workspace.files.find((f) => f.path === path)?.content ?? null
}

export function deleteFile(path: string): boolean {
  const idx = workspace.files.findIndex((f) => f.path === path)
  if (idx === -1) return false
  workspace.files.splice(idx, 1)
  notify()
  return true
}

export function editFile(
  path: string,
  oldString: string,
  newString: string
): { success: boolean; error?: string } {
  const file = workspace.files.find((f) => f.path === path)
  if (!file) return { success: false, error: `File not found: ${path}` }
  if (!file.content.includes(oldString)) {
    return { success: false, error: 'old_string not found in file — it may have changed since you last read it' }
  }
  file.content = file.content.replace(oldString, newString)
  file.lastModified = Date.now()
  notify()
  return { success: true }
}

export function listFiles(): WorkspaceFile[] {
  return [...workspace.files]
}

/* ── Build Pipeline ───────────────────────────────── */

/**
 * Basic syntax check for TypeScript/TSX files.
 * Checks for unbalanced braces, brackets, and parentheses.
 * Full type-checking requires WebContainer — this catches the most common issues.
 */
function syntaxCheck(code: string): string[] {
  const issues: string[] = []

  // Count braces/brackets/parens (ignoring strings and comments)
  const stripped = code
    .replace(/`[^`]*`/g, '') // template literals
    .replace(/'[^']*'/g, '') // single quotes
    .replace(/"[^"]*"/g, '') // double quotes
    .replace(/\/\/.*$/gm, '') // line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments

  const pairs: [string, string, string][] = [
    ['{', '}', 'braces'],
    ['[', ']', 'brackets'],
    ['(', ')', 'parentheses'],
  ]

  for (const [open, close, name] of pairs) {
    const openCount = (stripped.match(new RegExp(`\\${open}`, 'g')) ?? []).length
    const closeCount = (stripped.match(new RegExp(`\\${close}`, 'g')) ?? []).length
    if (openCount !== closeCount) {
      issues.push(`Unbalanced ${name}: ${openCount} opening, ${closeCount} closing`)
    }
  }

  // Check for common issues
  if (stripped.includes('export default class')) {
    issues.push('TypeScript interfaces use "interface" keyword, not classes')
  }

  return issues
}

export async function executeBuild(): Promise<BuildResult> {
  const errors: string[] = []
  const warnings: string[] = []
  const logs: string[] = []

  for (const file of workspace.files) {
    if (
      file.path.endsWith('.ts') ||
      file.path.endsWith('.tsx') ||
      file.path.endsWith('.js') ||
      file.path.endsWith('.jsx')
    ) {
      const issues = syntaxCheck(file.content)
      for (const issue of issues) {
        errors.push(`${file.path}: ${issue}`)
      }
    }

    if (file.path.endsWith('.css')) {
      // Basic CSS check — unbalanced braces
      const openBraces = (file.content.match(/\{/g) ?? []).length
      const closeBraces = (file.content.match(/\}/g) ?? []).length
      if (openBraces !== closeBraces) {
        errors.push(`${file.path}: Unbalanced CSS braces (${openBraces} open, ${closeBraces} close)`)
      }
    }
  }

  // Check for import consistency — referenced files should exist
  for (const file of workspace.files) {
    if (file.path.endsWith('.ts') || file.path.endsWith('.tsx')) {
      const importMatches = file.content.matchAll(
        /from\s+['"](\.\/|\.\.\/)([^'"]+)['"]/g
      )
      for (const match of importMatches) {
        const importPath = match[2]
        // Resolve relative import
        const dir = file.path.split('/').slice(0, -1).join('/')
        const resolved = dir ? `${dir}/${importPath}` : importPath
        const withExt = [
          resolved,
          `${resolved}.ts`,
          `${resolved}.tsx`,
          `${resolved}.js`,
          `${resolved}.jsx`,
          `${resolved}/index.ts`,
          `${resolved}/index.tsx`,
        ]
        const exists = withExt.some((p) =>
          workspace.files.some((f) => f.path === p)
        )
        if (!exists) {
          // Only flag local imports (not npm packages)
          warnings.push(
            `${file.path}: Import "${match[2]}" may be missing — no matching file found`
          )
        }
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
