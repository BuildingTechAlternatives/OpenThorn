# FAQ Page Design Spec
**Date:** 2026-06-07  
**Status:** Approved

## Overview

Add a `/faq` route to the OpenThorn web app containing an accordion-style FAQ page. The page is purely informational (no auth required), matches the existing dark design system, and is linked from the footer's "Docs & FAQs" entry.

## Route & Files

| File | Purpose |
|------|---------|
| `src/pages/FaqPage.tsx` | New page component |
| `src/pages/FaqPage.module.css` | CSS module for layout and accordion styles |
| `src/App.tsx` | Add `<Route path="/faq" …>` inside `<Layout>` |
| `src/components/Footer/Footer.tsx` | Change `href: '#'` on "Docs & FAQs" to `to: '/faq'` (React Router `Link`) |

## Layout

Single-column layout, max-width `--max-width` (1100px), centered.

**Sections (top to bottom):**
1. **Hero header** — page title "Frequently Asked Questions" in `--font-display` (Fraunces serif), short subtitle in `--color-text-secondary`
2. **Category groups** — 4 topic sections, each with a label and a stack of accordion items
3. **Footer CTA** — short "Still have questions?" line with a mailto link

**Accordion behavior:**
- Each item shows the question as a clickable row with a `+` / `−` (or chevron) icon on the right
- Clicking toggles open/closed via React `useState`; only one item open at a time per category (or allow multiple — see decision below)
- Height animates via CSS `max-height` transition (`--ease-out-expo`)
- Open item answer text is visible; closed item is `max-height: 0; overflow: hidden`

**Decision — multiple open at once:** Allow multiple items open simultaneously. Simpler state model and more user-friendly when comparing answers.

## FAQ Content

### Getting Started
1. **What is OpenThorn?** — AI-powered app builder: describe what you want to build, OpenThorn generates the code and deploys it. No coding skills required.
2. **Do I need to know how to code?** — No. OpenThorn handles the technical side. You describe in plain language and it builds.
3. **How do I get started?** — Sign up, add your API key for at least one AI provider, create a project, and start describing your app.

### BYOK & API Keys
4. **What does BYOK mean?** — Bring Your Own Key. You supply your own API key from providers like OpenAI or Anthropic; OpenThorn never holds billing responsibility for your AI usage.
5. **Where do I get an API key?** — From your chosen provider's developer portal (e.g. platform.openai.com for OpenAI, console.anthropic.com for Anthropic).
6. **Which AI providers are supported?** — OpenAI, Anthropic, and more. The Providers page inside the app shows the current full list.
7. **Can I use multiple providers?** — Yes. You can add keys for several providers and choose which model to use per project.

### Security & Privacy
8. **Are my API keys safe?** — Yes. Keys are encrypted with AES-256-GCM before being stored and are never shared with third parties or used outside your own requests.
9. **What data does OpenThorn store?** — Your email address, encrypted API keys, project names, and the prompts and code within your projects. Nothing else.
10. **Where is my data hosted?** — On Vercel's infrastructure. Data may be processed in the United States under Standard Contractual Clauses (SCCs).
11. **Can I delete my data?** — Yes. Contact mys.thomas00@gmail.com to request account and data deletion.

### Pricing
12. **Is OpenThorn free to use?** — The platform itself is free. You pay only for the AI usage billed directly by your provider based on the model and tokens used.
13. **Does OpenThorn charge per generation?** — No. OpenThorn does not add any markup on AI usage. All generation costs go directly to your provider account.
14. **Where can I see model pricing?** — On the [Pricing page](/pricing), which shows live cost and quality data for all supported flagship models.

## Styling Notes

- Background: `--color-bg` (`#09070B`)
- Accordion item background: `--color-surface-raised`, border `--color-border-visible`
- Active/open item: subtle `--color-accent-subtle` tint on the question row
- Chevron icon rotates 180° on open via CSS `transform: rotate`
- Question text: `--color-text`, `--font-body`, `font-weight: 600`
- Answer text: `--color-text-secondary`, slightly smaller
- Category label: small caps or uppercase, `--color-text-muted`
- No external libraries needed — pure React + CSS

## Out of Scope

- Search/filter functionality
- CMS-driven FAQ content (content is hardcoded in the component)
- Auth gating (page is public)
- Sub-routes under `/faq`
