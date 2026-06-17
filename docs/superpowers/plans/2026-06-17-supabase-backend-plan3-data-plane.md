# Supabase Backend — Plan 3: Generated-App Data Plane

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make generated apps actually read/write data and authenticate users — in both the in-browser preview and the deployed site — against the project's connected Supabase, via a single injected client.

**Architecture:** Add `@supabase/supabase-js` to the esm.sh allowlist and ship a tiny `@openthorn/db` module (data-URL in the import map, mirroring the existing router injection) that calls `createClient` using a `window.__OPENTHORN_SUPABASE__` config global. `buildPreview` injects that global + the two import-map entries when a backend config is passed; the builder passes the project's public `supabase_url`/`anon_key` for both preview and deploy. The agent guidance is upgraded to tell it to use `import { db, auth } from '@openthorn/db'`.

**Tech Stack:** esbuild-wasm bundling, esm.sh, import maps, `@supabase/supabase-js` v2, sandboxed `srcdoc` iframe.

**Spec:** `docs/superpowers/specs/2026-06-17-supabase-backend-generation-design.md` (§5).

**Depends on:** Plan 1 (connection: `project_backends.supabase_url`/`supabase_anon_key`) and Plan 2 (`set_schema`).

**Key correction vs spec:** the spec named the client module `openthorn:db`, but `virtualFsPlugin.cleanPath` strips a `namespace:` prefix (it would become `db`). Use the colon-free specifier **`@openthorn/db`** so it stays a bare specifier resolved by the import map.

**Scope note (verification):** v1 ships the data plane + a **light** preview check (the client initializes and the app renders without a wiring error). The full seeded "preview test user" CRUD round-trip from the spec is deferred to a follow-up (Plan 3b) — it adds per-project test-user provisioning/cleanup and is a quality gate, not a user capability. Flagged so it isn't silently dropped.

---

## File Structure

- **Create** `public/openthorn-db.js` — the `@openthorn/db` client source (raw-imported, like `openthorn-router.js`).
- **Modify** `src/lib/allowed-packages.ts` — add `@supabase/supabase-js`.
- **Modify** `src/lib/preview-bundle.ts` — `backend` option on `buildPreview`; inject config global + import-map entries.
- **Modify** `src/pages/ProjectBuilderPage.tsx` — fetch `supabase_url`/`anon_key`; pass `backend` to both `buildPreview` calls.
- **Modify** `src/lib/agent-prompt.ts` — upgrade `BACKEND_APPS_REMINDER` to instruct using `@openthorn/db` + auth.
- **Modify** `src/lib/agent.ts` — `set_schema` result message points at `@openthorn/db`.
- **Test** `src/lib/__tests__/preview-bundle.test.ts`.

---

### Task P3.1: esm.sh allowlist + the `@openthorn/db` client source

**Files:**
- Modify: `src/lib/allowed-packages.ts`
- Create: `public/openthorn-db.js`

- [ ] **Step 1: Add supabase-js to `ALLOWED_PACKAGES`** (after an existing entry)

```ts
{
  name: '@supabase/supabase-js',
  url: 'https://esm.sh/@supabase/supabase-js@2.45.4',
  description: 'Supabase client (database + auth). Prefer the injected `@openthorn/db` over importing this directly.',
},
```

- [ ] **Step 2: Create `public/openthorn-db.js`**

```js
// Injected client for generated apps. Resolves the project's Supabase config from
// a global set by the preview/deploy HTML, so generated code never hardcodes keys.
// Usage in app code: import { db, auth } from '@openthorn/db'
import { createClient } from '@supabase/supabase-js'

const cfg = (typeof window !== 'undefined' && window.__OPENTHORN_SUPABASE__) || {}

export const db = createClient(cfg.url || '', cfg.anonKey || '', {
  auth: { persistSession: true, autoRefreshToken: true },
})
export const auth = db.auth
export default db
```

- [ ] **Step 3: Sanity check**

