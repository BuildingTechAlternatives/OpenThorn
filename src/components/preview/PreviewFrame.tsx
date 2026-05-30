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
  const indexHtml = files.find(f => f.path === 'index.html')

  // Always build a bundled preview from source files
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

  // Bundle JSX files — strip imports/exports since all code shares scope
  // Babel standalone in the iframe handles JSX transpilation
  const allJs = jsxFiles
    .map(f => {
      let code = f.content
      // Replace CSS module imports with identity proxy (styles.xyz → "xyz")
      code = code.replace(
        /^import\s+(\w+)\s+from\s+['"](\.\/|\.\.\/)*[^'"]+\.module\.css['"]\s*;?\s*$/gm,
        (_, name) => `const ${name} = new Proxy({}, {get: (_, k) => k})`
      )
      // Strip ALL other import statements (React loaded via CDN, plain CSS injected)
      code = code.replace(/^import\s+.*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
      code = code.replace(/^import\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
      // Strip export default but keep the declaration
      code = code.replace(/^export\s+default\s+/gm, '')
      // Strip export from named exports
      code = code.replace(/^export\s+(const|let|var|function|class)\s+/gm, '$1 ')
      return `// ${f.path}\n${code}`
    })
    .join('\n\n')

  // Entry: render the App component
  const initCode = `\nconst root = ReactDOM.createRoot(document.getElementById('root'));\nroot.render(<App />);`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:;">
<title>${indexHtml ? extractTitle(indexHtml.content) : 'Bloom Project'}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.24.0/babel.min.js"></script>
<style>
/* Default preview styles */
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #000; font-family: system-ui, sans-serif; }
#root { width: 100%; height: 100%; }
${allCss}
</style>
</head>
<body>
<div id="root"></div>
<script>
// Make all React APIs available as globals since imports are stripped
Object.assign(window, React);
Object.assign(window, ReactDOM);
</script>
<script type="text/babel">
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
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>
    </div>
  )
}
