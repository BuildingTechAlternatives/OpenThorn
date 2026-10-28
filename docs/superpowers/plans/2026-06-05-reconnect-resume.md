# Reconnect & Resume UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the stuck-spinner bug on page reload during generation, and show "Reconnected — resuming your last request..." feedback.

**Architecture:** Two small additions to `ProjectBuilderPage.tsx`: a ref (`isResumingRef`) that blocks `onChatUpdate` from restoring dirty chat during the resume window, and a `reconnecting` state that drives the placeholder text.

**Tech Stack:** React (useState, useRef, useEffect), TypeScript

---

## Files

- Modify: `src/pages/ProjectBuilderPage.tsx`

---

### Task 1: Add `isResumingRef` to block the realtime race condition

**Files:**
- Modify: `src/pages/ProjectBuilderPage.tsx`

The bug: after reload, `loadProject()` strips the incomplete assistant message from local state, but the Supabase `generating: false` update triggers `onChatUpdate` with the full dirty chat. Since `agentRunning` is `false` at that instant, `onChatUpdate` restores the dirty message. Adding a ref lets us block this window.

- [ ] **Step 1: Add the ref near the other refs (around line 725–785)**

Find the block of `useRef` declarations (near `agentAbortRef`, `resumePromptRef`, etc.) and add:

```typescript
const isResumingRef = useRef(false)
```

- [ ] **Step 2: Set the ref in `loadProject()` when interruption is detected**

Find this block (around line 915–929):

```typescript
const wasInterrupted = Boolean(existing?.generating && existing?.generating_by === user.id)
if (wasInterrupted && savedChat) {
  const lastUserMsg = [...savedChat].reverse().find(m => m.role === 'user')
  if (lastUserMsg) {
    const cleaned = savedChat[savedChat.length - 1]?.role === 'assistant'
      ? savedChat.slice(0, -1)
      : savedChat
    setMessages(cleaned)
    resumePromptRef.current = lastUserMsg.content as string
    initialAgentStartedRef.current = true
    void supabase.from('projects').update({ generating: false, generating_by: null }).eq('id', projectId)
  }
}
```

Add `isResumingRef.current = true` right after `resumePromptRef.current = lastUserMsg.content as string`:

```typescript
const wasInterrupted = Boolean(existing?.generating && existing?.generating_by === user.id)
if (wasInterrupted && savedChat) {
  const lastUserMsg = [...savedChat].reverse().find(m => m.role === 'user')
  if (lastUserMsg) {
    const cleaned = savedChat[savedChat.length - 1]?.role === 'assistant'
      ? savedChat.slice(0, -1)
      : savedChat
    setMessages(cleaned)
    resumePromptRef.current = lastUserMsg.content as string
    isResumingRef.current = true
    initialAgentStartedRef.current = true
    void supabase.from('projects').update({ generating: false, generating_by: null }).eq('id', projectId)
  }
}
```

- [ ] **Step 3: Guard `onChatUpdate` with the ref**

Find the `onChatUpdate` callback (around line 1024–1026):

```typescript
onChatUpdate: (chat) => {
  if (!agentRunning) setMessages(chat as ChatMessage[])
},
```

Change it to:

```typescript
onChatUpdate: (chat) => {
  if (!agentRunning && !isResumingRef.current) setMessages(chat as ChatMessage[])
},
```

- [ ] **Step 4: Clear the ref in the resume effect before firing the agent**

Find the resume effect (around line 1731–1741):

```typescript
useEffect(() => {
  const pending = resumePromptRef.current
  if (!pending || !filesLoaded || !chatHistoryLoaded || !user || isViewOnly) return
  resumePromptRef.current = null
  const timer = setTimeout(() => {
    void handleAgentRequestRef.current?.(pending, activeModel, activeThinkingLevel, { reuseInitialUser: true })
  }, 100)
  return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [filesLoaded, chatHistoryLoaded, user, isViewOnly])
```

Change it to:

```typescript
useEffect(() => {
  const pending = resumePromptRef.current
  if (!pending || !filesLoaded || !chatHistoryLoaded || !user || isViewOnly) return
  resumePromptRef.current = null
  isResumingRef.current = false
  const timer = setTimeout(() => {
    void handleAgentRequestRef.current?.(pending, activeModel, activeThinkingLevel, { reuseInitialUser: true })
  }, 100)
  return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [filesLoaded, chatHistoryLoaded, user, isViewOnly])
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ProjectBuilderPage.tsx
git commit -m "fix: block realtime chat restore during post-reload resume window"
```

---

### Task 2: Add "Reconnected — resuming..." placeholder feedback

**Files:**
- Modify: `src/pages/ProjectBuilderPage.tsx`

- [ ] **Step 1: Add `reconnecting` state near the other boolean states (around line 725–730)**

```typescript
const [reconnecting, setReconnecting] = useState(false)
```

- [ ] **Step 2: Set `reconnecting` in `loadProject()` alongside the ref**

In the same `if (lastUserMsg)` block from Task 1 Step 2, add `setReconnecting(true)` right after `isResumingRef.current = true`:

```typescript
isResumingRef.current = true
setReconnecting(true)
```

- [ ] **Step 3: Clear `reconnecting` in the resume effect**

In the same resume effect from Task 1 Step 4, add `setReconnecting(false)` alongside `isResumingRef.current = false`:

```typescript
resumePromptRef.current = null
isResumingRef.current = false
setReconnecting(false)
```

- [ ] **Step 4: Update the PromptInput placeholder**

Find the placeholder prop (around line 2381–2387):

```typescript
placeholder={
  agentRunning
    ? agentStatus || 'OpenThorn is working...'
    : remoteGenerating
      ? 'A collaborator is generating…'
      : 'Ask OpenThorn for a change...'
}
```

Change it to:

```typescript
placeholder={
  reconnecting
    ? 'Reconnected — resuming your last request...'
    : agentRunning
      ? agentStatus || 'OpenThorn is working...'
      : remoteGenerating
        ? 'A collaborator is generating…'
        : 'Ask OpenThorn for a change...'
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Manual test**

1. Start the dev server: `npm run dev`
2. Open a project in the builder and send a prompt to start generation
3. While the agent is generating (spinner visible), refresh the page
4. Expected:
   - Sidebar placeholder shows "Reconnected — resuming your last request..." briefly
   - No stuck miniSpinner on any old assistant message
   - Placeholder transitions to "OpenThorn is working..." when resume fires
   - Generation completes normally

- [ ] **Step 7: Commit**

```bash
git add src/pages/ProjectBuilderPage.tsx
git commit -m "feat: show reconnected status and fix stuck spinner on post-reload resume"
```