Run: `npx tsc -b` → EXIT 0 (the `.js` file isn't typechecked; this just confirms the allowlist edit compiles).

- [ ] **Step 4: Commit**

```bash
git add src/lib/allowed-packages.ts public/openthorn-db.js
git commit -m "feat(backend): supabase-js allowlist + @openthorn/db client source"
```

---

### Task P3.2: Inject the client + config into preview & deploy HTML

**Files:**
- Modify: `src/lib/preview-bundle.ts`
- Test: `src/lib/__tests__/preview-bundle.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { buildPreview } from '../preview-bundle'

const esbuildStub = {
  build: async () => ({
    errors: [], warnings: [],
    outputFiles: [{ path: 'out.js', text: 'console.log("app")' }],
  }),
} as unknown as Parameters<typeof buildPreview>[1]

describe('buildPreview backend injection', () => {
  it('omits the Supabase config + db import-map entry when no backend', async () => {
    const { html } = await buildPreview([{ path: '/src/App.tsx', content: 'export default () => null' }], esbuildStub)
    expect(html).not.toContain('__OPENTHORN_SUPABASE__')
    expect(html).not.toContain('@openthorn/db')
  })

  it('injects the config global + @openthorn/db + supabase-js when a backend is given', async () => {
    const { html } = await buildPreview(
      [{ path: '/src/App.tsx', content: 'export default () => null' }],
      esbuildStub,
      { backend: { url: 'https://ref1.supabase.co', anonKey: 'anon-123' } },
    )
    expect(html).toContain('__OPENTHORN_SUPABASE__')
    expect(html).toContain('https://ref1.supabase.co')
    expect(html).toContain('anon-123')
    expect(html).toContain('@openthorn/db')
    expect(html).toContain('@supabase/supabase-js')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/preview-bundle.test.ts -t "backend injection"`
Expected: FAIL — `buildPreview` ignores the 3rd arg's `backend`.

- [ ] **Step 3: Implement** in `src/lib/preview-bundle.ts`

Add a raw import near the router import:
```ts
import openthornDbSource from '../../public/openthorn-db.js?raw'
```

Extend `BuildPreviewOptions`:
```ts
export interface BuildPreviewOptions {
  instrument?: boolean
  /** When set, injects the Supabase client config + @openthorn/db module. */
  backend?: { url: string; anonKey: string }
}
```

Change `getImportMap` to accept the backend flag and add the two entries:
```ts
function getImportMap(instrument = false, hasBackend = false): Record<string, string> {
  // ... existing map ...
  if (hasBackend) {
    map['@openthorn/db'] = 'data:text/javascript;base64,' + toBase64(openthornDbSource)
  }
  return map
}
```
(`@supabase/supabase-js` comes from `ALLOWED_PACKAGES`, already added in the loop.)

In `buildPreview`, thread the flag and build the config global:
```ts
  const importMap = JSON.stringify({ imports: getImportMap(opts.instrument, Boolean(opts.backend)) }, null, 2)

  const backendConfig = opts.backend
    ? `<script>window.__OPENTHORN_SUPABASE__=${JSON.stringify({ url: opts.backend.url, anonKey: opts.backend.anonKey })
        .replace(/</g, '\\u003c')};</script>`
    : ''
```
Insert `${backendConfig}` into the `<head>` (before the module script — e.g. right after the import map `<script>` or alongside `storagePolyfill`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/preview-bundle.test.ts -t "backend injection"`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the whole preview-bundle suite (no regressions)**

Run: `npx vitest run src/lib/__tests__/preview-bundle.test.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/preview-bundle.ts src/lib/__tests__/preview-bundle.test.ts
git commit -m "feat(backend): inject Supabase config + @openthorn/db into preview/deploy"
```

---

### Task P3.3: Thread the backend config from the builder

**Files:**
- Modify: `src/pages/ProjectBuilderPage.tsx`

- [ ] **Step 1: Fetch the public config alongside the connected flag.** Replace the existing
  `project_backends` status effect so it also captures url + anon key:

```tsx
  const [backendConfig, setBackendConfig] = useState<{ url: string; anonKey: string } | null>(null)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    supabase
      .from('project_backends')
      .select('supabase_url, supabase_anon_key')
      .eq('project_id', projectId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setBackendConnected(Boolean(data))
        setBackendConfig(data ? { url: data.supabase_url, anonKey: data.supabase_anon_key } : null)
      })
    return () => { cancelled = true }
  }, [projectId])
```

(Keep `setBackendConnected` updates from the modal's `onStatusChange`; when it flips to connected the effect won't refire, so in `onStatusChange` also re-query — simplest: pass a callback that re-runs this fetch. For v1, set both in `onStatusChange` by re-selecting; or accept that a full connect requires the existing post-OAuth reload. Document inline.)

- [ ] **Step 2: Pass `backend` into both `buildPreview` calls.** Live preview build and the
  `handleDeploy` build both gain a 3rd arg:

```tsx
      const result = await buildPreview(
        projectFiles.map((f) => ({ path: f.path, content: f.code })),
        undefined,
        backendConfig ? { backend: backendConfig } : undefined,
      )
