import blogMeta from './blog-meta.json'
import introducingOpenThornContent from '../content/blog/introducing-openthorn.md?raw'
import whatIsByokContent from '../content/blog/what-is-a-byok-ai-website-builder.md?raw'

export interface BlogPost {
  slug: string
  title: string
  date: string
  excerpt: string
  coverVideo?: string
  /** Site-relative path for the cover/preview image shown on the blog pages. */
  coverImage?: string
  /** Absolute URL for og:image. Falls back to site logo when omitted. */
  ogImage?: string
  content: string
}

// Post metadata lives in blog-meta.json so scripts/prerender.mjs can read the
// same source for per-route meta tags, JSON-LD, and the sitemap. When adding a
// post: create the markdown file, add its entry to blog-meta.json, and map its
// content here.
const contentBySlug: Record<string, string> = {
  'introducing-openthorn': introducingOpenThornContent,
  'what-is-a-byok-ai-website-builder': whatIsByokContent,
}

export const blogPosts: BlogPost[] = blogMeta.map((meta) => ({
  ...meta,
  content: contentBySlug[meta.slug] ?? '',
}))

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug)
}
