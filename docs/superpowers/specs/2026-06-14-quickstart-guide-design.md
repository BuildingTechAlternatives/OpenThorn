# First-login Quickstart Guide — Design

**Date:** 2026-06-14
**Status:** Approved

## Overview

A one-time welcome modal that appears the first time a user lands on the
Dashboard after signing up. It walks through a short sequence of slides covering
what OpenThorn is, where to connect a provider, where Templates live, how to open
the Restaurant Landing template, and the core build/deploy flow. Each feature
slide carries an **action button** that closes the modal and navigates the user
to the relevant place. The guide is shown once per account, tracked via a flag on
the `profiles` table.

The existing inline "Launch checklist" card on the Dashboard
(`DashboardPage.tsx`) stays as the ongoing reference; the quickstart guide
complements it rather than replacing it.

## Show-once mechanism (database)

New migration `supabase/migrations/<timestamp>_add_quickstart_flag.sql`:

```sql
alter table public.profiles
  add column if not exists has_seen_quickstart boolean not null default false;

-- Existing users have already used the app — don't re-onboard them.
-- Only accounts created after this migration get the default `false`.
update public.profiles set has_seen_quickstart = true;
```

- New signups receive `has_seen_quickstart = false` from the column default via
  the existing `handle_new_user` trigger. Only these users see the guide.
- The existing `profiles_update_own` RLS policy already allows a user to update
  their own row, so the client can flip the flag itself. No policy changes.

### Read / dismiss flow (DashboardPage)

- On mount, once `user` is available, query
  `select has_seen_quickstart from profiles where id = user.id`.
- If the value is `false`, open the quickstart modal.
- On dismiss (finishing the last slide, closing, or pressing any action button),
  optimistically hide the modal in local state and run
  `update profiles set has_seen_quickstart = true where id = user.id`.
- Failures to persist are logged via the existing `logError` helper and do not
  block the UI (worst case: the guide could reappear on next load).

## Component

New `src/components/QuickstartGuide/QuickstartGuide.tsx` with a co-located
`QuickstartGuide.module.css`, following the existing modal patterns in the
codebase (backdrop + centered card, like the Publish-to-Community modal in
`DashboardPage.tsx` and the Templates preview overlay): click-outside / Escape to
close, design-token colors from `src/index.css`.

**Props:**
- `firstName: string`
- `onClose: () => void` — called for both "finish" and "close"; the parent flips
  the DB flag here.

The component owns its own slide state (`step`, prev/next handlers, progress
dots). It receives a `navigate`-style callback (or imports `useNavigate`) so
action buttons can route; each action button calls `onClose` (which persists the
flag) before navigating, so the guide never reappears.

**Slides** (each: a small inline SVG illustration, heading, one or two lines of
copy, and an action button):

1. **Welcome, {firstName}** — OpenThorn builds complete websites from a prompt
   using your own AI provider key. → *Next*
2. **Connect a provider** — Your key stays yours (BYOK). Find it under
   **Providers** in the sidebar. → *Go to Providers* — `navigate('/providers')`
3. **Browse Templates** — Production-ready starting points live under
   **Templates**. → *Open Templates* — `navigate('/templates')`
4. **Try the Restaurant Landing template** — Open Templates, click a card to
   preview it, then "Use this template." → *Open Restaurant template* —
   `navigate('/templates', { state: { openTemplateId: 'restaurant-landing' } })`
5. **Build & deploy** — Describe your idea in the prompt box and deploy when
   ready. → *Get started* (closes the guide)

The guide is rendered by `DashboardPage` as a sibling of the existing modals,
gated on the fetched `has_seen_quickstart` flag being `false`.

## Supporting change: TemplatesPage deep-link

`TemplatesPage` reads `location.state.openTemplateId` on mount and, if present and
matching a known template, auto-opens that template's preview overlay
(`setSelected(...)`). This lets slide 4's action button land the user directly on
the Restaurant Landing preview. The Restaurant template id is `restaurant-landing`
(verified in `src/lib/templates.ts`).

## Out of scope (YAGNI)

- No guided spotlight/coachmark tour over real UI elements.
- No re-show mechanism or "view guide again" entry point.
- No admin toggle or per-tenant configuration.
- No change to the existing inline Launch checklist.
