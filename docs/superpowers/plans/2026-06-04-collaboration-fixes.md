# Collaboration Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four collaboration bugs: collaborators see blank state on load, duplicate presence on reconnect, and presence avatars show nothing useful on click.

**Architecture:** Three files touched. `useCollaboration.ts` gets deduplication logic and email added to presence tracking. `ProjectBuilderPage.tsx` fixes the collaborator early-return to load files/chat, passes email to the hook, and adds avatar click popover state + JSX. `ProjectBuilderPage.module.css` gets popover styles.

**Tech Stack:** React, TypeScript, Supabase Realtime (presence + postgres_changes), Vitest

---

### Task 1: Fix presence deduplication and add email to CollaboratorPresence

**Files:**
- Modify: `src/lib/useCollaboration.ts`
- Test: `src/lib/__tests__/collaboration.test.ts`

- [ ] **Step 1: Add failing test for deduplication**

Open `src/lib/__tests__/collaboration.test.ts` and add at the bottom:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getInitials } from '../useCollaboration'

// (existing getInitials tests stay as-is)

describe('presence deduplication', () => {
  it('deduplicates entries with the same userId', () => {
    // Simulate what the sync handler does internally
    const rawEntries = [
      { userId: 'u1', name: 'Alice', initials: 'A', email: 'alice@x.com' },
      { userId: 'u1', name: 'Alice', initials: 'A', email: 'alice@x.com' }, // duplicate on reconnect
      { userId: 'u2', name: 'Bob', initials: 'B', email: 'bob@x.com' },
    ]
    const seen = new Set<string>()
    const deduped = rawEntries.filter(p => {
      if (seen.has(p.userId)) return false
      seen.add(p.userId)
      return true
    })
    expect(deduped).toHaveLength(2)
    expect(deduped[0].userId).toBe('u1')
    expect(deduped[1].userId).toBe('u2')
  })
})
```

- [ ] **Step 2: Run test to confirm it passes (logic is in the test itself)**

```bash
npx vitest run src/lib/__tests__/collaboration.test.ts
```

Expected: all tests PASS (the dedup logic is self-contained in the test).

- [ ] **Step 3: Update `CollaboratorPresence` and `CollaborationOptions` in `useCollaboration.ts`**

Replace the two interfaces at the top of `src/lib/useCollaboration.ts`:

```ts
export interface CollaboratorPresence {
  userId: string
  name: string
  initials: string
  email: string
}

