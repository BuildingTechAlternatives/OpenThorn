/**
 * Browser capability detection for the Bloom preview system.
 *
 * Determines whether the browser can run WebContainers (requires
 * SharedArrayBuffer, which needs COOP/COEP headers) or should fall
 * back to in-browser transpilation.
 */

/**
 * Test whether SharedArrayBuffer is functional in this browser.
 * WebContainers requires SAB for its WASM threading.
 * SAB construction throws TypeError when COOP/COEP headers are missing.
 */
export function hasSharedArrayBuffer(): boolean {
  try {
    if (typeof SharedArrayBuffer === 'undefined') return false
    new SharedArrayBuffer(1)
    return true
  } catch {
    return false
  }
}

export type PreviewCapability = 'webcontainer' | 'transpiler'

let _cached: PreviewCapability | null = null

/**
 * Detect which preview backend to use.
 * Result is cached — capability doesn't change during a session.
 */
export function detectCapability(): PreviewCapability {
  if (_cached !== null) return _cached

  if (hasSharedArrayBuffer()) {
    _cached = 'webcontainer'
    return _cached
  }

  _cached = 'transpiler'
  return _cached
}
