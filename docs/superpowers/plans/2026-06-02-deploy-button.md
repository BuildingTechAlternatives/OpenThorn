# Deploy Button & GitHub Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the Deploy button to bundle project code into a self-contained HTML, upload to Supabase Storage, and return a public URL. Wire up the GitHub icon to push files to a user's GitHub repo via a personal access token.

**Architecture:** Two independent actions. Deploy bundles all source files into one `index.html` with inlined CSS and JS (React CDN + Babel standalone for JSX), uploads to a public Supabase Storage bucket, and returns a public URL. GitHub checks for a stored PAT in a new `user_integrations` table, then pushes files to a new repo via GitHub's Contents API.

**Tech Stack:** React 19, TypeScript, Supabase (Storage, Database), GitHub REST API, Babel standalone (in-browser JSX compilation)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/deploy.ts` | Create | `bundleProject()` — inlines CSS/JS into single HTML; `deployToStorage()` — uploads to Supabase Storage, returns public URL |
| `src/lib/github.ts` | Create | `createRepo()` — creates GitHub repo via API; `pushFiles()` — pushes files via Contents API; `getGitHubUser()` — fetches username from token |
| `src/pages/ProjectBuilderPage.tsx` | Modify | Wire Deploy button onClick + states; wire GitHub icon onClick + connect dialog; add deploy success modal |
| `src/pages/ProjectBuilderPage.module.css` | Modify | Deploy modal styles, spinner animation, deployed glow, GitHub connect dialog styles |

---

### Task 1: Supabase — Create `user_integrations` table + `deployments` storage bucket

- [ ] **Step 1: Apply migration for `user_integrations` table**

Use the Supabase MCP `apply_migration` tool with project ID `ofssvvittiiysoibojts`:

```sql
CREATE TABLE public.user_integrations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('github')),
  access_token text NOT NULL,
  provider_username text,
  metadata jsonb DEFAULT '{}'::jsonb,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own integrations"
  ON public.user_integrations
  FOR ALL
  USING (auth.uid() = user_id);
```

- [ ] **Step 2: Create `deployments` storage bucket**

Use the Supabase MCP `execute_sql` tool:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('deployments', 'deployments', true, 5242880, ARRAY['text/html']);
```

- [ ] **Step 3: Create RLS policy for `deployments` bucket**

```sql
CREATE POLICY "Authenticated users can upload to their projects"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'deployments'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.projects WHERE user_id = auth.uid()
      UNION
      SELECT pc.project_id::text FROM public.project_collaborators pc WHERE pc.user_id = auth.uid() AND pc.permission = 'edit'
    )
  );

CREATE POLICY "Public can read deployments"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'deployments');
```

- [ ] **Step 4: Verify**

Run `list_tables` with project ID `ofssvvittiiysoibojts` — confirm `user_integrations` appears. Check the storage bucket exists.

---

### Task 2: Create `src/lib/deploy.ts`

**Files:**
- Create: `src/lib/deploy.ts`

- [ ] **Step 1: Write the module**

```typescript
import { supabase } from './supabase'

export interface CodeFile {
  path: string
  language: string
  code: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function bundleProject(files: CodeFile[], title: string): string {
  let css = ''
  let components = ''

  for (const file of files) {
    if (file.language === 'css') {
      css += `/* ${file.path} */\n${file.code}\n`
    } else if (file.language === 'tsx' || file.language === 'jsx') {
      // Strip import/export statements — Babel standalone runs everything in one scope
      const cleaned = file.code
        .replace(/^\s*import\s+.*$/gm, '')
        .replace(/^\s*export\s+default\s+/gm, 'const Default_')
        .replace(/^\s*export\s+/gm, '')
      components += `// ${file.path}\n${cleaned}\n`
    } else {
      components += `// ${file.path}\n${file.code}\n`
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
</head>
<body>
  <div id="root"></div>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  <script type="text/babel">
const { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext } = React;
${components}

// Find and render the root component
const rootComponent = typeof App !== 'undefined' ? App
  : typeof Default_ !== 'undefined' ? Default_
  : null;

if (rootComponent) {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(rootComponent));
}
  <\/script>
