import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  adminListPosts,
  adminSavePost,
  adminDeletePost,
  adminTriggerDeploy,
  type AdminBlogRow,
  type BlogDraft,
} from '../../lib/blog-admin'
import styles from './AdminBlogPage.module.css'

type Status = { kind: 'ok' | 'error'; text: string } | null

const EMPTY: BlogDraft = {
  slug: '', title: '', excerpt: '', content: '', date: new Date().toISOString().slice(0, 10),
  date_modified: null, cover_youtube: null, cover_image: null, og_image: null, tldr: null,
  status: 'draft',
}

function rowToDraft(r: AdminBlogRow): BlogDraft {
  return {
    slug: r.slug, title: r.title, excerpt: r.excerpt, content: r.content, date: r.date,
    date_modified: r.date_modified, cover_youtube: r.cover_youtube, cover_image: r.cover_image,
    og_image: r.og_image, tldr: r.tldr, status: r.status,
  }
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<AdminBlogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null) // null = list, '' = new
  const [draft, setDraft] = useState<BlogDraft>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  const load = useCallback(async () => {
    try { setPosts(await adminListPosts()) }
    catch (err) { setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Load failed' }) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const editing = editingId !== null
  const set = <K extends keyof BlogDraft>(k: K, v: BlogDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const openNew = () => { setDraft({ ...EMPTY, date: new Date().toISOString().slice(0, 10) }); setEditingId(''); setStatus(null) }
  const openEdit = (r: AdminBlogRow) => { setDraft(rowToDraft(r)); setEditingId(r.id); setStatus(null) }
  const closeEditor = () => { setEditingId(null); setStatus(null) }

  const save = async (publish: boolean) => {
    if (!draft.slug.trim() || !draft.title.trim()) {
      setStatus({ kind: 'error', text: 'Slug and title are required.' })
      return
    }
    setBusy(true)
    setStatus(null)
    try {
      const toSave: BlogDraft = { ...draft, status: publish ? 'published' : draft.status }
      await adminSavePost(toSave, editingId || undefined)
      if (publish) {
        try { await adminTriggerDeploy() } catch { /* post is live at runtime regardless */ }
      }
      await load()
      setStatus({ kind: 'ok', text: publish ? 'Published. Rebuild triggered for SEO.' : 'Saved.' })
      setEditingId(editingId === '' ? null : editingId)
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (r: AdminBlogRow) => {
    if (!window.confirm(`Delete "${r.title}"? This cannot be undone.`)) return
    setBusy(true)
    try { await adminDeletePost(r.id); await load() }
    catch (err) { setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Delete failed' }) }
    finally { setBusy(false) }
  }

  const redeploy = async () => {
    setBusy(true)
    try { await adminTriggerDeploy(); setStatus({ kind: 'ok', text: 'Rebuild triggered.' }) }
    catch (err) { setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Deploy failed' }) }
    finally { setBusy(false) }
  }

  if (loading) return <p className={styles.muted}>Loading posts…</p>

  if (editing) {
    return (
      <div className={styles.page}>
        <div className={styles.editorHeader}>
          <button className={styles.btn} type="button" onClick={closeEditor}>← Back</button>
          <div className={styles.editorActions}>
            <button className={styles.btn} type="button" disabled={busy} onClick={() => save(false)}>Save draft</button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" disabled={busy} onClick={() => save(true)}>
              Publish
            </button>
          </div>
        </div>
        {status && <div className={status.kind === 'ok' ? styles.ok : styles.error} role="status">{status.text}</div>}

        <div className={styles.fields}>
          <label className={styles.field}><span>Title</span>
            <input className={styles.input} value={draft.title} onChange={(e) => set('title', e.target.value)} /></label>
          <label className={styles.field}><span>Slug</span>
            <input className={styles.input} value={draft.slug} onChange={(e) => set('slug', e.target.value)} placeholder="my-post-slug" /></label>
          <label className={styles.field}><span>Publish date</span>
            <input className={styles.input} type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} /></label>
          <label className={styles.field}><span>Excerpt</span>
            <textarea className={styles.textarea} rows={2} value={draft.excerpt} onChange={(e) => set('excerpt', e.target.value)} /></label>
          <label className={styles.field}><span>TL;DR (optional)</span>
            <textarea className={styles.textarea} rows={2} value={draft.tldr ?? ''} onChange={(e) => set('tldr', e.target.value || null)} /></label>
          <div className={styles.fieldRow}>
            <label className={styles.field}><span>Cover image path (optional)</span>
              <input className={styles.input} value={draft.cover_image ?? ''} onChange={(e) => set('cover_image', e.target.value || null)} placeholder="/assets/blog_x.png" /></label>
            <label className={styles.field}><span>OG image URL (optional)</span>
              <input className={styles.input} value={draft.og_image ?? ''} onChange={(e) => set('og_image', e.target.value || null)} /></label>
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.field}><span>YouTube ID (optional)</span>
              <input className={styles.input} value={draft.cover_youtube ?? ''} onChange={(e) => set('cover_youtube', e.target.value || null)} /></label>
            <label className={styles.field}><span>Last-modified date (optional)</span>
              <input className={styles.input} type="date" value={draft.date_modified ?? ''} onChange={(e) => set('date_modified', e.target.value || null)} /></label>
          </div>
        </div>

        <div className={styles.split}>
          <textarea
            className={styles.markdownInput}
            value={draft.content}
            onChange={(e) => set('content', e.target.value)}
            placeholder="Write the post in Markdown…"
            spellCheck
          />
          <article className={styles.preview}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.content || '_Preview_'}</ReactMarkdown>
          </article>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Blog</h1>
        <div className={styles.editorActions}>
          <button className={styles.btn} type="button" disabled={busy} onClick={redeploy}>Trigger rebuild</button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={openNew}>New post</button>
        </div>
      </header>
      {status && <div className={status.kind === 'ok' ? styles.ok : styles.error} role="status">{status.text}</div>}

      <div className={styles.list}>
        {posts.length === 0 && <p className={styles.muted}>No posts yet.</p>}
        {posts.map((p) => (
          <article key={p.id} className={styles.row}>
            <div className={styles.rowMain}>
              <div className={styles.rowTitle}>
                {p.title}
                <span className={`${styles.badge} ${p.status === 'published' ? styles.badgePub : styles.badgeDraft}`}>{p.status}</span>
              </div>
              <p className={styles.rowMeta}>/{p.slug} · {p.date}</p>
            </div>
            <div className={styles.rowActions}>
              <button className={styles.btn} type="button" onClick={() => openEdit(p)}>Edit</button>
              <button className={`${styles.btn} ${styles.btnDanger}`} type="button" disabled={busy} onClick={() => remove(p)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
