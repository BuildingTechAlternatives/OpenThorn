import { useState, useEffect } from 'react'
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
 * For React/TSX projects (no webcontainer yet), shows a file listing.
 * For HTML projects, renders the HTML directly.
 */
function buildPreviewSrcDoc(): string {
  const { files } = getWorkspace()

  // If there's an index.html, render it directly (classic website mode)
  const indexHtml = files.find((f) => f.path === 'index.html')
  if (indexHtml) {
    // Check if this is a Vite/React project (has src/main.tsx)
    const hasMainTsx = files.some((f) => f.path === 'src/main.tsx')
    if (!hasMainTsx) {
      // Plain HTML project — render directly
      let doc = indexHtml.content
      // Inject CSS files
      for (const f of files) {
        if (f.path.endsWith('.css') && !doc.includes(f.path)) {
          doc = doc.replace('</head>', `<style>/* ${f.path} */\n${f.content}</style>\n</head>`)
        }
      }
      return doc
    }
  }

  // React/TypeScript project — show the file overview in a nice preview
  const configPaths = new Set([
    'package.json',
    'tsconfig.json',
    'vite.config.ts',
    'index.html',
  ])
  const configFiles = files.filter((f) => configPaths.has(f.path))
  const componentFiles = files.filter(
    (f) =>
      (f.path.endsWith('.tsx') || f.path.endsWith('.ts')) &&
      !configPaths.has(f.path)
  )
  const styleFiles = files.filter((f) => f.path.endsWith('.css'))
  const otherFiles = files.filter(
    (f) =>
      !componentFiles.includes(f) &&
      !styleFiles.includes(f) &&
      !configFiles.includes(f)
  )

  const fileList = (list: typeof files, label: string) =>
    list.length > 0
      ? `<div class="section"><h3>${label}</h3>${list
          .map(
            (f) =>
              `<div class="file"><span class="dot"></span>${f.path} <span class="size">${(f.content.length / 1024).toFixed(1)} KB</span></div>`
          )
          .join('')}</div>`
      : ''

  const componentCount = componentFiles.length + otherFiles.filter(f => f.path.endsWith('.tsx') || f.path.endsWith('.ts')).length

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0b0b0f;
    color: #d4d4d8;
    font-family: system-ui, -apple-system, sans-serif;
    padding: 32px;
    min-height: 100vh;
  }
  .header {
    margin-bottom: 28px;
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  h1 {
    font-size: 18px;
    font-weight: 600;
    color: #e8e8ed;
    margin-bottom: 4px;
  }
  .subtitle {
    font-size: 13px;
    color: #888;
  }
  .stats {
    display: flex;
    gap: 20px;
    margin-top: 12px;
  }
  .stat {
    font-size: 12px;
    color: #888;
  }
  .stat strong {
    color: #4f8fff;
    font-weight: 600;
  }
  .section {
    margin-bottom: 20px;
  }
  h3 {
    font-size: 11px;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 8px;
  }
  .file {
    font-family: 'Fira Code', 'Cascadia Code', monospace;
    font-size: 12px;
    padding: 4px 0;
    color: #b0b0b8;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #4f8fff;
    flex-shrink: 0;
  }
  .css .dot { background: #f59e0b; }
  .config .dot { background: #6b7280; }
  .size {
    font-size: 10px;
    color: #555;
    margin-left: auto;
  }
  .empty {
    font-size: 12px;
    color: #555;
    font-style: italic;
    padding: 8px 0;
  }
  .footer {
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,0.04);
    font-size: 11px;
    color: #444;
  }
</style>
</head>
<body>
<div class="header">
  <h1>${indexHtml ? 'React + TypeScript Project' : 'Empty Project'}</h1>
  <p class="subtitle">${files.length} files — preview not available for React projects yet. Click <strong>Code</strong> to view source.</p>
  <div class="stats">
    <div class="stat"><strong>${files.length}</strong> files</div>
    <div class="stat"><strong>${componentCount}</strong> components</div>
    <div class="stat"><strong>${styleFiles.length}</strong> stylesheets</div>
  </div>
</div>
${fileList(configFiles, 'Config')}
${fileList(componentFiles, 'Components')}
${fileList(styleFiles, 'Styles')}
${fileList(otherFiles.filter(f => !configFiles.includes(f)), 'Other')}
<div class="footer">Preview powered by Bloom — WebContainer support coming soon</div>
</body>
</html>`
}

export default function PreviewFrame({ device }: Props) {
  const [srcDoc, setSrcDoc] = useState(buildPreviewSrcDoc)

  useEffect(() => {
    return subscribeToWorkspace(() => {
      setSrcDoc(buildPreviewSrcDoc())
    })
  }, [])

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
