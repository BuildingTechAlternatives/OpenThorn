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

function buildPreviewSrcDoc(): string {
  const { files } = getWorkspace()

  const scaffoldPaths = [
    'index.html',
    'package.json',
    'vite.config.js',
    'tailwind.config.js',
    'postcss.config.js',
    'src/index.css',
    'src/main.jsx',
    'src/App.jsx',
  ]

  const hasChanges =
    files.length !== scaffoldPaths.length ||
    files.some((f) => !scaffoldPaths.includes(f.path))

  if (!hasChanges) {
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#0b0b0f;margin:0}</style></head><body></body></html>'
  }

  const indexHtml = files.find((f) => f.path === 'index.html')
  if (!indexHtml) {
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#0b0b0f;display:flex;align-items:center;justify-content:center;height:100vh;color:#888;font-family:system-ui,sans-serif;margin:0}</style></head><body><p>No index.html found</p></body></html>'
  }

  let doc = indexHtml.content

  // Inject React, ReactDOM, Babel CDN scripts into <head>
  if (!doc.includes('babel.min.js')) {
    doc = doc.replace('</head>',
      '<script src="https://unpkg.com/react@19/umd/react.development.js"></script>\n' +
      '<script src="https://unpkg.com/react-dom@19/umd/react-dom.development.js"></script>\n' +
      '<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>\n' +
      '<script src="https://cdn.tailwindcss.com"></script>\n' +
      '</head>'
    )
  }

  // Replace module script references with inline text/babel scripts
  doc = doc.replace(
    /<script\s+type="module"\s+src="([^"]+)"[^>]*><\/script>/g,
    (_, srcPath: string) => {
      const clean = srcPath.replace(/^\/+/, '')
      const file = files.find((f) => f.path === clean)
      if (!file) return _
      // Follow the import chain: main.jsx → App.jsx, etc.
      const allCode = resolveImports(clean, files)
      return `<script type="text/babel">\n${allCode}\n</script>`
    }
  )

  // Also inject CSS files not referenced
  for (const f of files) {
    if (f.path.endsWith('.css') && !doc.includes(f.path)) {
      doc = doc.replace('</head>', `  <style>/* ${f.path} */\n${f.content}\n</style>\n</head>`)
    }
  }

  return doc
}

/** Follow import chain and bundle all JSX into one script */
function resolveImports(entryPath: string, files: { path: string; content: string }[]): string {
  const seen = new Set<string>()
  const result: string[] = []

  function add(path: string) {
    if (seen.has(path)) return
    seen.add(path)
    const file = files.find((f) => f.path === path)
    if (!file) return

    // Strip imports, collect referenced files, then add the rest
    let code = file.content
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*,?\s*)*from\s*['"]([^'"]+)['"]\s*;?/g
    let match
    while ((match = importRegex.exec(file.content)) !== null) {
      const importPath = match[1]
      if (!importPath.startsWith('http') && !importPath.startsWith('https')) {
        // Resolve relative import
        const dir = path.split('/').slice(0, -1).join('/')
        const resolved = resolveRelative(dir, importPath)
        add(resolved)
        code = code.replace(match[0], `/* import ${importPath} */`)
      } else {
        // External import — keep it but convert to script tag (already handled by CDN)
        code = code.replace(match[0], `/* external import: ${importPath} */`)
      }
    }

    // Strip export keywords
    code = code.replace(/^export\s+(default\s+)?/gm, '')
    result.push(`// ${path}\n${code}`)
  }

  add(entryPath)
  return result.join('\n\n')
}

function resolveRelative(dir: string, importPath: string): string {
  if (importPath.startsWith('./')) {
    return dir ? `${dir}/${importPath.slice(2)}` : importPath.slice(2)
  }
  if (importPath.startsWith('../')) {
    const parts = dir.split('/')
    let rel = importPath
    while (rel.startsWith('../')) {
      parts.pop()
      rel = rel.slice(3)
    }
    return [...parts, rel].join('/')
  }
  return importPath
}

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
