import { useState, useEffect, useRef } from 'react'
import type { Device } from './PreviewPanel'
import { buildPreviewHtml, subscribeToProject } from '../../lib/project'
import styles from './PreviewFrame.module.css'

const deviceWidths: Record<Device, string> = {
  phone: '375px',
  tablet: '768px',
  pc: '100%',
}

interface Props {
  device: Device
}

export default function PreviewFrame({ device }: Props) {
  const [srcDoc, setSrcDoc] = useState(buildPreviewHtml)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    return subscribeToProject(() => {
      setSrcDoc(buildPreviewHtml())
    })
  }, [])

  return (
    <div className={`${styles.wrapper} ${device !== 'pc' ? styles.framed : ''}`}>
      <div
        className={styles.container}
        style={{ width: deviceWidths[device] }}
      >
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
            ref={iframeRef}
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
