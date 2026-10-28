# Collaboration Fixes Design

**Date:** 2026-06-04  
**Status:** Approved

## Summary

Four issues in the real-time collaboration system:

1. Collaborator opens a shared project and sees a blank canvas (no files, no chat history)
2. Collaborator cannot see what the agent already did or is currently doing
3. When a user refreshes, they appear twice in the online presence avatars
4. Clicking a presence avatar shows nothing useful — should show an info overlay with name and email

---

## Fix 1 + 2 — Collaborators must load existing project state on mount

### Root cause

`loadProject()` in `ProjectBuilderPage.tsx` (around line 748) does an early return after confirming collaborator access:

```ts
if (existing && existing.user_id !== user.id) {
  setProjectAccess(...)
  setFilesLoaded(true)
  return  // ← files and chat_history never loaded
}
```

The collaborator starts with empty `projectFiles` and empty `messages`, and only ever receives database change events that fire *after* they joined.

### Fix

After confirming collaborator access, load `existing.files` and `existing.chat_history` the same way the owner path does, then continue:

```ts
if (existing && existing.user_id !== user.id) {
  setProjectAccess(...)

  // Load current project state so collaborator sees existing work
  if (Array.isArray(existing.files) && existing.files.length > 0) {
    setProjectFiles(existing.files)
    setFirstRunComplete(true)
    initialAgentStartedRef.current = true
  }
  if (Array.isArray(existing.chat_history) && existing.chat_history.length > 0) {
    setMessages(existing.chat_history)
  }
  setChatHistoryLoaded(true)

  if (existing.title && existing.title !== 'Untitled project') {
    setTitle(existing.title)
  }

  setFilesLoaded(true)
  return
}
```

No changes to the real-time sync path — it already works correctly once the initial state is loaded.

---

## Fix 3 — Deduplicate presence by userId

### Root cause

In `useCollaboration.ts`, the presence sync handler:

```ts
const others = Object.values(state).flat().filter(p => p.userId !== userId)
setOnlineCollaborators(others)
```

`Object.values(state)` returns an array-per-key (one key per userId). When a user refreshes, Supabase briefly holds both the old and new socket's presence entry under the same key, so `.flat()` produces two objects with the same `userId`. There is no deduplication step.

### Fix

After filtering out the current user, deduplicate by `userId` keeping the first entry per user:

```ts
const seen = new Set<string>()
const deduped = Object.values(state)
  .flat()
  .filter(p => p.userId !== userId)
  .filter(p => {
    if (seen.has(p.userId)) return false
    seen.add(p.userId)
    return true
  })
setOnlineCollaborators(deduped)
```

---

## Fix 4 — Presence avatar click shows name + email overlay

### Changes

**`CollaboratorPresence` interface** — add `email`:
```ts
export interface CollaboratorPresence {
  userId: string
  name: string
  initials: string
  email: string
}
```

**`CollaborationOptions`** — add `userEmail`:
```ts
export interface CollaborationOptions {
  // ...existing fields...
  userEmail: string
}
```

**`useCollaboration` hook** — pass `email` in `channel.track()`:
```ts
await channel.track({ userId, name: userName, initials, email: userEmail })
```

**`ProjectBuilderPage`** — pass `user?.email ?? ''` as `userEmail`.

**Presence avatar UI** — replace the static avatar with a clickable element that sets `activePresenceUser` state. Render a small popover card when `activePresenceUser !== null`:

```tsx
const [activePresenceUser, setActivePresenceUser] = useState<CollaboratorPresence | null>(null)

// In JSX:
{onlineCollaborators.slice(0, 4).map(c => (
  <button
    key={c.userId}
    className={styles.presenceAvatar}
    onClick={() => setActivePresenceUser(v => v?.userId === c.userId ? null : c)}
    aria-label={c.name}
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
```

The popover closes when clicking outside (use `onMouseDown` on an overlay, or a `useEffect` listening to document clicks). Position it below the clicked avatar using CSS absolute positioning anchored to the `presenceAvatars` wrapper.

---

## Affected files

- `src/lib/useCollaboration.ts` — Fix 3 (dedup), Fix 4 (add email to interface + track)
- `src/pages/ProjectBuilderPage.tsx` — Fix 1+2 (collaborator load), Fix 4 (userEmail prop, avatar click popover + state)
- `src/pages/ProjectBuilderPage.module.css` — Fix 4 (popover styles)

## Testing

- Owner opens project, runs agent; collaborator opens same project in another browser → sees existing chat history and files immediately
- Owner runs agent while collaborator watches → collaborator sees timeline updates in real-time
- User A refreshes page → only one avatar shown in toolbar, not two
- Clicking a presence avatar shows popover with that collaborator's name and email; clicking again or elsewhere closes it
