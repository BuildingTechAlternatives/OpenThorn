import { useState, useEffect, useCallback } from 'react'
import type { Device } from './PreviewPanel'
import { getWorkspace, subscribeToWorkspace } from '../../lib/workspace'
import styles from './PreviewFrame.module.css'

const deviceWidths: Record<Device, string> = {
  phone: '375px',
  tablet: '768px',
  pc: '100%',
}

interface Props {
  device: Device
}

/* ── Preview Builder ─────────────────────────────── */

function buildPreviewSrcDoc(): string {
  const { files } = getWorkspace()

  const scaffoldPaths = [
    'index.html', 'package.json', 'vite.config.js',
    'tailwind.config.js', 'postcss.config.js', 'src/index.css',
    'src/main.jsx', 'src/App.jsx',
  ]

  const hasChanges =
    files.length !== scaffoldPaths.length ||
    files.some((f) => !scaffoldPaths.includes(f.path))

  if (!hasChanges) {
    return blankPage()
  }

  // Collect all source files
  const jsxFiles = files.filter(f => f.path.endsWith('.jsx') || f.path.endsWith('.tsx'))
  const cssFiles = files.filter(f => f.path.endsWith('.css'))
  const htmlFiles = files.filter(f => f.path.endsWith('.html'))

  // Always build a bundled preview from source files
  // (index.html is just a module entry point — not standalone)
  return buildBundledPreview(jsxFiles, cssFiles, indexHtml)
}

function blankPage(): string {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#0b0b0f;margin:0}</style></head><body></body></html>'
}

/* ── Bundle builder ──────────────────────────────── */

function buildBundledPreview(
  jsxFiles: { path: string; content: string }[],
  cssFiles: { path: string; content: string }[],
  indexHtml: { path: string; content: string } | undefined,
): string {
  // Combine all CSS
  const allCss = cssFiles.map(f => `/* ${f.path} */\n${f.content}`).join('\n\n')

  // Transform JSX to plain JS
  const allJs = jsxFiles
    .map(f => transformJSX(f.content, f.path))
    .join('\n\n')

  // Find the entry point (main.jsx or App.jsx)
  const hasMain = jsxFiles.some(f => f.path === 'src/main.jsx')
  const appFile = jsxFiles.find(f => f.path.endsWith('App.jsx'))

  // Generate the init code
  const initCode = hasMain
    ? `\n// Init\nconst root = ReactDOM.createRoot(document.getElementById('root'));\nroot.render(React.createElement(React.StrictMode, null, React.createElement(App)));`
    : appFile
      ? `\n// Init\nconst root = ReactDOM.createRoot(document.getElementById('root'));\nroot.render(React.createElement(App));`
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${indexHtml ? extractTitle(indexHtml.content) : 'Bloom Project'}</title>
<script crossorigin src="https://unpkg.com/react@19/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@19/umd/react-dom.development.js"></script>
<style>${allCss}</style>
</head>
<body>
<div id="root"></div>
<script>
// React components from project files
${allJs}
${initCode}
</script>
</body>
</html>`
}

function extractTitle(html: string): string {
  const m = html.match(/<title>([^<]+)<\/title>/)
  return m ? m[1] : 'Bloom Project'
}

/* ── JSX to JS Transform ─────────────────────────── */

function transformJSX(code: string, filename: string): string {
  let out = code

  // Strip import statements (React is loaded from CDN)
  out = out.replace(/^import\s+.*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
  // Strip export statements
  out = out.replace(/^export\s+(default\s+)?/gm, '')

  // Convert JSX to React.createElement calls
  // This is a basic but functional transform for common patterns

  // Handle JSX elements: <Component attr="val">children</Component>
  // We process from innermost to outermost by matching tags without children tags
  let changed = true
  let iterations = 0
  while (changed && iterations < 50) {
    changed = false
    iterations++

    // Match self-closing tags: <Component prop="val" />
    out = out.replace(
      /<([A-Z][A-Za-z0-9_]*)\s+([^>]*?)\s*\/>/g,
      (_, tag, props) => `React.createElement(${tag}${props ? ', ' + jsxPropsToObj(props) : ', null'})`
    )

    // Match HTML self-closing: <div prop="val" />
    out = out.replace(
      /<([a-z][a-z0-9-]*)\s+([^>]*?)\s*\/>/g,
      (_, tag, props) => `React.createElement('${tag}'${props ? ', ' + jsxPropsToObj(props) : ', null'})`
    )

    // Match component with children: <Component prop="val">children</Component>
    out = out.replace(
      /<([A-Z][A-Za-z0-9_]*)\s+([^>]*)>([\s\S]*?)<\/\1>/g,
      (_, tag, props, children) => {
        changed = true
        const c = children.trim()
        const args = [tag, props ? jsxPropsToObj(props) : 'null']
        if (c) args.push(jsxChildren(c))
        return `React.createElement(${args.join(', ')})`
      }
    )

    // Match HTML element with children: <div prop="val">children</div>
    out = out.replace(
      /<([a-z][a-z0-9-]*)\s+([^>]*)>([\s\S]*?)<\/\1>/g,
      (_, tag, props, children) => {
        changed = true
        const c = children.trim()
        const args = [`'${tag}'`, props ? jsxPropsToObj(props) : 'null']
        if (c) args.push(jsxChildren(c))
        return `React.createElement(${args.join(', ')})`
      }
    )

    // Match component without props with children: <Component>children</Component>
    out = out.replace(
      /<([A-Z][A-Za-z0-9_]*)>([\s\S]*?)<\/\1>/g,
      (_, tag, children) => {
        changed = true
        return `React.createElement(${tag}, null, ${jsxChildren(children.trim())})`
      }
    )

    // Match HTML without props with children: <tag>children</tag>
    out = out.replace(
      /<([a-z][a-z0-9-]*)>([\s\S]*?)<\/\1>/g,
      (_, tag, children) => {
        changed = true
        return `React.createElement('${tag}', null, ${jsxChildren(children.trim())})`
      }
    )
  }

  // Clean up double commas and spaces
  out = out.replace(/, ,/g, ', ')
  out = out.replace(/,\s*,/g, ', ')
  out = out.replace(/;\s*;/g, ';')

  return `// --- ${filename} ---\n${out}`
}

