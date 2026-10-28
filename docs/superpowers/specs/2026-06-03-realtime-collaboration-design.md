# Real-time Collaboration — Design Spec

**Date:** 2026-06-03  
**Status:** Approved

## Problem

The project share system is broken in three ways:
1. `findOpenThornAccount` queries `profiles` and `users` tables that don't exist → 404 errors → "user not found" on every invite
2. Collaborators never see shared projects in the Dashboard — the query and realtime subscription only watch projects owned by the current user
3. There is no live sync between collaborators inside a project

## Goal

Full co-editing: both collaborators see the same files and chat in real time, prompts queue when the agent is busy, and presence indicators show who's currently in the project.

---

## Section 1: Database

### 1.1 New `profiles` table

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  avatar_url text
);

-- Trigger: populate on every new signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

RLS:
- All authenticated users can SELECT (needed for invite email lookup)
- Each user can UPDATE their own row only

### 1.2 `projects` table additions

Two new columns:
- `generating` (boolean, default false) — true while the AI agent is running
- `generating_by` (uuid, nullable, FK → auth.users) — which user started the current generation

### 1.3 `project_collaborators` FK fix

Add missing foreign key: `user_id` → `auth.users.id`.

RLS additions:
- Project owner can INSERT, DELETE rows
- Both owner and the collaborator themselves can SELECT their row
- Project owner can UPDATE permission

### 1.4 `projects` RLS expansion

| Actor | SELECT | UPDATE | DELETE |
|---|---|---|---|
| Owner | ✅ | ✅ | ✅ |
| Edit collaborator | ✅ | ✅ | ❌ |
| View collaborator | ✅ | ❌ | ❌ |

---

## Section 2: User Lookup & Invite Flow

### Fix `findOpenThornAccount`

Replace the current loop over non-existent tables with a single query:

```ts
const { data } = await supabase
  .from('profiles')
  .select('id, full_name')
  .ilike('email', normalizedEmail)
  .maybeSingle()
```

Returns `{ id, name }` or `null` (→ "No OpenThorn account found for that email").

### Invite flow (simplified)

1. Owner enters collaborator email
2. `findOpenThornAccount` looks up `profiles`
3. If found: INSERT into `project_collaborators` with `user_id`, `email`, `permission`, `invited_by`
4. Invited user can access the project immediately — no token needed

**Remove `?invite=token` from invite URL.** The token is generated client-side but never validated server-side — it's meaningless. The plain project URL (`/projects/:id`) is the share link. Access is controlled entirely by the `project_collaborators` row.

---

## Section 3: Dashboard — Shared Projects

### Fetch strategy

On load, run two parallel queries:
1. Owned: `projects` where `user_id = me`
2. Shared: `project_collaborators` where `user_id = me` → fetch those project rows

Merge and deduplicate by project ID in state. Tag each project with `isShared: boolean` for the filter.

### DashboardSidebar new filter

Add "Shared with me" alongside All / Starred / Mine.

### Real-time subscriptions

Replace the single owned-projects channel with two:
1. `projects` channel: `user_id=eq.${user.id}` (owned — unchanged)
2. `project_collaborators` channel: `user_id=eq.${user.id}` — on INSERT (new share), re-fetch shared projects

---

## Section 4: Real-time Collaboration in ProjectBuilderPage

### Channel

One Supabase Realtime channel per project: `project:${projectId}`.

### Presence

On mount, track: `{ userId, name, initials }`.  
Render avatar circles (initials) in the toolbar for all online users. Remove on leave.

### File & chat sync

Subscribe to Postgres Changes on the `projects` row (`id=eq.${projectId}`).  
On UPDATE: merge incoming `files` and `chat_history` into local state. This fires automatically when any collaborator's agent run saves to the DB.

### Prompt queue

State: `pendingPrompt: string | null`

Flow:
- User submits prompt while `generating = true` → store in `pendingPrompt`, show "Queued — waiting for current generation…"
- Realtime fires `generating = false` → auto-submit `pendingPrompt`, clear it
- Only one prompt can be queued per client (later submission replaces earlier)

### Generating coordination

**Before agent starts:**
```ts
await supabase.from('projects').update({ generating: true, generating_by: user.id }).eq('id', projectId)
```

**After agent finishes (success or error):**
```ts
await supabase.from('projects').update({ generating: false, generating_by: null }).eq('id', projectId)
```

All collaborators see `generating = true` via Postgres Changes. Their Send button switches to `"[Name] is generating…"` using the `generating_by` user's display name looked up from presence or `profiles`.

---

## Out of Scope

- Email notifications for invites
- Real-time cursor positions within the code editor
- Conflict resolution if two queued prompts contradict each other (last one wins)
- Revoking access once a session is active (takes effect on next page load)