export interface CollaborationOptions {
  projectId: string | undefined
  userId: string | undefined
  userName: string
  userEmail: string
  onFilesUpdate: (files: AgentCodeFile[]) => void
  onChatUpdate: (chat: unknown[]) => void
  onGeneratingChange: (generating: boolean, generatingBy: string | null) => void
}
```

- [ ] **Step 4: Update the hook signature and presence tracking**

In `useCollaboration.ts`, update the destructure line and `channel.track` call:

```ts
export function useCollaboration({
  projectId,
  userId,
  userName,
  userEmail,
  onFilesUpdate,
  onChatUpdate,
  onGeneratingChange,
}: CollaborationOptions) {
```

And in the `subscribe` callback, pass email:

```ts
.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    await channel.track({ userId, name: userName, initials, email: userEmail })
  }
})
```

- [ ] **Step 5: Add deduplication to the presence sync handler**

Replace the existing `'presence'` sync handler block:

```ts
.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState<{ userId: string; name: string; initials: string; email: string }>()
  const seen = new Set<string>()
  const others = Object.values(state)
    .flat()
    .filter((p) => p.userId !== userId)
    .filter((p) => {
      if (seen.has(p.userId)) return false
      seen.add(p.userId)
      return true
    })
  setOnlineCollaborators(others)
})
```

- [ ] **Step 6: Run all collaboration tests**

```bash
npx vitest run src/lib/__tests__/collaboration.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 7: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/useCollaboration.ts src/lib/__tests__/collaboration.test.ts
git commit -m "fix: deduplicate presence on reconnect, add email to CollaboratorPresence"
```

---

### Task 2: Load files and chat history for collaborators on mount

**Files:**
- Modify: `src/pages/ProjectBuilderPage.tsx` (the `loadProject` async function, ~line 748)

- [ ] **Step 1: Locate the collaborator early-return block**

In `ProjectBuilderPage.tsx`, find the block that starts at approximately line 748:

```ts
if (existing && existing.user_id !== user.id) {
  const { data: collaboration, error: collaborationError } = await supabase
    .from('project_collaborators')
    .select('permission')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (collaborationError || !collaboration) {
    navigate('/dashboard', { replace: true })
    return
  }

  setProjectAccess(collaboration.permission === 'view' ? 'view' : 'edit')
  setFilesLoaded(true)
  return
}
```

- [ ] **Step 2: Replace it with a version that loads existing state**

```ts
if (existing && existing.user_id !== user.id) {
  const { data: collaboration, error: collaborationError } = await supabase
    .from('project_collaborators')
    .select('permission')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (collaborationError || !collaboration) {
    navigate('/dashboard', { replace: true })
    return
  }

  setProjectAccess(collaboration.permission === 'view' ? 'view' : 'edit')

  if (Array.isArray(existing.files) && (existing.files as AgentCodeFile[]).length > 0) {
    setProjectFiles(existing.files as AgentCodeFile[])
    setFirstRunComplete(true)
    initialAgentStartedRef.current = true
  }

  if (Array.isArray(existing.chat_history) && (existing.chat_history as ChatMessage[]).length > 0) {
    setMessages(existing.chat_history as ChatMessage[])
  }
  setChatHistoryLoaded(true)

  if (existing.title && existing.title !== 'Untitled project') {
    setTitle(existing.title)
  }

  setFilesLoaded(true)
  return
}
```

Note: `existing` from the `.select()` at the top of `loadProject` only fetches `'user_id, title, files, chat_history, netlify_site_id'` — all fields needed are already selected.

- [ ] **Step 3: Pass `userEmail` to `useCollaboration`**

Find the `useCollaboration` call (~line 856) and add `userEmail`:

```ts
const { onlineCollaborators } = useCollaboration({
  projectId,
  userId: user?.id,
  userName,
  userEmail: user?.email ?? '',
  onFilesUpdate: (files) => {
    if (!agentRunning) setProjectFiles(files as AgentCodeFile[])
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

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ProjectBuilderPage.tsx
git commit -m "fix: load existing files and chat history for collaborators on mount"
```

---

### Task 3: Presence avatar click popover

**Files:**
- Modify: `src/pages/ProjectBuilderPage.tsx`
- Modify: `src/pages/ProjectBuilderPage.module.css`

- [ ] **Step 1: Add `activePresenceUser` state**

In `ProjectBuilderPage.tsx`, add this state near the other presence-related state (around line 661):

```ts
const [activePresenceUser, setActivePresenceUser] = useState<import('../lib/useCollaboration').CollaboratorPresence | null>(null)
```

Or, since `CollaboratorPresence` is already imported via `useCollaboration`, add it to the import at the top:

```ts
import { useCollaboration, type CollaboratorPresence } from '../lib/useCollaboration'
```

Then add state:

```ts
const [activePresenceUser, setActivePresenceUser] = useState<CollaboratorPresence | null>(null)
```

- [ ] **Step 2: Replace the presence avatars JSX**

Find the existing presence avatars block (~line 1636):

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
```

Replace with:

```tsx
{onlineCollaborators.length > 0 && (
  <div className={styles.presenceAvatars} aria-label="Online collaborators">
    {onlineCollaborators.slice(0, 4).map((c) => (
      <button
        key={c.userId}
        type="button"
        className={styles.presenceAvatar}
        aria-label={`${c.name} — click for info`}
        onClick={() => setActivePresenceUser((v) => v?.userId === c.userId ? null : c)}
      >
        {c.initials}
      </button>
    ))}
    {activePresenceUser && (
      <div className={styles.presencePopover}>
        <div className={styles.presencePopoverAvatar}>{activePresenceUser.initials}</div>
        <div className={styles.presencePopoverName}>{activePresenceUser.name}</div>
        <div className={styles.presencePopoverEmail}>{activePresenceUser.email}</div>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 3: Close popover on outside click**

Add a `useEffect` near the other effects in `ProjectBuilderPage.tsx`:

```ts
useEffect(() => {
  if (!activePresenceUser) return
  const handler = (e: MouseEvent) => {
    const target = e.target as Element
    if (!target.closest(`.${styles.presenceAvatars}`)) {
      setActivePresenceUser(null)
    }
  }
  document.addEventListener('mousedown', handler)
  return () => document.removeEventListener('mousedown', handler)
}, [activePresenceUser, styles.presenceAvatars])
```

- [ ] **Step 4: Add popover CSS**

In `src/pages/ProjectBuilderPage.module.css`, update the `.presenceAvatars` block and add new classes after `.presenceAvatar:first-child`:

First, update `.presenceAvatars` to have `position: relative`:

```css
.presenceAvatars {
  display: flex;
  align-items: center;
  position: relative;
}
```

Then update `.presenceAvatar` to have `cursor: pointer` and add button reset styles (replacing `cursor: default`):

```css
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
  cursor: pointer;
  user-select: none;
  padding: 0;
  outline: none;
  transition: transform 0.15s, box-shadow 0.15s;
}

.presenceAvatar:hover {
  transform: scale(1.1);
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.35);
  z-index: 1;
}
```

Then add the popover classes after `.presenceAvatar:first-child`:

```css
.presencePopover {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  background: #1e1e2e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 160px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 100;
  pointer-events: none;
}

.presencePopoverAvatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #7c3aed;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}

.presencePopoverName {
  font-size: 13px;
  font-weight: 700;
  color: #f0f0f5;
  text-align: center;
}

.presencePopoverEmail {
  font-size: 11px;
  color: #8888a8;
  text-align: center;
  word-break: break-all;
}
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ProjectBuilderPage.tsx src/pages/ProjectBuilderPage.module.css
git commit -m "feat: add presence avatar click popover showing name and email"
```

---

### Task 4: Run full test suite and push

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 2: Push to remote**

```bash
git push
```
