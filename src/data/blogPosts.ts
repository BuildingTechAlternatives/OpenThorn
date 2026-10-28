import blogMeta from './blog-meta.json'

export interface BlogPost {
  slug: string
  title: string
  date: string
  excerpt: string
  coverYoutube?: string
  /** Site-relative path for the cover/preview image shown on the blog pages. */
  coverImage?: string
  /** Absolute URL for og:image. Falls back to site logo when omitted. */
  ogImage?: string
  /** ISO date of the last substantive edit; defaults to the publish date. */
  dateModified?: string
  /** Quotable 40–60 word direct answer rendered as a TL;DR block (AEO). */
  tldr?: string
  /** Optional HowTo structured data emitted as JSON-LD on the post page. */
  howTo?: { name: string; steps: { name: string; text: string }[] }
  /** Optional ItemList structured data (for listicle posts). */
  itemList?: string[]
  content: string
}

// Markdown bodies are loaded eagerly as raw strings. Vite turns the glob into
// static imports at build time, so scripts/sync-blog.mjs can add/remove
// <slug>.md files and they are bundled automatically — no per-post code change.
// Post metadata lives in blog-meta.json so scripts/prerender.mjs can read the
// same source for per-route meta tags, JSON-LD, and the sitemap.
const modules = import.meta.glob('../content/blog/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const contentBySlug: Record<string, string> = {}
for (const [path, raw] of Object.entries(modules)) {
  const slug = path.split('/').pop()!.replace(/\.md$/, '')
  contentBySlug[slug] = raw
}

export const blogPosts: BlogPost[] = blogMeta.map((meta) => ({
  ...meta,
  content: contentBySlug[meta.slug] ?? '',
}))

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug)
}
