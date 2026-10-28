# Template Window — Design Spec
_Date: 2026-06-04_

## Overview

Add a Templates section to the OpenThorn dashboard. Users browse 3 professional starter templates, preview them live in a full-screen overlay, and launch a new project from any template. The project builder immediately renders the template — no waiting for the agent — and the agent builds on top of the existing files rather than replacing them.

---

## Architecture

### New files
- `src/lib/templates.ts` — template definitions (`id`, `name`, `description`, `category`, `files: AgentCodeFile[]`)
- `src/pages/TemplatesPage.tsx` — the `/templates` route
- `src/pages/TemplatesPage.module.css` — styles

### Modified files
- `src/App.tsx` — add `/templates` route
- `src/components/DashboardSidebar/DashboardSidebar.tsx` — wire "Templates" nav click to `navigate('/templates')`
- `src/pages/ProjectBuilderPage.tsx` — bootstrap preview from template files, inject template system-reminder

---

## Route: `/templates`

Shares the same shell as DashboardPage: `DashboardSidebar` on the left, main content area on the right. The sidebar "Templates" item is active when on this route.

### Template gallery (main area)
- Header: "Start from a template" + subtitle "Production-quality starting points. Customize with AI."
- 3-column grid (2-col at tablet, 1-col at mobile)
- Each card:
  - Live `<iframe>` thumbnail — the actual rendered template scaled down via `transform: scale()` + `pointer-events: none`
  - Template name, category badge, one-line description
  - Hover: card lifts, "Preview" button overlay appears

### Preview overlay
Triggered by clicking a card. Full-screen modal:
- Left ~70%: live `<iframe>` at full resolution, device toggle (desktop/tablet/phone)
- Right ~30% panel: name, category badge, description bullets, model selector, "Use this template" button
- Escape or ✕ closes

### "Use this template" flow
1. Generate a new `projectId` (crypto.randomUUID)
2. Create a Supabase `projects` row (`id`, `user_id`, `title` = template name, `preview_url: null`)
3. Navigate to `/projects/{projectId}` with route state:
   ```ts
   {
     title: template.name,
     templateFiles: template.files,
     isTemplate: true,
     templateName: template.name,
     selectedModel,   // from model selector in overlay
     thinkingLevel,   // default
   }
   ```
   Note: no `prompt` in state — the user's first message in the chat is how they customize.

---

## ProjectBuilderPage changes

### Immediate preview bootstrap
A new `useEffect`, gated on `state.templateFiles` being present, fires once on mount:
```ts
if (state.templateFiles?.length) {
  setProjectFiles(state.templateFiles)
  const html = await buildPreview(state.templateFiles)
  setPreviewHtml(html)
  setLastReadyHtml(html)
  setPreviewStatus('ready')
  setFirstRunComplete(true)
  initialAgentStartedRef.current = true  // prevents auto-start
}
```
This populates the iframe immediately. The agent does not auto-start; the user types their first message to kick things off.

### Route state extension
```ts
interface ProjectRouteState {
  prompt?: string
  title?: string
  selectedModel?: SelectedAgentModel | null
  thinkingLevel?: AgentThinkingLevel
  templateFiles?: AgentCodeFile[]   // NEW
  isTemplate?: boolean               // NEW
  templateName?: string              // NEW
}
```

### Agent template-mode system-reminder
When `state.isTemplate` is true, the first user message sent to the agent is prefixed with:
```
<system-reminder>
TEMPLATE MODE: This project was started from the "{templateName}" template.
The existing files are the template foundation — build upon them.
Preserve the color system, component structure, and design language.
Do not delete template files unless the user explicitly requests it.
</system-reminder>

{userMessage}
```
The static cached system prompt is untouched. The reminder travels in the user turn, not the system prompt.

### Agent mode
Template projects always start in `mode: 'refine'` (passed to `runOpenThornAgent`) so the agent skips the `set_title` call at the start — the title is already set from the template name.

---

## The 3 Templates

### 1. Creative Portfolio
- **Category:** Portfolio
- **Theme:** Dark cinematic — deep charcoal background, violet/indigo accent, sharp typography
- **Sections:** Animated hero with floating gradient orbs, filterable project grid with hover zoom, skills/tools section, about, contact with form
- **Files:** `src/App.tsx`, `src/components/Navbar.tsx`, `src/components/Hero.tsx`, `src/components/Projects.tsx`, `src/components/Skills.tsx`, `src/components/Contact.tsx`, `src/styles/theme.css`

### 2. SaaS Landing Page
- **Category:** SaaS
- **Theme:** Clean light — white/off-white base, electric blue accent, generous whitespace
- **Sections:** Bold hero with product mockup window, feature grid with icons, testimonial carousel, 3-tier pricing table, FAQ accordion, footer CTA
- **Files:** `src/App.tsx`, `src/components/Navbar.tsx`, `src/components/Hero.tsx`, `src/components/Features.tsx`, `src/components/Testimonials.tsx`, `src/components/Pricing.tsx`, `src/components/FAQ.tsx`, `src/styles/theme.css`

### 3. E-commerce Storefront
- **Category:** E-commerce
- **Theme:** Premium — warm off-white/cream base, deep forest green accent, editorial typography
- **Sections:** Hero with featured product, category navigation pills, product grid with add-to-cart hover state, minimal cart drawer (slide-in), footer
- **Files:** `src/App.tsx`, `src/components/Navbar.tsx`, `src/components/Hero.tsx`, `src/components/Categories.tsx`, `src/components/ProductGrid.tsx`, `src/components/CartDrawer.tsx`, `src/styles/theme.css`

All template files are defined inline in `src/lib/templates.ts` as `AgentCodeFile[]` arrays. No DB storage, no external assets.

---

## What is NOT in scope
- More than 3 templates (extensible later by adding entries to `templates.ts`)
- User-submitted or community templates
- Template search/filtering
- Template preview screenshots stored as static PNGs
- Any Supabase schema changes beyond the existing `projects` table
