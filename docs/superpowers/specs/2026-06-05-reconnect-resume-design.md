# Reconnect & Resume UX — Design Spec

**Date:** 2026-06-05  
**Status:** Approved

## Problem

When the user refreshes the browser while the agent is generating, two things go wrong:

1. **Stuck spinner** — `loadProject()` detects the interruption and strips the incomplete assistant message from local state, but immediately fires a Supabase `generating: false` update. That update triggers the realtime subscription's `onChatUpdate` with the full saved chat (still containing the incomplete message with a `toolStatus: 'running'` tool call). Because `agentRunning` is `false` at that instant, `onChatUpdate` restores the dirty message. The resume then adds a new assistant message below it; the new one completes normally, but the old one's miniSpinner stays stuck forever.

2. **No reconnect feedback** — the user sees no indication that the page detected the interruption and is resuming. The placeholder just shows "OpenThorn is working..." once the resume kicks in, which looks indistinguishable from a hang.

## Solution

Two targeted changes to `ProjectBuilderPage.tsx`.

### 1. Block the realtime race with `isResumingRef`

Add `const isResumingRef = useRef(false)`.

In `loadProject()`, when `wasInterrupted`:
```
isResumingRef.current = true
```

In `onChatUpdate`:
```
if (!agentRunning && !isResumingRef.current) setMessages(chat as ChatMessage[])
```

In the resume `useEffect`, clear the ref before starting the agent:
```
isResumingRef.current = false
```

This ensures the realtime event cannot re-pollute the cleaned chat during the resume window.

### 2. Show "Reconnected — resuming..." feedback

Add `const [reconnecting, setReconnecting] = useState(false)`.

In `loadProject()`, when `wasInterrupted`, also set `setReconnecting(true)`.

In the resume `useEffect`, clear it: `setReconnecting(false)`.

Use `reconnecting` to change the PromptInput placeholder:
```
reconnecting
  ? 'Reconnected — resuming your last request...'
  : agentRunning
    ? agentStatus || 'OpenThorn is working...'
    : ...
```

Also push a status timeline entry into the cleaned messages before calling `setMessages`:
```
{ role: 'assistant', timeline: [{ type: 'status', text: '⟳ Reconnected — resuming your last request...' }] }
```
This appears as an inline status pill in the chat, consistent with other agent status events. It will be replaced by the fresh assistant message once the resume fires.

Wait — rather than a separate transient assistant message, it's simpler to insert a `type: 'status'` event into the last real assistant message if one exists, or skip the inline status and rely solely on the placeholder. The placeholder is sufficient for this scope.

## Scope

- File: `src/pages/ProjectBuilderPage.tsx` only
- No new components, no new API calls, no schema changes
- The resume logic itself (`resumePromptRef`, the 100ms timer, `handleAgentRequest`) is unchanged

## Success Criteria

1. After refreshing during generation, no stuck miniSpinner appears in the chat
2. The PromptInput placeholder shows "Reconnected — resuming your last request..." briefly before switching to "OpenThorn is working..."
3. Generation resumes and completes normally
