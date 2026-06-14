import html2canvas from 'html2canvas'

const CAPTURE_WIDTH = 1280
const CAPTURE_HEIGHT = 800

export async function capturePreviewThumbnail(html: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${CAPTURE_WIDTH}px;height:${CAPTURE_HEIGHT}px;border:none;opacity:0;pointer-events:none;`
    // allow-same-origin lets us read iframe.contentDocument for html2canvas
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin')
    document.body.appendChild(iframe)

    const cleanup = () => {
      try { document.body.removeChild(iframe) } catch { /* already removed */ }
    }

    const timeout = setTimeout(() => {
      cleanup()
      resolve(null)
    }, 20000)

    iframe.onload = async () => {
      // Give React time to mount and render components
      await new Promise((r) => setTimeout(r, 2500))

      try {
        const canvas = await html2canvas(iframe.contentDocument!.documentElement, {
          width: CAPTURE_WIDTH,
          height: CAPTURE_HEIGHT,
          scale: 0.5,
          useCORS: true,
          allowTaint: true,
          logging: false,
          windowWidth: CAPTURE_WIDTH,
          windowHeight: CAPTURE_HEIGHT,
        })
        clearTimeout(timeout)
        canvas.toBlob(
          (blob) => {
            cleanup()
            resolve(blob)
          },
          'image/png',
        )
      } catch (err) {
        console.warn('Preview screenshot failed:', err)
        clearTimeout(timeout)
        cleanup()
        resolve(null)
      }
    }

    iframe.srcdoc = html
  })
}
