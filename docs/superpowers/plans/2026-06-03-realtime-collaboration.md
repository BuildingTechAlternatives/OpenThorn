# Real-time Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken share/invite system and add full real-time collaboration — presence indicators, live file/chat sync, and a cross-collaborator prompt queue.

**Architecture:** A `profiles` public table (mirror of `auth.users`, populated by trigger) fixes email lookup. A `useCollaboration` hook manages a per-project Supabase Realtime channel for presence and Postgres Changes. A `generating` column on `projects` coordinates the prompt queue across clients.

**Tech Stack:** React, TypeScript, Supabase (Postgres, Realtime, RLS), Vitest

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `supabase/migrations/20260603000000_profiles_and_collaboration.sql` | CREATE | All DB schema changes |
| `src/lib/useCollaboration.ts` | CREATE | Realtime channel: presence + Postgres Changes |
| `src/lib/__tests__/collaboration.test.ts` | CREATE | Unit tests for pure functions in useCollaboration |
| `src/pages/ProjectBuilderPage.tsx` | MODIFY | Wire hook, fix invite, generating coordination, presence UI |
| `src/pages/DashboardPage.tsx` | MODIFY | Fetch shared projects + second realtime channel |
| `src/components/DashboardSidebar/DashboardSidebar.tsx` | MODIFY | "Shared with me" filter |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260603000000_profiles_and_collaboration.sql`

- [ ] **Step 1: Check existing RLS policies on `projects` and `project_collaborators`**

Run this SQL via the Supabase MCP `execute_sql` tool (project ID: `ofssvvittiiysoibojts`):

```sql
select schemaname, tablename, policyname, cmd, qual
from pg_policies
where tablename in ('projects', 'project_collaborators', 'profiles')
order by tablename, policyname;
```

Review the output. Note any existing policy names — the migration drops them by name before recreating.

- [ ] **Step 2: Create the migration file**

Save to `supabase/migrations/20260603000000_profiles_and_collaboration.sql`:

```sql
-- ============================================================
-- 1. profiles table
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  avatar_url text
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- ============================================================
-- 2. Trigger: populate profiles on every new signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 3. Backfill existing users into profiles
-- ============================================================
insert into public.profiles (id, email, full_name, avatar_url)
select
  id,
  email,
  raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'avatar_url'
from auth.users
on conflict (id) do nothing;

-- ============================================================
-- 4. Add generating columns to projects
-- ============================================================
alter table public.projects
  add column if not exists generating boolean not null default false,
  add column if not exists generating_by uuid references auth.users(id) on delete set null;

-- ============================================================
-- 5. Fix project_collaborators.user_id FK (idempotent)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'project_collaborators_user_id_fkey'
      and table_name = 'project_collaborators'
  ) then
    alter table public.project_collaborators
      add constraint project_collaborators_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end;
$$;

-- ============================================================
-- 6. RLS for project_collaborators
-- ============================================================
drop policy if exists "project_collaborators_owner_manage" on public.project_collaborators;
drop policy if exists "project_collaborators_self_select" on public.project_collaborators;

create policy "project_collaborators_owner_manage" on public.project_collaborators
  for all to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_collaborators.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "project_collaborators_self_select" on public.project_collaborators
  for select to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- 7. Expand projects RLS to include collaborators
-- ============================================================
drop policy if exists "projects_collaborators_select" on public.projects;
drop policy if exists "projects_collaborators_update" on public.projects;

create policy "projects_collaborators_select" on public.projects
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.project_collaborators
      where project_collaborators.project_id = projects.id
        and project_collaborators.user_id = auth.uid()
    )
  );

create policy "projects_collaborators_update" on public.projects
  for update to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.project_collaborators
      where project_collaborators.project_id = projects.id
        and project_collaborators.user_id = auth.uid()
        and project_collaborators.permission = 'edit'
    )
  );
```

- [ ] **Step 3: Apply the migration via Supabase MCP**

Use `apply_migration` tool with project ID `ofssvvittiiysoibojts` and the SQL above.

- [ ] **Step 4: Verify profiles backfill worked**

```sql
select count(*) from public.profiles;
```

Expected: same count as `select count(*) from auth.users`.

- [ ] **Step 5: Commit the migration file**

```bash
git add supabase/migrations/20260603000000_profiles_and_collaboration.sql
git commit -m "feat: add profiles table, generating columns, collaborator RLS"
```

---

## Task 2: Create `useCollaboration` hook

**Files:**
- Create: `src/lib/useCollaboration.ts`
- Create: `src/lib/__tests__/collaboration.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/collaboration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getInitials } from '../useCollaboration'

