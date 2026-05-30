import { useState, useEffect, useRef, useCallback } from 'react'
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

/**
 * Build a preview HTML page from workspace files.
 * Renders index.html directly — the AI is instructed to create a working,
 * self-contained HTML file with CDN imports for dependencies.
 */
function buildPreviewSrcDoc(): string {
  const { files } = getWorkspace()

  const scaffoldPaths = [
    'index.html',
    'package.json',
    'tsconfig.json',
    'vite.config.ts',
    'src/main.tsx',
    'src/App.tsx',
    'src/App.module.css',
    'src/styles/globals.css',
  ]

  // Check if any scaffold file was modified or new files were created
  const hasChanges =
    files.length !== scaffoldPaths.length ||
    files.some((f) => !scaffoldPaths.includes(f.path))

  // Before any user work — blank screen
  if (!hasChanges) {
    return blankDoc()
  }

  // User has built something — render index.html
  const indexHtml = files.find((f) => f.path === 'index.html')
  if (!indexHtml) {
    return blankDoc()
  }

  let doc = indexHtml.content

  // Inject Babel standalone for JSX transpilation
  if (!doc.includes('babel-standalone')) {
    doc = doc.replace(
      '</head>',
      '<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>\n</head>'
    )
  }

  // Inject React if not already loaded
  if (!doc.includes('esm.sh/react') && !doc.includes('unpkg.com/react')) {
    doc = doc.replace(
      '</head>',
      '<script type="importmap">{"imports":{"react":"https://esm.sh/react@19","react-dom/":"https://esm.sh/react-dom@19/"}}</script>\n</head>'
    )
  }

  // Inject CSS files into <head>
  for (const f of files) {
    if (f.path.endsWith('.css') && !doc.includes(f.path)) {
      doc = doc.replace('</head>', `  <style>/* ${f.path} */\n${f.content}\n</style>\n</head>`)
    }
    // Replace .tsx/.ts script references with text/babel for transpilation
    if ((f.path.endsWith('.tsx') || f.path.endsWith('.ts')) && doc.includes(f.path)) {
      const js = stripTypes(f.content)
      const escapedPath = f.path.replace(/\./g, '\\.')
      // Replace src references
      doc = doc.replace(
        new RegExp(`<script[^>]*src=["']/${escapedPath}["'][^>]*></script>`, 'g'),
        `<script type="text/babel" data-type="module">\n${js}\n</script>`
      )
      // Also replace importmap-style module references
      doc = doc.replace(
        new RegExp(`<script[^>]*src=["']\\./${escapedPath}["'][^>]*></script>`, 'g'),
        `<script type="text/babel" data-type="module">\n${js}\n</script>`
      )
    }
  }

  // Convert remaining type="module" scripts to text/babel if they contain JSX
  // This handles inline scripts that reference React components
  if (files.some((f) => f.path.endsWith('.tsx'))) {
    doc = doc.replace(
      /<script type="module"/g,
      '<script type="text/babel" data-type="module"'
    )
  }

  return doc
}

function blankDoc(): string {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#0b0b0f;margin:0}</style></head><body></body></html>'
}

/** Strip TypeScript type annotations for browser execution */
function stripTypes(code: string): string {
  let out = code
  // Remove type annotations after variable declarations
  out = out.replace(/:\s*[\w<>[\],\s|&{}]+(\s*=\s*)/g, '$1')
  // Remove interface/type declarations
  out = out.replace(/^(export\s+)?(interface|type)\s+\w+[\s\S]*?\{[\s\S]*?\}/gm, '')
  out = out.replace(/^(export\s+)?(interface|type)\s+\w+[\s\S]*?=\s*[\w|&'"[\]]+;/gm, '')
  // Remove return type annotations on functions
  out = out.replace(/(\))\s*:\s*[\w<>[\],\s|&{}]+(\s*\{)/g, '$1$2')
  // Remove generic type parameters
  out = out.replace(/<[\w\s,]+>(?=\s*\()/g, '')
  // Remove import type
  out = out.replace(/import\s+type\s+.*?from\s+['"][^'"]+['"]\s*;?/g, '')
  // Remove satisfies operator
  out = out.replace(/\s+satisfies\s+[\w<>[\],\s|&{}]+/g, '')
  // Remove as const
  out = out.replace(/\s+as\s+const/g, '')
  return out
}

export default function PreviewFrame({ device }: Props) {
  const [blobUrl, setBlobUrl] = useState('')
  const blobUrlRef = useRef('')

  // Build preview HTML as a blob URL for origin isolation
  const updatePreview = useCallback(() => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    const html = buildPreviewSrcDoc()
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    blobUrlRef.current = url
    setBlobUrl(url)
  }, [])

  // Initial render
  useEffect(() => {
    updatePreview()
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [updatePreview])

  // Subscribe to workspace changes
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
            src={blobUrl || 'about:blank'}
            className={styles.iframe}
            title="Website preview"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>
    </div>
  )
}