```

(Apply to every `buildPreview(` call site in this file — find them all.)

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc -b` → EXIT 0.
```bash
git add src/pages/ProjectBuilderPage.tsx
git commit -m "feat(backend): pass project Supabase config into preview + deploy builds"
```

---

### Task P3.4: Upgrade agent guidance to use the client

**Files:**
- Modify: `src/lib/agent-prompt.ts`
- Modify: `src/lib/agent.ts`

- [ ] **Step 1: Rewrite `BACKEND_APPS_REMINDER`** so it now tells the agent the client exists:

```ts
export const BACKEND_APPS_REMINDER = `<system-reminder>
A Supabase backend is connected, so you can build a real app with saved data and user accounts.
- Schema: declare tables with the set_schema tool (RLS is automatic; id, user_id, and created_at are added to every table — don't declare them). access per table: "owner" (row private to creator), "public_read" (everyone reads, owner writes), "authenticated" (signed-in users read, owner writes).
- Data + auth in the app: import the ready-made client — \`import { db, auth } from '@openthorn/db'\`. Query with \`db.from('todos').select()\`, \`db.from('todos').insert({ title })\`, etc. (do NOT pass user_id — it defaults to the signed-in user). Auth: \`auth.signUp({ email, password })\`, \`auth.signInWithPassword(...)\`, \`auth.signOut()\`, and \`auth.onAuthStateChange(cb)\`. Build real sign-up / sign-in / sign-out UI and show a signed-out state when there's no session. Never hardcode Supabase keys or call createClient yourself — always use @openthorn/db.
Call set_schema before writing code that queries a table.
</system-reminder>`
```

- [ ] **Step 2: Update the `set_schema` tool result** in `agent.ts` (the success `content`) to end with:

```ts
          `${head}\n\nTypeScript types for your tables:\n\n${result.types}\n\n` +
          "Use the data client in your app: import { db, auth } from '@openthorn/db'. Example: const { data } = await db.from('todos').select(). Build sign-in/up UI with auth.signInWithPassword / auth.signUp.",
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc -b` → EXIT 0.
```bash
git add src/lib/agent-prompt.ts src/lib/agent.ts
git commit -m "feat(agent): guide the agent to use @openthorn/db for data + auth"
```

---

### Task P3.5: Light preview verification (client init)

**Files:**
- Modify: `src/lib/preview-runtime-check.ts`

- [ ] **Step 1: Inspect `preview-runtime-check.ts`** to see how it reports runtime errors from the
  iframe. The goal: an app importing `@openthorn/db` must not throw at module load (createClient
  with a real url/anonKey succeeds; the existing runtime check already catches uncaught errors).

- [ ] **Step 2: Confirm coverage, add a targeted note/test if the check needs it.** In most cases
  no code change is required — the existing runtime smoke test already fails the compile if the
  injected client throws on load. If a gap exists (e.g. supabase-js needs a global like `process`),
  add the minimal polyfill to the preview HTML head (mirror the `storagePolyfill` pattern):

```js
// Some esm.sh builds reference process.env; provide a stub so module load doesn't throw.
window.process = window.process || { env: {} };
```

- [ ] **Step 3: Manual confirmation** during Task P3.6 (a generated app that imports `@openthorn/db`
  compiles + renders without runtime error). Commit any polyfill added:

```bash
git add src/lib/preview-bundle.ts
git commit -m "fix(backend): process.env stub so supabase-js loads in the sandbox"
```

(Full seeded-test-user CRUD round-trip is deferred to Plan 3b.)

---

### Task P3.6: Full verification + manual smoke test

- [ ] **Step 1: Automated suite**

Run: `npm run test && npm run lint && npx tsc -b`
Expected: all pass.

- [ ] **Step 2: Manual smoke test** (connected backend; restart dev server first)

In a project with a connected backend that already has the `todos` table, prompt:
"build a todo app: sign up / log in, then add todos with a title, list them, and toggle done."
Confirm:
- Agent calls `set_schema` (no-op if already applied), imports `@openthorn/db`, builds auth + list UI.
- Preview renders; signing up creates a user (check Supabase Auth), adding a todo writes a row
  scoped to that user (verify via MCP that the row's `user_id` matches).
- Deploy the site; the deployed page talks to the same Supabase and persists across reloads.

- [ ] **Step 3: Finish** — use the finishing-a-development-branch skill.

---

## Self-Review notes

- **Spec §5 coverage:** `@supabase/supabase-js` in allowlist (P3.1), config-global injection into preview+deploy (P3.2/P3.3), `@openthorn/db` virtual client via import-map data URL (P3.1/P3.2), `persistSession: true` with the sandbox localStorage polyfill already present (P3.1), auth UX guidance (P3.4). ✓
- **Corrections vs spec:** module specifier is `@openthorn/db` (not `openthorn:db`) due to `cleanPath`. Verification is the light client-init check; the seeded-test-user CRUD round-trip is explicitly deferred to Plan 3b (documented, not dropped).
- **Type consistency:** `BuildPreviewOptions.backend: { url, anonKey }` matches the `{ url, anonKey }` shape passed from `ProjectBuilderPage` and stored in `backendConfig`.
- **Security:** only the public `supabase_url` + `anon_key` reach the client/deploy (RLS is the boundary); the config global is JSON-escaped (`<` → `<`) to prevent script-tag breakout.
```