describe('getInitials', () => {
  it('returns single letter for single name', () => {
    expect(getInitials('Thomas')).toBe('T')
  })

  it('returns two initials for full name', () => {
    expect(getInitials('Thomas Tschinkel')).toBe('TT')
  })

  it('handles extra whitespace', () => {
    expect(getInitials('  John  Doe  ')).toBe('JD')
  })

  it('truncates to 2 chars for multi-word names', () => {
    expect(getInitials('A B C D')).toBe('AB')
  })

  it('uppercases result', () => {
    expect(getInitials('john doe')).toBe('JD')
  })

  it('returns empty string for empty input', () => {
    expect(getInitials('')).toBe('')
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npx vitest run src/lib/__tests__/collaboration.test.ts
```

Expected: FAIL — `getInitials is not a function` (module doesn't exist yet).

- [ ] **Step 3: Create the hook**

Create `src/lib/useCollaboration.ts`:

```typescript
import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { AgentCodeFile } from './agent'

export interface CollaboratorPresence {
  userId: string
  name: string
  initials: string
}

export interface CollaborationOptions {
  projectId: string | undefined
  userId: string | undefined
  userName: string
  onFilesUpdate: (files: AgentCodeFile[]) => void
  onChatUpdate: (chat: unknown[]) => void
  onGeneratingChange: (generating: boolean, generatingBy: string | null) => void
}

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function useCollaboration({
  projectId,
  userId,
  userName,
  onFilesUpdate,
  onChatUpdate,
  onGeneratingChange,
}: CollaborationOptions) {
  const [onlineCollaborators, setOnlineCollaborators] = useState<CollaboratorPresence[]>([])

  // Keep callback refs current to avoid stale closures in subscription handlers
  const onFilesUpdateRef = useRef(onFilesUpdate)
  const onChatUpdateRef = useRef(onChatUpdate)
  const onGeneratingChangeRef = useRef(onGeneratingChange)
  useEffect(() => { onFilesUpdateRef.current = onFilesUpdate }, [onFilesUpdate])
  useEffect(() => { onChatUpdateRef.current = onChatUpdate }, [onChatUpdate])
  useEffect(() => { onGeneratingChangeRef.current = onGeneratingChange }, [onGeneratingChange])

  useEffect(() => {
    if (!projectId || !userId) return

    const initials = getInitials(userName)

    const channel = supabase.channel(`project:${projectId}`, {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ userId: string; name: string; initials: string }>()
        const others = Object.values(state)
          .flat()
          .filter((p) => p.userId !== userId)
        setOnlineCollaborators(others)
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${projectId}`,
        },
        (payload) => {
          const row = payload.new as {
            files?: AgentCodeFile[]
            chat_history?: unknown[]
            generating?: boolean
            generating_by?: string | null
          }
          if (Array.isArray(row.files)) onFilesUpdateRef.current(row.files)
          if (Array.isArray(row.chat_history)) onChatUpdateRef.current(row.chat_history)
          if (typeof row.generating === 'boolean') {
            onGeneratingChangeRef.current(row.generating, row.generating_by ?? null)
          }
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userId, name: userName, initials })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, userId, userName])

  return { onlineCollaborators }
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
npx vitest run src/lib/__tests__/collaboration.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/useCollaboration.ts src/lib/__tests__/collaboration.test.ts
git commit -m "feat: add useCollaboration hook with presence and Postgres Changes sync"
```

---

## Task 3: Fix `findFlorviaAccount` and `buildInviteLink`

**Files:**
- Modify: `src/pages/ProjectBuilderPage.tsx:1115-1147`

- [ ] **Step 1: Replace `buildInviteLink` (lines 1115–1121)**

Old:
```typescript
  const buildInviteLink = useCallback(() => {
    if (typeof window === 'undefined' || !projectId) return ''
    const token = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    return new URL(`/projects/${projectId}?invite=${token}`, window.location.origin).toString()
  }, [projectId])
```

New:
```typescript
  const buildInviteLink = useCallback(() => {
    if (typeof window === 'undefined' || !projectId) return ''
    return new URL(`/projects/${projectId}`, window.location.origin).toString()
  }, [projectId])
```

- [ ] **Step 2: Replace `findFlorviaAccount` (lines 1123–1147)**

Old:
```typescript
  const findFlorviaAccount = useCallback(async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase()
    const tables = ['profiles', 'users']

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .ilike('email', normalizedEmail)
        .maybeSingle()

      if (!error && data) {
        return {
          id: String(data.id ?? normalizedEmail),
          name: String(data.full_name ?? data.name ?? normalizedEmail.split('@')[0]),
        }
      }

      if (error && !/does not exist|schema cache|permission denied/i.test(error.message)) {
        break
      }
    }

    return null
  }, [])
```

New:
```typescript
  const findFlorviaAccount = useCallback(async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase()
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .ilike('email', normalizedEmail)
      .maybeSingle()

    if (!data) return null

    return {
      id: String(data.id),
      name: String(data.full_name ?? normalizedEmail.split('@')[0]),
    }
  }, [])
```

- [ ] **Step 3: Verify the app compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ProjectBuilderPage.tsx
git commit -m "fix: resolve findFlorviaAccount to use profiles table, simplify invite link"
```

---

## Task 4: Fix file/chat saves for collaborators

Currently `.eq('user_id', user.id)` on UPDATE queries silently fails for collaborators. RLS handles authorization — remove the `user_id` filter from all project UPDATE calls.

**Files:**
- Modify: `src/pages/ProjectBuilderPage.tsx` (lines 910–946 and 1364, 1419)

- [ ] **Step 1: Fix file save (around line 910)**

Old:
```typescript
      const { error } = await supabase
        .from('projects')
        .update({ files: projectFiles as unknown as Record<string, unknown>[] })
        .eq('id', projectId)
        .eq('user_id', user.id)
```

New:
```typescript
      const { error } = await supabase
        .from('projects')
        .update({ files: projectFiles as unknown as Record<string, unknown>[] })
        .eq('id', projectId)
```

- [ ] **Step 2: Fix chat history save (around line 934)**

Old:
```typescript
      const { error } = await supabase
        .from('projects')
        .update({ chat_history: messages as unknown as Record<string, unknown>[] })
        .eq('id', projectId)
        .eq('user_id', user.id)
```

New:
```typescript
      const { error } = await supabase
        .from('projects')
        .update({ chat_history: messages as unknown as Record<string, unknown>[] })
        .eq('id', projectId)
```

- [ ] **Step 3: Fix title save (line 1364) — inside `onProgress` title event**

Old:
```typescript
              supabase.from('projects').update({ title: event.text }).eq('id', projectId).eq('user_id', user.id).then(({ error }) => {
```

New:
```typescript
              supabase.from('projects').update({ title: event.text }).eq('id', projectId).then(({ error }) => {
```

- [ ] **Step 4: Fix title save (line 1419) — inside `done` tool result**

Old:
```typescript
                    supabase.from('projects').update({ title: doneData.title.trim() }).eq('id', projectId).eq('user_id', user.id).then(({ error }) => {
```

New:
```typescript
                    supabase.from('projects').update({ title: doneData.title.trim() }).eq('id', projectId).then(({ error }) => {
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/ProjectBuilderPage.tsx
git commit -m "fix: remove user_id filter from project updates so collaborators can save"
```

---

## Task 5: Wire generating coordination into `handleAgentRequest`

**Files:**
- Modify: `src/pages/ProjectBuilderPage.tsx` (around lines 1279–1286 and 1470–1481)

- [ ] **Step 1: Add `remoteGenerating` and `remoteGeneratingBy` state**

After the existing `agentRunning` state declaration (line 631), add:

```typescript
  const [remoteGenerating, setRemoteGenerating] = useState(false)
  const [remoteGeneratingBy, setRemoteGeneratingBy] = useState<string | null>(null)
  const remoteGeneratingPrevRef = useRef(false)
  const handleAgentRequestRef = useRef<typeof handleAgentRequest | null>(null)
```

Note: `handleAgentRequestRef` is assigned after `handleAgentRequest` is defined in Task 7.

- [ ] **Step 2: Expand the queue check in `handleAgentRequest` (line 1279)**

Old:
```typescript
    // Queue if agent is already running
    if (agentAbortRef.current) {
      pendingRequestRef.current = { prompt: request, model: selectedModel }
      setMessages((current) => [
        ...current,
        { id: `user-queued-${Date.now()}`, role: 'user' as const, content: request, timeline: [] },
      ])
      return
    }
```

New:
```typescript
    // Queue if agent is running locally or on another collaborator's client
    if (agentAbortRef.current || remoteGenerating) {
      pendingRequestRef.current = { prompt: request, model: selectedModel }
      setMessages((current) => [
        ...current,
        { id: `user-queued-${Date.now()}`, role: 'user' as const, content: request, timeline: [] },
      ])
      return
    }
```

- [ ] **Step 3: Set `generating=true` in DB before agent starts (after line 1336)**

After `setAgentStatus('Connecting...')` (line 1337), add:

```typescript
    if (projectId) {
      void supabase
        .from('projects')
        .update({ generating: true, generating_by: user.id })
        .eq('id', projectId)
    }
```

- [ ] **Step 4: Set `generating=false` in DB in the `finally` block (before `setAgentRunning(false)` at line 1474)**

Old `finally` block:
```typescript
    } finally {
      if (agentAbortRef.current === controller) {
        agentAbortRef.current = null
      }
      setAgentRunning(false)

      // Process queued request if any
      const pending = pendingRequestRef.current
      if (pending) {
        pendingRequestRef.current = null
        void handleAgentRequest(pending.prompt, pending.model)
      }
    }
```

New:
```typescript
    } finally {
      if (agentAbortRef.current === controller) {
        agentAbortRef.current = null
      }
      if (projectId) {
        void supabase
          .from('projects')
          .update({ generating: false, generating_by: null })
          .eq('id', projectId)
      }
      setAgentRunning(false)

      // Process queued request if any
      const pending = pendingRequestRef.current
      if (pending) {
        pendingRequestRef.current = null
        void handleAgentRequest(pending.prompt, pending.model)
      }
    }
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/ProjectBuilderPage.tsx
git commit -m "feat: coordinate generating state in DB for cross-collaborator prompt queue"
```

---

## Task 6: Add `remoteGenerating` queue effect and keep ref current

**Files:**
- Modify: `src/pages/ProjectBuilderPage.tsx`

This task adds the useEffect that fires a collaborator's queued prompt when remote generation ends, and keeps `handleAgentRequestRef` current so the effect can call it without stale-closure issues.

- [ ] **Step 1: Keep `handleAgentRequestRef` in sync**

Immediately after `handleAgentRequest` is defined (after the `useCallback` closing `}, [...])`), add:

```typescript
  useEffect(() => {
    handleAgentRequestRef.current = handleAgentRequest
  }, [handleAgentRequest])
```

- [ ] **Step 2: Add the remote queue effect**

After the effect above, add:

```typescript
  useEffect(() => {
    const prev = remoteGeneratingPrevRef.current
    remoteGeneratingPrevRef.current = remoteGenerating
    // Remote generation just ended — fire queued prompt if we have one
    if (prev && !remoteGenerating && !agentRunning) {
      const pending = pendingRequestRef.current
      if (pending) {
        pendingRequestRef.current = null
        void handleAgentRequestRef.current?.(pending.prompt, pending.model)
      }
    }
  }, [remoteGenerating, agentRunning])
```

- [ ] **Step 3: Update the "generating" label in toolbar and prompt input**

Find the disabled prop on the Deploy button (around line 1605):
```typescript
disabled={deployState === 'deploying' || !firstRunComplete || agentRunning}
```

Change to:
```typescript
disabled={deployState === 'deploying' || !firstRunComplete || agentRunning || remoteGenerating}
```

Find the Download button disabled (line 1593):
```typescript
disabled={!firstRunComplete || agentRunning}
```

Change to:
```typescript
disabled={!firstRunComplete || agentRunning || remoteGenerating}
```

Find the prompt input placeholder (around line 2056):
```typescript
placeholder={agentRunning ? agentStatus || 'Florvia is working...' : 'Ask Florvia for a change...'}
```

Change to:
```typescript
placeholder={
  agentRunning
    ? agentStatus || 'Florvia is working...'
    : remoteGenerating
      ? 'A collaborator is generating…'
      : 'Ask Florvia for a change...'
}
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/ProjectBuilderPage.tsx
git commit -m "feat: fire queued prompt when remote collaborator generation ends"
```

---

## Task 7: Wire `useCollaboration` into `ProjectBuilderPage`

**Files:**
- Modify: `src/pages/ProjectBuilderPage.tsx` (imports + hook call)

- [ ] **Step 1: Add import**

At the top of `src/pages/ProjectBuilderPage.tsx`, after the existing imports, add:

```typescript
import { useCollaboration, getInitials } from '../lib/useCollaboration'
```

- [ ] **Step 2: Add the hook call**

After the `loadCollaborators` useEffect (around line 847), add:

```typescript
  const userName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Unknown'

  const { onlineCollaborators } = useCollaboration({
    projectId,
    userId: user?.id,
    userName,
    onFilesUpdate: (files) => {
      if (!agentRunning) setProjectFiles(files)
    },
    onChatUpdate: (chat) => {
      if (!agentRunning) setMessages(chat as ChatMessage[])
    },
    onGeneratingChange: (generating, generatingBy) => {
      setRemoteGenerating(generating)
      setRemoteGeneratingBy(generatingBy)
    },
  })
```

Note: `onFilesUpdate` and `onChatUpdate` skip the update if we're the one running the agent (our local state is authoritative during our own run). Collaborator updates only apply when we're idle.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/ProjectBuilderPage.tsx
git commit -m "feat: wire useCollaboration hook into ProjectBuilderPage"
```

---

## Task 8: Add presence avatars to toolbar

**Files:**
- Modify: `src/pages/ProjectBuilderPage.tsx` (toolbar JSX around line 1597)

- [ ] **Step 1: Add the presence avatar cluster before the Share button**

Find this in the JSX (around line 1597):

```tsx
          <button className={styles.shareBtn} type="button" onClick={() => setShareOpen(true)}>
            <ShareIcon />
            Share
          </button>
```

Replace with:

```tsx
          {onlineCollaborators.length > 0 && (
            <div className={styles.presenceAvatars} aria-label="Online collaborators">
              {onlineCollaborators.slice(0, 4).map((c) => (
                <div
                  key={c.userId}
                  className={styles.presenceAvatar}
                  title={c.name}
                >
                  {c.initials}
                </div>
              ))}
            </div>
          )}
          <button className={styles.shareBtn} type="button" onClick={() => setShareOpen(true)}>
            <ShareIcon />
            Share
          </button>
```

- [ ] **Step 2: Add styles**

Find `src/pages/ProjectBuilderPage.module.css` and append these rules:

```css
.presenceAvatars {
  display: flex;
  align-items: center;
  gap: -6px;
}

.presenceAvatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #7c3aed;
  border: 2px solid #1a1a2e;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: -6px;
  cursor: default;
  user-select: none;
}

.presenceAvatar:first-child {
  margin-left: 0;
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/ProjectBuilderPage.tsx src/pages/ProjectBuilderPage.module.css
git commit -m "feat: show online collaborator presence avatars in toolbar"
```

---

## Task 9: Dashboard — fetch shared projects + realtime

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

- [ ] **Step 1: Extend the `Project` interface (line 11)**

Old:
```typescript
interface Project {
  id: string
  user_id: string
  title: string
  preview_url: string | null
  created_at: string
  starred: boolean
}
```

New:
```typescript
interface Project {
  id: string
  user_id: string
  title: string
  preview_url: string | null
  created_at: string
  starred: boolean
  isShared?: boolean
}
```

- [ ] **Step 2: Replace the fetch + realtime subscription (lines 83–114)**

Old:
```typescript
  // Fetch projects + real-time sync
  useEffect(() => {
    if (!user) return

    const fetchProjects = async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, user_id, title, preview_url, created_at, starred')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setProjects(data)
      }
      setProjectsLoading(false)
    }

    fetchProjects()

    const channel = supabase
      .channel('projects_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchProjects()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])
```

New:
```typescript
  // Fetch owned + shared projects with real-time sync
  useEffect(() => {
    if (!user) return

    const fetchProjects = async () => {
      // Owned projects
      const { data: owned } = await supabase
        .from('projects')
        .select('id, user_id, title, preview_url, created_at, starred')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      // Shared projects — look up via collaborator records
      const { data: collabRows } = await supabase
        .from('project_collaborators')
        .select('project_id')
        .eq('user_id', user.id)

      let shared: Project[] = []
      if (collabRows && collabRows.length > 0) {
        const ids = collabRows.map((r) => r.project_id as string)
        const { data: sharedData } = await supabase
          .from('projects')
          .select('id, user_id, title, preview_url, created_at, starred')
          .in('id', ids)
          .order('created_at', { ascending: false })
        shared = (sharedData ?? []).map((p) => ({ ...p, isShared: true }))
      }

      // Merge, deduplicate by id
      const seen = new Set<string>()
      const all: Project[] = []
      for (const p of [...(owned ?? []), ...shared]) {
        if (!seen.has(p.id)) {
          seen.add(p.id)
          all.push(p)
        }
      }
      setProjects(all)
      setProjectsLoading(false)
    }

    fetchProjects()

    // Watch owned project changes
    const ownedChannel = supabase
      .channel('projects_owned')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: `user_id=eq.${user.id}`,
      }, () => { fetchProjects() })
      .subscribe()

    // Watch for new shares directed at this user
    const sharedChannel = supabase
      .channel('projects_shared')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'project_collaborators',
        filter: `user_id=eq.${user.id}`,
      }, () => { fetchProjects() })
      .subscribe()

    return () => {
      supabase.removeChannel(ownedChannel)
      supabase.removeChannel(sharedChannel)
    }
  }, [user])
```

- [ ] **Step 3: Update `filteredProjects` to support `shared` filter (line 215)**

Old:
```typescript
  const filteredProjects = projects.filter((p) => {
    if (activeFilter === 'starred') return p.starred
    if (activeFilter === 'mine') return p.user_id === user?.id
    return true
  })
```

New:
```typescript
  const filteredProjects = projects.filter((p) => {
    if (activeFilter === 'starred') return p.starred
    if (activeFilter === 'mine') return p.user_id === user?.id
    if (activeFilter === 'shared') return p.isShared === true
    return true
  })
```

- [ ] **Step 4: Update `filterLabel` (line 221)**

Old:
```typescript
  const filterLabel = activeFilter === 'starred' ? 'Starred projects' : activeFilter === 'mine' ? 'Created by me' : 'Your projects'
```

New:
```typescript
  const filterLabel =
    activeFilter === 'starred' ? 'Starred projects'
    : activeFilter === 'mine' ? 'Created by me'
    : activeFilter === 'shared' ? 'Shared with me'
    : 'Your projects'
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "feat: fetch shared projects and add realtime channel for new shares"
```

---

## Task 10: DashboardSidebar — "Shared with me" filter

**Files:**
- Modify: `src/components/DashboardSidebar/DashboardSidebar.tsx`

- [ ] **Step 1: Add `shared` to `ProjectFilter` type (line 12)**

Old:
```typescript
export type ProjectFilter = 'all' | 'starred' | 'mine'
```

New:
```typescript
export type ProjectFilter = 'all' | 'starred' | 'mine' | 'shared'
```

- [ ] **Step 2: Add "Shared with me" to `projectNavItems` (after "Created by me" entry)**

Find the `projectNavItems` array and add after the last entry:

```typescript
  {
    label: 'Shared with me',
    icon: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3"/>
        <circle cx="6" cy="12" r="3"/>
        <circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>
    ),
  },
```

- [ ] **Step 3: Add `shared` to `filterMap` (line 111)**

Old:
```typescript
const filterMap: Record<string, ProjectFilter> = {
  'All projects': 'all',
  'Starred': 'starred',
  'Created by me': 'mine',
}
```

New:
```typescript
const filterMap: Record<string, ProjectFilter> = {
  'All projects': 'all',
  'Starred': 'starred',
  'Created by me': 'mine',
  'Shared with me': 'shared',
}
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/DashboardSidebar/DashboardSidebar.tsx
git commit -m "feat: add 'Shared with me' filter to DashboardSidebar"
```

---

## Manual Verification Checklist

After all tasks complete, verify end-to-end with two browser sessions (two different accounts):

- [ ] Account A invites Account B by email — no "user not found" error
- [ ] Account B sees the project in Dashboard under "Shared with me"
- [ ] Both A and B are in the project — A's avatar initials appear in B's toolbar (and vice versa)
- [ ] A submits a prompt — B sees "A collaborator is generating…" and Send is disabled
- [ ] B types a prompt and hits Send while A is generating — it queues
- [ ] A's generation finishes — B's queued prompt fires automatically
- [ ] A's file changes appear in B's preview without refresh