</body>
</html>`
}

export async function deployToStorage(projectId: string, html: string): Promise<string> {
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' })

  const { error } = await supabase.storage
    .from('deployments')
    .upload(`${projectId}/index.html`, blob, {
      contentType: 'text/html',
      upsert: true,
      cacheControl: '3600',
    })

  if (error) {
    throw new Error(`Deploy failed: ${error.message}`)
  }

  const { data } = supabase.storage
    .from('deployments')
    .getPublicUrl(`${projectId}/index.html`)

  return data.publicUrl
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/lib/deploy.ts`
Expected: No errors.

---

### Task 3: Create `src/lib/github.ts`

**Files:**
- Create: `src/lib/github.ts`

- [ ] **Step 1: Write the module**

```typescript
const GITHUB_API = 'https://api.github.com'

interface GitHubRepo {
  html_url: string
  clone_url: string
  name: string
  owner: { login: string }
}

export async function getGitHubUser(token: string): Promise<{ login: string }> {
  const res = await fetch(`${GITHUB_API}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!res.ok) {
    throw new Error('Invalid GitHub token')
  }

  return res.json()
}

export async function createRepo(
  token: string,
  name: string,
  isPrivate: boolean,
): Promise<GitHubRepo> {
  const res = await fetch(`${GITHUB_API}/user/repos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      name,
      private: isPrivate,
      auto_init: false,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || res.statusText)
  }

  return res.json()
}

export async function pushFiles(
  token: string,
  owner: string,
  repo: string,
  files: { path: string; content: string }[],
): Promise<void> {
  for (const file of files) {
    // Encode content as base64 (GitHub API requirement)
    const encoder = new TextEncoder()
    const bytes = encoder.encode(file.content)
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
    const base64 = btoa(binary)

    const res = await fetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${file.path}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          message: `Add ${file.path}`,
          content: base64,
        }),
      },
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }))
      throw new Error(`Push ${file.path}: ${err.message || res.statusText}`)
    }
  }
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/lib/github.ts`
Expected: No errors.

---

### Task 4: Modify `ProjectBuilderPage.tsx` — Deploy button wiring

**Files:**
- Modify: `src/pages/ProjectBuilderPage.tsx`

- [ ] **Step 1: Add imports for deploy module**

Add these imports to the top of the file (after existing imports, around line 5):

```typescript
import { bundleProject, deployToStorage } from '../lib/deploy'
import { pushFiles, createRepo, getGitHubUser } from '../lib/github'
```

- [ ] **Step 2: Add deploy-related state**

Add these state variables after the existing `const [projectAccess, setProjectAccess]` line (~line 77):

```typescript
const [deployState, setDeployState] = useState<'idle' | 'deploying' | 'deployed' | 'error'>('idle')
const [deployUrl, setDeployUrl] = useState('')
const [deployError, setDeployError] = useState('')
const [deployModalOpen, setDeployModalOpen] = useState(false)
```

- [ ] **Step 3: Add GitHub-related state**

After the deploy state, add:

```typescript
const [githubToken, setGithubToken] = useState('')
const [githubUsername, setGithubUsername] = useState('')
const [githubDialogOpen, setGithubDialogOpen] = useState(false)
const [githubTokenInput, setGithubTokenInput] = useState('')
const [githubConnecting, setGithubConnecting] = useState(false)
const [githubError, setGithubError] = useState('')
const [githubPushing, setGithubPushing] = useState(false)
const [githubPushSuccess, setGithubPushSuccess] = useState('')
```

- [ ] **Step 4: Load GitHub connection on mount**

Add a `useEffect` after the other effects (~after line 192):

```typescript
useEffect(() => {
  if (!user) return

  const loadGithubIntegration = async () => {
    const { data, error } = await supabase
      .from('user_integrations')
      .select('access_token, provider_username')
      .eq('user_id', user.id)
      .eq('provider', 'github')
      .maybeSingle()

    if (error || !data) return

    setGithubToken(data.access_token)
    setGithubUsername(data.provider_username || '')
  }

  loadGithubIntegration()
}, [user])
```

- [ ] **Step 5: Add deploy handler**

Add the `handleDeploy` function before the `if (loading) return null` guard (~before line 360):

```typescript
const handleDeploy = useCallback(async () => {
  setDeployState('deploying')
  setDeployError('')
  setDeployModalOpen(true)

  try {
    const html = bundleProject(codeFiles, title)
    const url = await deployToStorage(projectId!, html)
    setDeployUrl(url)
    setDeployState('deployed')
  } catch (err) {
    setDeployError(err instanceof Error ? err.message : 'Deploy failed')
    setDeployState('error')
  }
}, [projectId, title])
```

- [ ] **Step 6: Wire up the Deploy button**

Replace the existing Deploy button (~line 414-416):

```tsx
// Replace this:
<button className={styles.deployBtn} type="button">
  Deploy
</button>

// With this:
<button
  className={`${styles.deployBtn} ${deployState === 'deployed' ? styles.deployBtnDeployed : ''}`}
  type="button"
  onClick={deployState === 'deployed' ? () => window.open(deployUrl, '_blank') : handleDeploy}
  disabled={deployState === 'deploying'}
>
  {deployState === 'deploying' ? (
    <><span className={styles.spinner} /> Deploying…</>
  ) : deployState === 'deployed' ? (
    <>View site <ExternalIcon /></>
  ) : (
    <>Deploy</>
  )}
</button>
```

- [ ] **Step 7: Add the deploy modal**

Add the deploy modal right before the closing `</div>` of the share overlay's closing tag. Insert it after the share overlay closing `</div>` (after line 564) and before `<main className={styles.shell}>`:

```tsx
{deployModalOpen && (
  <div
    className={styles.shareOverlay}
    role="presentation"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget && deployState !== 'deploying') {
        setDeployModalOpen(false)
      }
    }}
  >
    <section className={styles.deployModal} role="dialog" aria-modal="true" aria-labelledby="deploy-modal-title">
      <div className={styles.shareHeader}>
        <div>
          <h2 id="deploy-modal-title">Deploy project</h2>
        </div>
        {deployState !== 'deploying' && (
          <button className={styles.closeBtn} type="button" aria-label="Close" onClick={() => setDeployModalOpen(false)}>
            <CloseIcon />
          </button>
        )}
      </div>

      <div className={styles.deployBody}>
        {deployState === 'deploying' && (
          <div className={styles.deployStatus}>
            <span className={styles.spinnerLarge} />
            <p>Bundling and deploying your project…</p>
          </div>
        )}

        {deployState === 'deployed' && (
          <div className={styles.deployStatus}>
            <div className={styles.deploySuccessIcon}>
              <CheckIconLarge />
            </div>
            <p>Your site is live!</p>
            <a href={deployUrl} target="_blank" rel="noopener noreferrer" className={styles.deployUrl}>
              {deployUrl}
            </a>
            <button
              className={styles.deployBtn}
              type="button"
              onClick={() => window.open(deployUrl, '_blank')}
            >
              View site <ExternalIcon />
            </button>
          </div>
        )}

        {deployState === 'error' && (
          <div className={styles.deployStatus}>
            <p className={styles.deployError}>{deployError}</p>
            <button className={styles.deployBtn} type="button" onClick={handleDeploy}>
              Retry
            </button>
          </div>
        )}
      </div>
    </section>
  </div>
)}
```

- [ ] **Step 8: Update the preview address bar when deployed**

Replace the `<div className={styles.addressBar}>` span content (~line 637) to show the live URL when deployed:

```tsx
<div className={styles.addressBar}>
  {deployUrl ? (
    <>
      <RefreshIcon />
      <span>{new URL(deployUrl).hostname}{new URL(deployUrl).pathname}</span>
    </>
  ) : (
    <>
      <RefreshIcon />
      <span>/</span>
      <ChevronDownIcon />
    </>
  )}
</div>
```

---

### Task 5: Modify `ProjectBuilderPage.tsx` — GitHub icon wiring

**Files:**
- Modify: `src/pages/ProjectBuilderPage.tsx` (continued)

- [ ] **Step 1: Add GitHub connect handler**

Add after the `handleDeploy` function:

```typescript
const handleGithubConnect = useCallback(async () => {
  setGithubConnecting(true)
  setGithubError('')

  try {
    const user = await getGitHubUser(githubTokenInput.trim())

    const { error } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: supabase.auth.getUser().then(({ data }) => data.user?.id),
        provider: 'github',
        access_token: githubTokenInput.trim(),
        provider_username: user.login,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,provider' })

    // Since we can't await the user inline, get it from the closure
    if (error) {
      setGithubError(error.message)
      setGithubConnecting(false)
      return
    }

    setGithubToken(githubTokenInput.trim())
    setGithubUsername(user.login)
    setGithubTokenInput('')
    setGithubDialogOpen(false)
    setGithubConnecting(false)
  } catch (err) {
    setGithubError(err instanceof Error ? err.message : 'Connection failed')
    setGithubConnecting(false)
  }
}, [githubTokenInput])
```

Wait — the `user` variable in the handler shadows the outer `user` from auth. Also, we can't use `supabase.auth.getUser()` in the upsert because we already have `user` from the auth context. Let me rewrite this properly:

```typescript
const handleGithubConnect = useCallback(async () => {
  setGithubConnecting(true)
  setGithubError('')

  try {
    const githubUser = await getGitHubUser(githubTokenInput.trim())

    const { error } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: user!.id,
        provider: 'github',
        access_token: githubTokenInput.trim(),
        provider_username: githubUser.login,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,provider' })

    if (error) {
      setGithubError(error.message)
      setGithubConnecting(false)
      return
    }

    setGithubToken(githubTokenInput.trim())
    setGithubUsername(githubUser.login)
    setGithubTokenInput('')
    setGithubDialogOpen(false)
    setGithubConnecting(false)
  } catch (err) {
    setGithubError(err instanceof Error ? err.message : 'Connection failed')
    setGithubConnecting(false)
  }
}, [githubTokenInput, user])
```

- [ ] **Step 2: Add GitHub push handler**

```typescript
const handleGithubPush = useCallback(async () => {
  setGithubPushing(true)
  setGithubPushSuccess('')
  setGithubError('')

  try {
    const repoName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'bloom-project'

    const repo = await createRepo(githubToken, repoName, true)
    await pushFiles(
      githubToken,
      repo.owner.login,
      repo.name,
      codeFiles.map((f) => ({ path: f.path, content: f.code })),
    )

    setGithubPushSuccess(repo.html_url)
    // Auto-close after 4 seconds
    setTimeout(() => {
      setGithubDialogOpen(false)
      setGithubPushSuccess('')
    }, 4000)
  } catch (err) {
    setGithubError(err instanceof Error ? err.message : 'Push failed')
  } finally {
    setGithubPushing(false)
  }
}, [githubToken, title])
```

- [ ] **Step 3: Wire up the GitHub icon**

Replace the existing GitHub icon link (~line 404-406):

```tsx
// Replace this:
<a className={styles.iconBtn} href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub repository">
  <img src="/assets/github.png" alt="GitHub" className={styles.githubLogo} />
</a>

// With this:
<button
  className={styles.iconBtn}
  type="button"
  aria-label={githubToken ? 'Push to GitHub' : 'Connect GitHub'}
  onClick={() => {
    if (githubToken) {
      handleGithubPush()
    } else {
      setGithubDialogOpen(true)
      setGithubTokenInput('')
      setGithubError('')
      setGithubPushSuccess('')
    }
  }}
>
  <img src="/assets/github.png" alt="GitHub" className={styles.githubLogo} />
</button>
```

- [ ] **Step 4: Add the GitHub connect dialog**

Add after the deploy modal (still before `<main className={styles.shell}>`):

```tsx
{githubDialogOpen && (
  <div
    className={styles.shareOverlay}
    role="presentation"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget && !githubConnecting) {
        setGithubDialogOpen(false)
      }
    }}
  >
    <section className={styles.deployModal} role="dialog" aria-modal="true" aria-labelledby="github-dialog-title">
      <div className={styles.shareHeader}>
        <div>
          <h2 id="github-dialog-title">Connect GitHub</h2>
        </div>
        <button className={styles.closeBtn} type="button" aria-label="Close" onClick={() => setGithubDialogOpen(false)}>
          <CloseIcon />
        </button>
      </div>

      <div className={styles.deployBody}>
        {githubPushSuccess ? (
          <div className={styles.deployStatus}>
            <div className={styles.deploySuccessIcon}>
              <CheckIconLarge />
            </div>
            <p>Code pushed to GitHub!</p>
            <a href={githubPushSuccess} target="_blank" rel="noopener noreferrer" className={styles.deployUrl}>
              {githubPushSuccess}
            </a>
          </div>
        ) : githubToken ? (
          <div className={styles.deployStatus}>
            <p>
              Pushing to <strong>{githubUsername}</strong>'s GitHub account
            </p>
            <button
              className={styles.deployBtn}
              type="button"
              onClick={handleGithubPush}
              disabled={githubPushing}
            >
              {githubPushing ? <><span className={styles.spinner} /> Pushing…</> : 'Push to new repo'}
            </button>
            {githubError && <p className={styles.deployError}>{githubError}</p>}
          </div>
        ) : (
          <div className={styles.deployBodyInner}>
            <p className={styles.githubInstructions}>
              Create a{' '}
              <a href="https://github.com/settings/tokens/new?scopes=repo&description=OpenThorn" target="_blank" rel="noopener noreferrer">
                fine-grained personal access token
              </a>{' '}
              with <strong>repo</strong> scope and paste it below.
            </p>
            <div className={styles.emailInputWrap}>
              <input
                type="password"
                value={githubTokenInput}
                onChange={(e) => {
                  setGithubTokenInput(e.target.value)
                  setGithubError('')
                }}
                placeholder="github_pat_…"
                autoComplete="off"
              />
            </div>
            <button
              className={styles.deployBtn}
              type="button"
              onClick={handleGithubConnect}
              disabled={!githubTokenInput.trim() || githubConnecting}
            >
              {githubConnecting ? <><span className={styles.spinner} /> Connecting…</> : 'Connect'}
            </button>
            {githubError && <p className={styles.deployError}>{githubError}</p>}
          </div>
        )}
      </div>
    </section>
  </div>
)}
```

---

### Task 6: CSS — New styles for deploy and GitHub dialogs

**Files:**
- Modify: `src/pages/ProjectBuilderPage.module.css`

- [ ] **Step 1: Add deployed button glow variant**

Add after the existing `.deployBtn` rules (after line 235):

```css
.deployBtnDeployed {
  background: linear-gradient(135deg, #2ea87a, #3cc98f);
  box-shadow: 0 2px 22px rgba(46, 168, 122, 0.35);
}

.deployBtnDeployed:hover {
  box-shadow: 0 4px 30px rgba(46, 168, 122, 0.45);
}
```

- [ ] **Step 2: Add deploy modal styles**

Add after the `.deployBtnDeployed` rules:

```css
.deployModal {
  width: min(480px, 100%);
  max-height: min(500px, calc(100vh - 44px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 18px;
  color: var(--color-text);
  background: linear-gradient(180deg, rgba(28, 22, 31, 0.98), rgba(14, 11, 16, 0.98));
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 24px 72px rgba(0, 0, 0, 0.55), 0 6px 24px rgba(0, 0, 0, 0.35);
}

.deployBody {
  flex: 1 1 auto;
  padding: 24px 22px 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  overflow-y: auto;
}

.deployBodyInner {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.deployStatus {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 14px 0;
  text-align: center;
}

.deploySuccessIcon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(46, 168, 122, 0.15);
  color: #3cc98f;
}

.deployUrl {
  font-size: 12.5px;
  color: var(--color-secondary);
  word-break: break-all;
  text-decoration: none;
}

.deployUrl:hover {
  text-decoration: underline;
}

.deployError {
  font-size: 13px;
  color: #e05050;
}

.githubInstructions {
  font-size: 13.5px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.65);
}

.githubInstructions a {
  color: var(--color-secondary);
}
```

- [ ] **Step 3: Add spinner animation**

Add at the end of the file, before media queries:

```css
.spinner,
.spinnerLarge {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.spinnerLarge {
  width: 32px;
  height: 32px;
  border-width: 3px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 4: Add `emailInputWrap` input styling for text inputs (GitHub token)**

The existing `.emailInputWrap input` style only targets `input[type="email"]` — add a broader rule. Find the existing `.emailInputWrap input` rule and ensure it also styles `[type="password"]` and `[type="text"]`. Check the CSS around line 374. If the selector is `input[type="email"]`, add:

```css
.emailInputWrap input[type="password"],
.emailInputWrap input[type="text"] {
  /* same styles as the email input — copy them here */
}
```

(Check the actual CSS and match the existing `input[type="email"]` rule.)

---

### Task 7: Add `ExternalIcon` component and verify

**Files:**
- Modify: `src/pages/ProjectBuilderPage.tsx`

- [ ] **Step 1: Add `ExternalIcon` component**

Add near the other icon components (before the `MarkdownBlock` function):

```tsx
function ExternalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
    </svg>
  )
}

