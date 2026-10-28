# Legal Pages Redesign

**Date:** 2026-06-07  
**Status:** Approved  
**Scope:** `LegalPage.tsx`, `LegalPage.module.css` only — no changes to `TermsPage`, `PrivacyPage`, or `CookiesPage`

---

## Goal

Make the three legal pages (Terms of Service, Privacy Policy, Cookie Policy) look significantly more professional without touching their content. The result should feel like a real legal hub — structured, navigable, and visually consistent with the OpenThorn design system.

---

## Layout & Structure

`LegalPage` becomes a two-column grid:

```
[220px sticky TOC] | [680px content]
```

- Outer wrapper spans full width; inner container constrained to `max-width: 900px`
- TOC column: `position: sticky; top: 88px`
- TOC entries are auto-generated: `LegalPage` runs `querySelectorAll('h2')` in a `useEffect`, builds `{id, text}[]`, and injects `id` attributes onto those headings so anchor links work
- Content column is the same flowing text, now with upgraded styles

---

## Header Zone

Full-width header above both columns:

1. **Doc nav bar** — three `NavLink` pills: Terms of Service · Privacy Policy · Cookie Policy. Active pill: `--color-accent` text + `--color-accent-subtle` background. Inactive: `--color-text-muted`, no background.
2. **Title** — Fraunces serif, `--color-text`, large
3. **"Last updated" badge** — small inline chip: rounded border (`--color-border-visible`), `--color-text-muted` text, sits below the title
4. **Divider** — 1px `--color-border-visible` separates header from the two-column body

---

## TOC Sidebar (left column)

- **"Contents" label** — small uppercase, letter-spaced, `--color-text-muted`
- **Nav links** — one per `h2`, `0.875rem`, `--color-text-secondary`, no underline
- **Active state** — tracked via `IntersectionObserver`. Active item: 2px left border in `--color-accent`, text `--color-text`
- **Hover** — text shifts to `--color-text`, 150ms transition
- **Mobile (< 768px)** — sidebar hidden; TOC becomes a horizontal scrollable strip of pills above the content with the same accent-active behavior

---

## Content Typography

- **`h2` headings** — 2px left border in `--color-accent`, `padding-left: 12px`, subtle `--color-accent-wash` background strip, `2.75rem` top margin (up from `2.25rem`)
- **All hardcoded hex colors replaced** with design system vars:
  - `#ededf5` → `--color-text`
  - `#c8c8e0` → `--color-text-secondary`
  - `#7474a0` → `--color-text-muted`
  - `#9d89fb` / `#b8a9fd` → `--color-accent`
  - Border colors → `--color-border-glow` / `--color-border-visible`
- **Links** — `--color-accent`, hover `filter: brightness(1.15)`
- **`strong`** — `--color-text`
- **`code`** — `--font-mono`, `--color-accent`, `--color-accent-subtle` background

---

## Mobile Behavior

- Single column layout
- Sticky sidebar hidden
- TOC rendered as a horizontally-scrollable pill row above the content
- Doc nav bar wraps or scrolls as needed

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/LegalPage.tsx` | Add doc nav, header zone, two-column layout, TOC generation via `useEffect` + `IntersectionObserver` |
| `src/pages/LegalPage.module.css` | Full rewrite — two-column grid, sticky TOC styles, upgraded content typography, design system vars, mobile breakpoints |

No changes to `TermsPage.tsx`, `PrivacyPage.tsx`, or `CookiesPage.tsx`.