function jsxPropsToObj(props: string): string {
  if (!props.trim()) return 'null'
  // Split on spaces that precede attribute names
  const attrs: string[] = []
  const re = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g
  let m
  while ((m = re.exec(props)) !== null) {
    const name = m[1] === 'class' ? 'className' : m[1] === 'for' ? 'htmlFor' : m[1]
    const value = m[2] ?? m[3] ?? m[4] ?? 'true'
    attrs.push(`${name}: ${value}`)
  }
  return attrs.length > 0 ? `{ ${attrs.join(', ')} }` : 'null'
}

function jsxChildren(text: string): string {
  if (!text) return 'null'
  // If it contains expression braces, keep as-is
  if (text.includes('{') && text.includes('}')) {
    // Split into text and expressions
    const parts: string[] = []
    let remaining = text
    while (remaining.length > 0) {
      const exprStart = remaining.indexOf('{')
      if (exprStart === -1) {
        const trimmed = remaining.trim()
        if (trimmed) parts.push(`"${trimmed.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`)
        break
      }
      if (exprStart > 0) {
        const textPart = remaining.slice(0, exprStart).trim()
        if (textPart) parts.push(`"${textPart.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`)
      }
      remaining = remaining.slice(exprStart + 1)
      const exprEnd = remaining.indexOf('}')
      if (exprEnd === -1) break
      const expr = remaining.slice(0, exprEnd).trim()
      if (expr) parts.push(expr)
      remaining = remaining.slice(exprEnd + 1)
    }
    return parts.length > 0 ? parts.join(', ') : 'null'
  }
  return `"${text.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
}

/* ── Component ───────────────────────────────────── */

export default function PreviewFrame({ device }: Props) {
  const [srcDoc, setSrcDoc] = useState(buildPreviewSrcDoc)

  const updatePreview = useCallback(() => {
    setSrcDoc(buildPreviewSrcDoc())
  }, [])

  useEffect(() => {
    return subscribeToWorkspace(() => updatePreview())
  }, [updatePreview])

  return (
    <div className={`${styles.wrapper} ${device !== 'pc' ? styles.framed : ''}`}>
      <div className={styles.container} style={{ width: deviceWidths[device] }}>
        {device !== 'pc' && (
          <div className={styles.frame}>
            {device === 'phone' && <div className={styles.notch} />}
            <div className={styles.urlBar}>
              <div className={styles.dots}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
              <span className={styles.url}>http://localhost:5173</span>
            </div>
          </div>
        )}
        <div className={styles.content}>
          <iframe
            srcDoc={srcDoc}
            className={styles.iframe}
            title="Website preview"
            sandbox="allow-scripts"
          />
        </div>
      </div>
    </div>
  )
}
