import { supabase } from './supabase'

export interface AdminBlogRow {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  date: string
  date_modified: string | null
  cover_youtube: string | null
  cover_image: string | null
  og_image: string | null
  tldr: string | null
  status: 'draft' | 'published'
  published_at: string | null
  updated_at: string
}

export type BlogDraft = Pick<
  AdminBlogRow,
  'slug' | 'title' | 'excerpt' | 'content' | 'date' | 'date_modified'
  | 'cover_youtube' | 'cover_image' | 'og_image' | 'tldr' | 'status'
>

export async function adminListPosts(): Promise<AdminBlogRow[]> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('id,slug,title,excerpt,content,date,date_modified,cover_youtube,cover_image,og_image,tldr,status,published_at,updated_at')
    .order('date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as AdminBlogRow[]
}

/** Insert or update by id. Sets published_at when publishing. */
export async function adminSavePost(draft: BlogDraft, id?: string): Promise<void> {
  const row: Record<string, unknown> = {
    ...draft,
    date_modified: draft.date_modified || null,
    cover_youtube: draft.cover_youtube || null,
    cover_image: draft.cover_image || null,
    og_image: draft.og_image || null,
    tldr: draft.tldr || null,
    updated_at: new Date().toISOString(),
  }
  if (draft.status === 'published') {
    row.published_at = new Date().toISOString()
  }
  const query = id
    ? supabase.from('blog_posts').update(row).eq('id', id)
    : supabase.from('blog_posts').insert(row)
  const { error } = await query
  if (error) throw new Error(error.message)
}

export async function adminDeletePost(id: string): Promise<void> {
  const { error } = await supabase.from('blog_posts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Fire the Vercel deploy hook so the prerendered/SEO build regenerates. */
export async function adminTriggerDeploy(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action: 'trigger-deploy' }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || 'Deploy failed')
  }
}
