/**
 * Lightweight in-browser TypeScript type-checking.
 *
 * ## Why this exists
 *
 * esbuild-wasm only transpiles — it strips types and never reports a type
 * error. A wrong prop, a missing field, calling a function with the wrong
 * arity, or a reference to an undeclared name all "compile" cleanly. The
 * runtime smoke test catches the subset that throws on render, but plenty of
 * type bugs are silent or intermittent. This module adds the missing signal: a
 * real `tsc`-style semantic pass over the project's own source.
 *
 * ## Design constraints
 *
 * - **Never break the pipeline.** TypeScript (~several MB) is loaded via dynamic
 *   import so it is code-split out of the main bundle, and EVERY failure path
 *   (no module, no network for lib files, host error) resolves to
 *   `{ ran: false }`. The agent then simply relies on esbuild + runtime checks.
 * - **No false-positive storms.** We declare the allowed packages (react, etc.)
 *   as ambient `any` modules and supply a permissive JSX namespace, so the
 *   checker focuses on the user's OWN code (undefined names, type mismatches,
 *   bad arity) instead of drowning in missing-@types noise.
 */

export interface TypeError {
  file: string
  line: number
  column: number
  message: string
}

export interface TypeCheckResult {
  /** Whether the check actually ran (false = unavailable, treat as inconclusive). */
  ran: boolean
  /** True when no type errors were found (or it didn't run). */
  ok: boolean
  errors: TypeError[]
}

const INCONCLUSIVE: TypeCheckResult = { ran: false, ok: true, errors: [] }

/**
 * Diagnostic codes related to module/import resolution and declaration files.
 * These are suppressed because the ambient `any` shims for allowed packages
 * intentionally don't model real import shapes — keeping them would produce
 * false failures on every `import { x } from 'react'`.
 */
const MODULE_NOISE_CODES = new Set<number>([
  2305, // Module has no exported member
  2306, // File is not a module
  2307, // Cannot find module
  2497, // module can only be default-imported using esModuleInterop
  2580, // Cannot find name 'require'/'process' etc. (needs @types/node)
  2613, // Module has no default export
  2614, // Module has no exported member (use default)
  2792, // Cannot find module; did you mean to set moduleResolution
  7016, // Could not find a declaration file for module
  1259, // Module can only be default-imported using esModuleInterop
  1192, // Module has no default export
])

// Lib files are fetched once per session and cached.
const libCache = new Map<string, string>()
const TS_VERSION = '5.8.3'
const LIB_FILES = [
  'lib.es2020.full.d.ts', // pulls in es2020 + dom + dom.iterable via references
]

/**
 * Ambient declarations injected as an extra source file. Declaring the allowed
 * imports as `any` modules keeps the checker from flagging every React/icon
 * import, while the permissive JSX namespace prevents "no JSX.IntrinsicElements"
 * errors on every element. We still catch the user's real mistakes.
 */
const AMBIENT_SHIM = `
declare namespace JSX {
  interface IntrinsicElements { [elem: string]: any }
  interface Element {}
  interface ElementClass {}
  interface ElementAttributesProperty {}
  interface ElementChildrenAttribute { children: {} }
}
declare module 'react' { const x: any; export = x; export as namespace React; }
declare module 'react/jsx-runtime' { const x: any; export = x; }
declare module 'react/jsx-dev-runtime' { const x: any; export = x; }
declare module 'react-dom' { const x: any; export = x; }
declare module 'react-dom/client' { const x: any; export = x; }
declare module 'react-router-dom' { const x: any; export = x; }
declare module 'framer-motion' { const x: any; export = x; }
declare module 'lucide-react' { const x: any; export = x; }
declare module 'recharts' { const x: any; export = x; }
declare module 'clsx' { const x: any; export = x; }
declare module 'date-fns' { const x: any; export = x; }
declare module 'nanoid' { const x: any; export = x; }
declare module '*.css';
`

async function fetchLib(name: string): Promise<string | null> {
  if (libCache.has(name)) return libCache.get(name)!
  try {
    const res = await fetch(`https://cdn.jsdelivr.net/npm/typescript@${TS_VERSION}/lib/${name}`)
    if (!res.ok) return null
    const text = await res.text()
    libCache.set(name, text)
    return text
  } catch {
    return null
  }
}

/**
 * Recursively resolve `/// <reference lib="..." />` directives so a single
 * top-level lib (es2020.full) brings in everything it depends on.
 */
async function loadAllLibs(): Promise<Record<string, string> | null> {
  const out: Record<string, string> = {}
  const queue = [...LIB_FILES]
  const seen = new Set<string>()

  while (queue.length > 0) {
    const name = queue.shift()!
    if (seen.has(name)) continue
    seen.add(name)
    const content = await fetchLib(name)
    if (content == null) {
      // The root lib is required; a missing referenced lib is tolerable.
      if (name === LIB_FILES[0]) return null
      continue
    }
    out[name] = content
    const refs = content.matchAll(/\/\/\/\s*<reference\s+lib=["']([^"']+)["']\s*\/>/g)
    for (const m of refs) queue.push(`lib.${m[1]}.d.ts`)
  }
  return out
}

