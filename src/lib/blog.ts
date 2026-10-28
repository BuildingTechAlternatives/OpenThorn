import { supabase } from './supabase'
import type { BlogPost } from '../data/blogPosts'

interface BlogRow {
  slug: string
  title: string
  excerpt: string | null
  content: string | null
  date: string
  date_modified: string | null
  cover_youtube: string | null
  cover_image: string | null
  og_image: string | null
  tldr: string | null
  how_to: BlogPost['howTo'] | null
  item_list: string[] | null
}

function rowToPost(r: BlogRow): BlogPost {
  return {
    slug: r.slug,
    title: r.title,
    date: r.date,
    excerpt: r.excerpt ?? '',
    content: r.content ?? '',
    dateModified: r.date_modified ?? undefined,
    coverYoutube: r.cover_youtube ?? undefined,
    coverImage: r.cover_image ?? undefined,
    ogImage: r.og_image ?? undefined,
    tldr: r.tldr ?? undefined,
    howTo: r.how_to ?? undefined,
    itemList: r.item_list ?? undefined,
  }
}

/** Published posts, newest first. Returns null on error so callers keep bundled data. */
export async function fetchPublishedPosts(): Promise<BlogPost[] | null> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('slug,title,excerpt,content,date,date_modified,cover_youtube,cover_image,og_image,tldr,how_to,item_list')
    .eq('status', 'published')
    .order('date', { ascending: false })
  if (error || !data) return null
  return (data as BlogRow[]).map(rowToPost)
}
