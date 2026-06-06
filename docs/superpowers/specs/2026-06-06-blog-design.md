# Blog Feature Design

**Date:** 2026-06-06  
**Status:** Approved

## Overview

Add a public blog to OpenThorn's marketing site. Two routes: a listing page (`/blog`) and a single-article page (`/blog/:slug`). The first article introduces OpenThorn with the existing promo video embedded inline. Content is authored as `.md` files; metadata lives in a TypeScript registry.

## Architecture

```
src/
  content/
    blog/
      introducing-openthorn.md       ← article body (markdown)
  pages/
    BlogPage/
      BlogPage.tsx                   ← listing page
      BlogPage.module.css
    BlogPostPage/
      BlogPostPage.tsx               ← single article page
      BlogPostPage.module.css
  data/
    blogPosts.ts                     ← post registry (metadata array)

public/
  videos/
    openthorn-ad.mp4                 ← copied from remotion/out/
```

## Data Model

`blogPosts.ts` exports a typed array:

```ts
export interface BlogPost {
  slug: string
  title: string
  date: string          // ISO 8601 e.g. "2026-06-06"
  excerpt: string
  coverVideo?: string   // public path e.g. "/videos/openthorn-ad.mp4"
  content: string       // raw markdown string (imported from .md file)
}
```

Markdown files are imported as strings via Vite's `?raw` suffix:  
```ts
import content from '../content/blog/introducing-openthorn.md?raw'
```

## Routes

Both routes are public (no auth required). Added to `App.tsx`:

```
/blog          → BlogPage
/blog/:slug    → BlogPostPage
```

Header Resources dropdown: update Blog `href` from `'#'` to `'/blog'`.  
Since `/blog` is an internal route, the dropdown's existing `<Link>` branch handles it (paths starting with `/`).

## BlogPage (Listing)

- Header: "Blog" title + subtitle
- Featured card: first/latest post rendered large — shows video thumbnail (poster frame from the mp4), title, date, excerpt, "Read more" link
- Remaining posts: 2-column card grid (excerpt + date + title)
- No pagination needed for now (one post)
- Styled to match existing dark design system (`#0a0a12` bg, Fraunces headings, `#9d89fb` accent)

## BlogPostPage (Article)

Layout: single centered column, max-width 720px.

Structure top-to-bottom:
1. Back link → `/blog`
2. Post title (Fraunces, large)
3. Date + estimated read time
4. Video embed (`<video controls>` pointing to `/videos/openthorn-ad.mp4`) — 100% width, rounded corners
5. Markdown body via `<ReactMarkdown>` with custom component overrides

Markdown component overrides (styled to design system):
- `h1`/`h2`/`h3` — Fraunces, accent color headings
- `p` — Roboto, `#ededf5`, 1.7 line-height
- `code` — JetBrains Mono, subtle background
- `a` — purple accent, underline on hover
- `hr` — subtle divider

## First Article: "Introducing OpenThorn"

**Slug:** `introducing-openthorn`  
**Title:** Introducing OpenThorn — Build Full-Stack Apps from a Single Prompt  
**Date:** 2026-06-06

**Sections:**
1. Lede — the core promise in 2 sentences
2. The Problem — current friction in web app development
3. What OpenThorn Does — AI builder walkthrough
4. Current Features — bulleted: AI project builder, template gallery, provider selection, community showcase, pricing
5. The Vision — where it's going
6. CTA — link to dashboard / try it

## Error Handling

- Unknown slug → redirect to `/blog` (or show "Post not found" inline)
- Missing video → `<video>` element degrades gracefully (no poster, still plays if src resolves)

## Out of Scope

- CMS, admin panel, or authoring UI
- Comments or social sharing
- RSS feed
- Pagination (only one post for now)
- Search