export interface TypeCheckFile {
  path: string
  code: string
}

/**
 * Type-check the project's TypeScript/TSX files. Returns INCONCLUSIVE
 * (ran:false) whenever the toolchain or lib files can't be loaded.
 */
export async function typeCheckProject(files: TypeCheckFile[]): Promise<TypeCheckResult> {
  // Browser/runtime guard — no point without source files.
  const srcFiles = files.filter(
    (f) => /\.(ts|tsx)$/.test(f.path) && !f.path.endsWith('.d.ts'),
  )
  if (srcFiles.length === 0) return INCONCLUSIVE

  let ts: typeof import('typescript')
  try {
    ts = await import('typescript')
  } catch {
    return INCONCLUSIVE
  }

  const libs = await loadAllLibs()
  if (!libs) return INCONCLUSIVE

  const ROOT = '/'
  const SHIM_PATH = `${ROOT}__ambient__.d.ts`

  // Virtual filesystem the host reads from.
  const vfs = new Map<string, string>()
  vfs.set(SHIM_PATH, AMBIENT_SHIM)
  for (const f of srcFiles) {
    const p = f.path.startsWith('/') ? f.path : `${ROOT}${f.path}`
    vfs.set(p, f.code)
  }
  for (const [name, content] of Object.entries(libs)) {
    vfs.set(`${ROOT}${name}`, content)
  }

  const options: import('typescript').CompilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: false,
    noImplicitAny: false,
    skipLibCheck: true,
    noEmit: true,
    allowJs: false,
    esModuleInterop: true,
    isolatedModules: false,
    lib: [LIB_FILES[0]],
    types: [],
  }

  const rootNames = [SHIM_PATH, ...srcFiles.map((f) => (f.path.startsWith('/') ? f.path : `${ROOT}${f.path}`))]
  const sourceFileCache = new Map<string, import('typescript').SourceFile>()

  const host: import('typescript').CompilerHost = {
    fileExists: (fileName) => vfs.has(fileName),
    readFile: (fileName) => vfs.get(fileName),
    directoryExists: () => true,
    getCurrentDirectory: () => ROOT,
    getDirectories: () => [],
    getCanonicalFileName: (f) => f,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    getDefaultLibFileName: () => `${ROOT}${LIB_FILES[0]}`,
    writeFile: () => {},
    getSourceFile: (fileName, languageVersion) => {
      if (sourceFileCache.has(fileName)) return sourceFileCache.get(fileName)
      const text = vfs.get(fileName)
      if (text == null) return undefined
      const sf = ts.createSourceFile(fileName, text, languageVersion, true)
      sourceFileCache.set(fileName, sf)
      return sf
    },
  }

  let program: import('typescript').Program
  try {
    program = ts.createProgram(rootNames, options, host)
  } catch {
    return INCONCLUSIVE
  }

  const srcPathSet = new Set(
    srcFiles.map((f) => (f.path.startsWith('/') ? f.path : `${ROOT}${f.path}`)),
  )

  const diagnostics = [
    ...program.getSyntacticDiagnostics(),
    ...program.getSemanticDiagnostics(),
  ].filter((d) => d.file && srcPathSet.has(d.file.fileName))

  const errors: TypeError[] = []
  for (const d of diagnostics) {
    if (d.category !== ts.DiagnosticCategory.Error) continue
    // Ignore module/import-resolution noise — our ambient shims declare the
    // allowed packages as `any`, so any import-shape complaint is a shim
    // artifact, not a real bug. We keep the high-signal checks (undefined
    // names, bad arity, property/type mismatches) which is the whole point.
    if (MODULE_NOISE_CODES.has(d.code)) continue
    const message = ts.flattenDiagnosticMessageText(d.messageText, '\n')
    let line = 0
    let column = 0
    if (d.file && typeof d.start === 'number') {
      const pos = d.file.getLineAndCharacterOfPosition(d.start)
      line = pos.line + 1
      column = pos.character + 1
    }
    const file = d.file ? d.file.fileName.replace(/^\//, '') : ''
    errors.push({ file, line, column, message })
  }

  return { ran: true, ok: errors.length === 0, errors }
}

/** Format type errors into a concise, agent-readable report. */
export function formatTypeErrors(result: TypeCheckResult, max = 8): string | null {
  if (!result.ran || result.ok || result.errors.length === 0) return null
  const shown = result.errors.slice(0, max)
  const lines = [
    `Type check found ${result.errors.length} type error(s):`,
    ...shown.map(
      (e, i) => `  ${i + 1}. ${e.file}:${e.line}:${e.column} — ${e.message}`,
    ),
  ]
  if (result.errors.length > max) {
    lines.push(`  ... and ${result.errors.length - max} more.`)
  }
  lines.push(
    '',
    'These are TYPE errors esbuild does not catch. Read the file, fix the type/reference, and compile again.',
  )
  return lines.join('\n')
}
