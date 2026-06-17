// Injected data-layer client for generated apps. Resolves the project's Supabase
// config from a global set by the preview/deploy HTML, so generated code never
// hardcodes keys or calls createClient itself.
//
// Usage in app code:
//   import { db, auth } from '@openthorn/db'
//   const { data } = await db.from('todos').select()
//   await auth.signInWithPassword({ email, password })
import { createClient } from '@supabase/supabase-js'

const cfg = (typeof window !== 'undefined' && window.__OPENTHORN_SUPABASE__) || {}

// Lock used by GoTrueClient to serialize token refreshes. supabase-js defaults to
// the Web Locks API (navigator.locks), but that API is DENIED in an opaque-origin
// context — which is exactly what the preview/runtime-check iframe is (sandboxed
// with allow-scripts but no allow-same-origin). The denied lock rejects during the
// client's async initialize(), surfacing as a fatal "LockManager" error that no app
// code can catch (navigator.locks is a non-configurable getter). We pass a lock that
// uses Web Locks when they actually work and otherwise just runs the callback
// directly — correct in the single-tab sandbox, and a safe (cross-tab coordination
// is best-effort) fallback in real deploys.
async function resilientLock(name, _acquireTimeout, fn) {
  try {
    const locks =
      typeof navigator !== 'undefined' && navigator.locks ? navigator.locks : null
    if (locks && typeof locks.request === 'function') {
      return await locks.request(name, { mode: 'exclusive' }, () => fn())
    }
  } catch {
    // navigator.locks denied (opaque-origin sandbox) — fall through to run directly.
  }
  return fn()
}

export const db = createClient(cfg.url || '', cfg.anonKey || '', {
  auth: { persistSession: true, autoRefreshToken: true, lock: resilientLock },
})

export const auth = db.auth
export default db
