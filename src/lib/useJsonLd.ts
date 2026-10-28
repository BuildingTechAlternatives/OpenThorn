import { useEffect } from 'react'

/**
 * Injects a JSON-LD structured data script tag into <head> for the current page.
 * Cleaned up on unmount so navigating away removes stale schema data.
 */
export function useJsonLd(schema: object) {
  const schemaString = JSON.stringify(schema)
  useEffect(() => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = schemaString
    document.head.appendChild(script)
    return () => script.remove()
  }, [schemaString])
}
