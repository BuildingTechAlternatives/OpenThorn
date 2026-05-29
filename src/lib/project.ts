/**
 * Project state — stores generated website files, handles iframe assembly,
 * CSP injection, safety scripts, and file parsing.
 */

export interface ProjectFile {
  name: string
  content: string
}

export interface ProjectFileMeta {
  content: string
  lastModified: number
  dependsOn: string[]
  dependedOnBy: string[]
}

export interface ProjectState {
  html: string
  css: string
  js: string
  files: ProjectFile[]
  graph: Record<string, ProjectFileMeta>
}

let project: ProjectState = {
  html: '',
  css: '',
  js: '',
  files: [],
  graph: {},
}

const listeners = new Set<() => void>()

function notify() { listeners.forEach((l) => l()) }

export function getProject(): ProjectState { return project }

export function subscribeToProject(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/* ── File Operations ──────────────────────────────── */

export function setProjectFile(name: string, content: string) {
  const idx = project.files.findIndex((f) => f.name === name)
  if (idx >= 0) {
    project.files[idx] = { name, content }
  } else {
    project.files.push({ name, content })
  }

  if (name.endsWith('.html') || name === 'index.html') project.html = content
  else if (name.endsWith('.css')) project.css = content
  else if (name.endsWith('.js')) project.js = content

  project.graph = buildDependencyGraph(project.files)
  notify()
}

export function removeProjectFile(name: string) {
  project.files = project.files.filter((f) => f.name !== name)
  if (project.html && name.endsWith('.html')) project.html = ''
  if (project.css && name.endsWith('.css')) project.css = ''
  if (project.js && name.endsWith('.js')) project.js = ''
  project.graph = buildDependencyGraph(project.files)
  notify()
}

export function updateProjectFiles(files: Record<string, string>) {
  for (const [name, content] of Object.entries(files)) {
    setProjectFile(name, content)
  }
}

/* ── Dependency Graph ─────────────────────────────── */

function buildDependencyGraph(files: ProjectFile[]): Record<string, ProjectFileMeta> {
  const result: Record<string, ProjectFileMeta> = {}
  for (const f of files) {
    result[f.name] = {
      content: f.content,
      lastModified: Date.now(),
      dependsOn: findDeps(f.name, f.content),
      dependedOnBy: [],
    }
  }
  for (const [name, meta] of Object.entries(result)) {
    for (const dep of meta.dependsOn) {
      if (result[dep]) result[dep].dependedOnBy.push(name)
    }
  }
  return result
}

function findDeps(name: string, content: string): string[] {
  const deps: string[] = []
  if (name.endsWith('.html')) {
    for (const m of content.matchAll(/href="([^"]+\.css)"/g)) deps.push(m[1])
    for (const m of content.matchAll(/src="([^"]+\.js)"/g)) deps.push(m[1])
  }
  if (name.endsWith('.js')) {
    for (const m of content.matchAll(/from ['"]([^'"]+)['"]/g)) {
      if (!m[1].startsWith('http')) deps.push(m[1])
    }
  }
  return deps
}

export function getUpdateStrategy(changedFiles: string[]): 'css-swap' | 'reload' {
  return changedFiles.every((f) => f.endsWith('.css')) ? 'css-swap' : 'reload'
}

/* ── Safe iframe HTML Assembly ────────────────────── */

export function buildPreviewHtml(): string {
  const { html, css, js } = project
  if (!html) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#0b0b0b;color:rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui,sans-serif;text-align:center;padding:40px;margin:0}</style></head><body><span>Describe what you want to build to get started</span></body></html>`
  }

  let doc = html

  // Inject CSP meta
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://fonts.googleapis.com https://fonts.gstatic.com; connect-src 'none'; form-action 'none';">`
  doc = doc.replace(/(<head[^>]*>)/i, `$1\n${cspMeta}`)

  // Inject safety script (localStorage shim, console isolation)
  const safetyScript = `<script>(function(){const _s={};Object.defineProperty(window,'localStorage',{get:()=>({getItem:k=>_s[k]??null,setItem:(k,v)=>{_s[k]=String(v)},removeItem:k=>{delete _s[k]},clear:()=>{Object.keys(_s).forEach(k=>delete _s[k])}})});})();</script>`
  doc = doc.replace(/(<head[^>]*>)/i, `$1\n${safetyScript}`)

  // Inline CSS if separate styles.css exists and is linked
  if (css) {
    doc = doc.replace(
      /<link[^>]+href="styles\.css"[^>]*\/?>/gi,
      `<style>/* styles.css */\n${css}</style>`
    )
  }

  // Inline JS if separate app.js/script.js exists and is linked
  if (js) {
    doc = doc.replace(
      /<script[^>]+src="(?:app|script)\.js"[^>]*><\/script>/gi,
      `<script>/* app.js */\n${js}<\/script>`
    )
  }

  return doc
}