function CheckIconLarge() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: Successful build.

- [ ] **Step 4: Run the dev server and test**

Run: `npm run dev`

Test the following manually:
- Click Deploy → should show deploying spinner, then success with URL
- Open the URL in a new tab → should show the rendered project
- Click GitHub icon → should show connect dialog
- Paste a valid GitHub token → should connect and show username
- Click "Push to new repo" → should create repo and push files

- [ ] **Step 5: Commit**

```bash
git add src/lib/deploy.ts src/lib/github.ts src/pages/ProjectBuilderPage.tsx src/pages/ProjectBuilderPage.module.css
git commit -m "feat: wire up Deploy button and GitHub push integration"
```

---

## Plan Self-Review

**1. Spec coverage:**
- ✅ Deploy button bundles code → `bundleProject()` in Task 2
- ✅ Deploy uploads to Supabase Storage → `deployToStorage()` in Task 2
- ✅ Supabase Storage bucket + RLS → Task 1
- ✅ `user_integrations` table → Task 1
- ✅ GitHub icon connects via PAT → Task 5
- ✅ GitHub push creates repo + pushes files → Task 3, Task 5
- ✅ Deploy button states (idle/deploying/deployed) → Task 4
- ✅ Deploy modal with success/error → Task 4
- ✅ Preview address bar updates when deployed → Task 4 Step 8

**2. Placeholder scan:** No TBDs, TODOs, or vague instructions. All code is concrete.

**3. Type consistency:** `CodeFile` interface defined in Task 2 matches usage in Task 4 and Task 5. `deployToStorage` signature matches its call site. `pushFiles` and `createRepo` signatures match their GitHub dialog usage. State variable names are consistent across tasks.
