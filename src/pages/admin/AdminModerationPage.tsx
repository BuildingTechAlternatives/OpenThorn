import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { adminSetPublishBanned } from '../../lib/admin'
import styles from './AdminModerationPage.module.css'

interface ModerationPost {
  id: string
  user_id: string
  title: string
  description: string | null
  author_name: string
  likes_count: number
  published_at: string
  hidden: boolean
  featured: boolean
}

export default function AdminModerationPage() {
  const [posts, setPosts] = useState<ModerationPost[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('community_posts')
      .select('id, user_id, title, description, author_name, likes_count, published_at, hidden, featured')
      .order('featured', { ascending: false })
      .order('published_at', { ascending: false })
    if (err) {
      setError(err.message)
    } else {
      setPosts((data ?? []) as ModerationPost[])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return posts
    return posts.filter(p =>
      p.title.toLowerCase().includes(q) || p.author_name.toLowerCase().includes(q),
    )
  }, [posts, query])

  const run = useCallback(async (id: string, fn: () => Promise<void>) => {
    setBusyId(id)
    setError(null)
    try {
      await fn()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusyId(null)
      setDeleteConfirmId(null)
    }
  }, [load])

  const setFlag = useCallback(async (id: string, patch: Partial<Pick<ModerationPost, 'hidden' | 'featured'>>) => {
    const { error: err } = await supabase.from('community_posts').update(patch).eq('id', id)
    if (err) throw new Error(err.message)
  }, [])

  const deletePost = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('community_posts').delete().eq('id', id)
    if (err) throw new Error(err.message)
  }, [])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Community moderation</h1>
        <input
          className={styles.search}
          type="search"
          placeholder="Search by title or author…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </header>

      {error && <div className={styles.error} role="alert">{error}</div>}
      {loading && <p className={styles.muted}>Loading posts…</p>}
      {!loading && filtered.length === 0 && <p className={styles.muted}>No posts match.</p>}

      <div className={styles.list}>
        {filtered.map(post => {
          const busy = busyId === post.id
          return (
            <article key={post.id} className={`${styles.card} ${post.hidden ? styles.cardHidden : ''}`}>
              <div className={styles.cardMain}>
                <div className={styles.cardTitleRow}>
                  <h2 className={styles.cardTitle}>{post.title}</h2>
                  {post.featured && <span className={`${styles.badge} ${styles.badgeAccent}`}>featured</span>}
                  {post.hidden && <span className={`${styles.badge} ${styles.badgeDanger}`}>hidden</span>}
                </div>
                {post.description && <p className={styles.cardDesc}>{post.description}</p>}
                <p className={styles.cardMeta}>
                  by {post.author_name} · {post.likes_count} likes ·{' '}
                  {new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.btn}
                  disabled={busy}
                  onClick={() => run(post.id, () => setFlag(post.id, { featured: !post.featured }))}
                >
                  {post.featured ? 'Unfeature' : 'Feature'}
                </button>
                <button
                  type="button"
                  className={styles.btn}
                  disabled={busy}
                  onClick={() => run(post.id, () => setFlag(post.id, { hidden: !post.hidden }))}
                >
                  {post.hidden ? 'Unhide' : 'Hide'}
                </button>
                <button
                  type="button"
                  className={styles.btn}
                  disabled={busy}
                  onClick={() => run(post.id, () => adminSetPublishBanned(post.user_id, true))}
                >
                  Ban author
                </button>
                {deleteConfirmId === post.id ? (
                  <>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnDanger}`}
                      disabled={busy}
                      onClick={() => run(post.id, () => deletePost(post.id))}
                    >
                      Confirm delete
                    </button>
                    <button type="button" className={styles.btn} onClick={() => setDeleteConfirmId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnDanger}`}
                    disabled={busy}
                    onClick={() => setDeleteConfirmId(post.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