/* ── CSS Hot-Swap ─────────────────────────────────── */

export function hotSwapCss(iframe: HTMLIFrameElement, css: string) {
  const doc = iframe.contentDocument
  if (!doc) return
  let style = doc.getElementById('__bloom_css') as HTMLStyleElement
  if (!style) {
    style = doc.createElement('style')
    style.id = '__bloom_css'
    doc.head.appendChild(style)
  }
  style.textContent = css
}

/* ── Code Parsing ─────────────────────────────────── */

export function parseFilesFromResponse(text: string): Record<string, string> {
  const files: Record<string, string> = {}

  // Primary: XML <file> tags
  const xmlRegex = /<file\s+name="([^"]+)">([\s\S]*?)<\/file>/g
  let match
  while ((match = xmlRegex.exec(text)) !== null) {
    files[match[1].trim()] = match[2].trim()
  }

  if (Object.keys(files).length > 0) return files

  // Fallback: markdown fences
  const fenceRegex = /```(\w+)\n([\s\S]*?)```/g
  const extMap: Record<string, string> = {
    html: 'index.html', css: 'styles.css', javascript: 'app.js', js: 'app.js', json: 'package.json',
  }
  while ((match = fenceRegex.exec(text)) !== null) {
    const name = extMap[match[1].toLowerCase()] ?? `file.${match[1]}`
    files[name] = match[2].trim()
  }

  return files
}

/* ── Validation ───────────────────────────────────── */

export interface ValidationResult {
  valid: boolean
  issues: string[]
}

export function validateHtml(html: string): ValidationResult {
  const issues: string[] = []
  if (!html.includes('<!DOCTYPE')) issues.push('Missing DOCTYPE')
  if (!/<html/i.test(html)) issues.push('Missing <html> tag')
  if (!/<head/i.test(html)) issues.push('Missing <head> tag')
  if (!/<body/i.test(html)) issues.push('Missing <body> tag')
  const placeholders = [/\/\/\s*\.\.\./, /\/\/\s*rest of/i, /TODO:/i, /PLACEHOLDER/i]
  for (const p of placeholders) {
    if (p.test(html)) issues.push(`Placeholder found: ${p.source}`)
  }
  const open = (html.match(/<[a-z][^/>!]*>/gi) ?? []).length
  const close = (html.match(/<\/[a-z][^>]*>/gi) ?? []).length
  if (Math.abs(open - close) > 3) issues.push(`Unbalanced tags: ${open} open, ${close} close`)
  return { valid: issues.length === 0, issues }
}

export function validateJs(js: string): ValidationResult {
  const issues: string[] = []
  try { new Function(js) } catch (e) { issues.push(`Syntax error: ${(e as Error).message}`) }
  return { valid: issues.length === 0, issues }
}

/* ── File Relevance Detection ─────────────────────── */

export function selectRelevantFiles(userMessage: string): ProjectFile[] {
  const lower = userMessage.toLowerCase()
  const cssKw = ['color', 'style', 'layout', 'font', 'margin', 'padding', 'flex', 'grid', 'dark mode', 'theme', 'responsive']
  const jsKw = ['button', 'click', 'function', 'api', 'fetch', 'event', 'form', 'submit', 'animation', 'data', 'storage']
  const wantsCss = cssKw.some((k) => lower.includes(k))
  const wantsJs = jsKw.some((k) => lower.includes(k))

  return project.files.filter((f) => {
    if (f.name.endsWith('.html')) return true
    if (f.name.endsWith('.css')) return wantsCss
    if (f.name.endsWith('.js')) return wantsJs
    return true
  })
}

/* ── File Manifest for Prompt ─────────────────────── */

export function buildFileManifest(files: ProjectFile[]): string {
  if (files.length === 0) return 'No files yet — this is a new project.'
  return [
    'Files in this project:',
    ...files.map((f) => `- ${f.name} (${(f.content.length / 1024).toFixed(1)}KB)`),
    '',
    'Current file contents:',
    ...files.map((f) => `<file name="${f.name}">\n${f.content}\n</file>`),
  ].join('\n')
}
