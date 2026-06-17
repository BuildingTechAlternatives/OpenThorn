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

export const db = createClient(cfg.url || '', cfg.anonKey || '', {
  auth: { persistSession: true, autoRefreshToken: true },
})

export const auth = db.auth
export default db
