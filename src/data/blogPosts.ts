import introducingOpenThornContent from '../content/blog/introducing-openthorn.md?raw'

export interface BlogPost {
  slug: string
  title: string
  date: string
  excerpt: string
  coverVideo?: string
  content: string
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'introducing-openthorn',
    title: 'Introducing OpenThorn — Build Full-Stack Apps from a Single Prompt',
    date: '2026-06-06',
    excerpt:
      'Most web apps still take weeks to build. We built OpenThorn to close that gap — describe your app in plain language and ship the same day.',
    coverVideo: '/videos/openthorn-ad.mp4',
    content: introducingOpenThornContent,
  },
]

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug)
}
