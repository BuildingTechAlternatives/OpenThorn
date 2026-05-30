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

  // Render index.html directly — AI is instructed to make it self-contained
  return indexHtml.content
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
