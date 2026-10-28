import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { usePageTitle } from '../lib/usePageTitle'
import type { AgentCodeFile } from '../lib/agent'
import DashboardSidebar from '../components/DashboardSidebar/DashboardSidebar'
import ModelSelector, { type SelectedModel } from '../components/ModelSelector/ModelSelector'
import styles from './CommunityPage.module.css'

interface CommunityPost {
  id: string
  project_id: string
  user_id: string
  title: string
  description: string | null
  preview_url: string | null
  author_name: string
  files_snapshot: AgentCodeFile[]
  likes_count: number
  published_at: string
  hidden: boolean
  featured: boolean
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const ACCENT_COLORS = [
  '#7c6af7', '#4f9cf9', '#34c98a', '#f97b4f',
  '#e05ae0', '#f7c048', '#5ec7f7', '#a78bfa',
]

function postAccentColor(title: string): string {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) >>> 0
  }
  return ACCENT_COLORS[hash % ACCENT_COLORS.length]
}

export default function CommunityPage() {
  usePageTitle('Community', {
    description: 'Browse and remix websites shared by the OpenThorn community.',
  })
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'likes'>('recent')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selected, setSelected] = useState<CommunityPost | null>(null)
  const [selectedModel, setSelectedModel] = useState<SelectedModel | null>(null)
  const [launching, setLaunching] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('community_posts')
      .select('*')
      .order('featured', { ascending: false })
      .order('published_at', { ascending: false })
      .then(({ data }) => {
        setPosts((data ?? []) as CommunityPost[])
        setPostsLoading(false)
      })
  }, [user])

  useEffect(() => {
    if (!user) return
    supabase
      .from('community_likes')
      .select('post_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setLikedSet(new Set(data.map((r) => r.post_id as string)))
      })
  }, [user])

  useEffect(() => {
    if (selected) {
      setEditMode(false)
      setDeleteConfirm(false)
      setEditTitle(selected.title)
      setEditDesc(selected.description ?? '')
    }
  }, [selected?.id])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const handleLikeToggle = useCallback(async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) return
    const isLiked = likedSet.has(postId)

    setLikedSet((prev) => {
      const next = new Set(prev)
      if (isLiked) {
        next.delete(postId)
      } else {
        next.add(postId)
      }
      return next
    })
    setPosts((prev) => prev.map((p) => p.id === postId
      ? { ...p, likes_count: Math.max(0, p.likes_count + (isLiked ? -1 : 1)) }
      : p
    ))

    if (isLiked) {
      await supabase.from('community_likes').delete()
        .eq('user_id', user.id).eq('post_id', postId)
    } else {
      await supabase.from('community_likes').insert({ user_id: user.id, post_id: postId })
    }
  }, [user, likedSet])

  const handleEditSave = useCallback(async () => {
    if (!selected || !user) return
    const trimTitle = editTitle.trim()
    if (!trimTitle) return
    setSaving(true)
    const { error } = await supabase
      .from('community_posts')
      .update({ title: trimTitle, description: editDesc.trim() || null })
      .eq('id', selected.id)
    if (!error) {
      const updated = { ...selected, title: trimTitle, description: editDesc.trim() || null }
      setPosts((prev) => prev.map((p) => p.id === selected.id ? updated : p))
      setSelected(updated)
      setEditMode(false)
    }
    setSaving(false)
  }, [selected, user, editTitle, editDesc])

  const handleDeletePost = useCallback(async () => {
    if (!selected || !user) return
    const { error } = await supabase.from('community_posts').delete().eq('id', selected.id)
    if (!error) {
      setPosts((prev) => prev.filter((p) => p.id !== selected.id))
      setSelected(null)
    }
  }, [selected, user])

  const handleUseProject = useCallback(async () => {
    if (!user || !selected) return
    setLaunching(true)
    const projectId = crypto.randomUUID()

    const { error } = await supabase.from('projects').upsert({
      id: projectId,
      user_id: user.id,
      title: selected.title,
      preview_url: selected.preview_url,
      created_at: new Date().toISOString(),
    }, { onConflict: 'id' })

    if (error) {
      console.error('Failed to fork project:', error.message)
      setLaunching(false)
      return
    }

    navigate(`/projects/${projectId}`, {
      state: {
        title: selected.title,
        templateFiles: selected.files_snapshot,
        isTemplate: true,
        templateName: selected.title,
        selectedModel,
        thinkingLevel: 'medium',
      },
    })
  }, [user, selected, selectedModel, navigate])

  const filteredPosts = posts
    .filter((p) =>
      !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.author_name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      // Featured posts stay on top in both sort modes.
      const byFeatured = Number(b.featured) - Number(a.featured)
      if (byFeatured !== 0) return byFeatured
      if (sortBy === 'likes') return b.likes_count - a.likes_count
      return new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    })

  if (loading) return null

  return (
    <>
      <div className={styles.root}>
      <DashboardSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={styles.mobileTopbar}>
        <button
          className={styles.mobileMenuBtn}
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          type="button"
        >
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <a href="/dashboard" className={styles.mobileLogo}>
          <img src="/assets/logo.png" alt="OpenThorn" className={styles.mobileLogoImg} />
        </a>
      </div>

      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.heading}>Community</h1>
          <p className={styles.subheading}>Projects built and shared by the OpenThorn community.</p>
        </div>

        <div className={styles.controls}>
          <div className={styles.searchWrapper}>
            <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search projects or authors…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className={styles.searchClear} type="button" onClick={() => setSearchQuery('')} aria-label="Clear search">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          <select
            className={styles.sortSelect}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'recent' | 'likes')}
            aria-label="Sort posts"
          >
            <option value="recent">Recent</option>
            <option value="likes">Most Liked</option>
          </select>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewBtnActive : ''}`}
              type="button"
              aria-label="Grid view"
              onClick={() => setViewMode('grid')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </button>
            <button
              className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`}
              type="button"
              aria-label="List view"
              onClick={() => setViewMode('list')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {postsLoading ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>Loading community projects…</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h3 className={styles.emptyTitle}>
              {searchQuery ? 'No projects match' : 'No community projects yet'}
            </h3>
            <p className={styles.emptyText}>
              {searchQuery
                ? `No projects found for "${searchQuery}".`
                : 'Be the first to publish a project from your dashboard.'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className={styles.grid}>
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                className={styles.card}
                role="button"
                tabIndex={0}
                style={{ '--accent': postAccentColor(post.title) } as React.CSSProperties}
                onClick={() => { setSelected(post); setSelectedModel(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { setSelected(post); setSelectedModel(null) } }}
              >
                <div className={styles.cardAccentBar} />
                <div className={styles.cardPreview}>
                  {post.preview_url ? (
                    <img src={post.preview_url} alt={post.title} className={styles.cardPreviewImg} draggable={false} />
                  ) : (
                    <div className={styles.cardPlaceholder}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                    </div>
                  )}
                  <div className={styles.cardOverlay}>
                    <button className={styles.previewBtn} type="button" tabIndex={-1}>Preview</button>
                  </div>
                </div>
                <div className={styles.cardMeta}>
                  <h3 className={styles.cardTitle}>
                    {post.title}
                    {post.featured && <span className={styles.featuredBadge}>Featured</span>}
                  </h3>
                  <div className={styles.cardFooter}>
                    <div className={styles.authorRow}>
                      <div className={styles.authorAvatar}>{post.author_name.charAt(0).toUpperCase()}</div>
                      <span className={styles.authorName}>{post.author_name}</span>
                    </div>
                    <button
                      className={`${styles.likeBtn} ${likedSet.has(post.id) ? styles.likeBtnActive : ''}`}
                      type="button"
                      aria-label={likedSet.has(post.id) ? 'Unlike' : 'Like'}
                      onClick={(e) => handleLikeToggle(post.id, e)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill={likedSet.has(post.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                      <span>{post.likes_count}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.list}>
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                className={styles.listRow}
                role="button"
                tabIndex={0}
                style={{ '--accent': postAccentColor(post.title) } as React.CSSProperties}
                onClick={() => { setSelected(post); setSelectedModel(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { setSelected(post); setSelectedModel(null) } }}
              >
                <div className={styles.listRowAccent} />
                <div className={styles.listRowMain}>
                  <span className={styles.listRowTitle}>{post.title}</span>
                </div>
                <div className={styles.listRowMeta}>
                  <div className={styles.authorRow}>
                    <div className={styles.authorAvatar}>{post.author_name.charAt(0).toUpperCase()}</div>
                    <span className={styles.authorName}>{post.author_name}</span>
                  </div>
                  <span className={styles.listRowDate}>{formatRelativeTime(post.published_at)}</span>
                </div>
                <div className={styles.listRowActions}>
                  <button
                    className={`${styles.likeBtn} ${likedSet.has(post.id) ? styles.likeBtnActive : ''}`}
                    type="button"
                    aria-label={likedSet.has(post.id) ? 'Unlike' : 'Like'}
                    onClick={(e) => handleLikeToggle(post.id, e)}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill={likedSet.has(post.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    <span>{post.likes_count}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Detail overlay — same pattern as TemplatesPage */}
      </div>

      {selected && (
        <div
          className={styles.overlayBackdrop}
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null) }}
        >
          <div className={styles.overlayContent}>

            {/* Preview pane */}
            <div className={styles.overlayPreview}>
              <button
                className={styles.overlayClose}
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close preview"
              >
                ✕
              </button>
              <div className={styles.overlayImgWrapper}>
                {selected.preview_url ? (
                  <img src={selected.preview_url} alt={selected.title} className={styles.overlayImg} />
                ) : (
                  <div className={styles.overlayImgPlaceholder}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <p>No preview available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Info panel */}
            <div className={styles.overlayPanel}>
              <div className={styles.overlayAuthorRow}>
                <div className={styles.overlayAuthorAvatar}>{selected.author_name.charAt(0).toUpperCase()}</div>
                <div className={styles.overlayAuthorInfo}>
                  <span className={styles.overlayAuthorLabel}>Published by</span>
                  <span className={styles.overlayAuthorName}>{selected.author_name}</span>
                </div>
                <button
                  className={`${styles.overlayLikeBtn} ${likedSet.has(selected.id) ? styles.overlayLikeBtnActive : ''}`}
                  type="button"
                  aria-label={likedSet.has(selected.id) ? 'Unlike' : 'Like'}
                  onClick={(e) => {
                    handleLikeToggle(selected.id, e)
                    setSelected((prev) => prev ? {
                      ...prev,
                      likes_count: Math.max(0, prev.likes_count + (likedSet.has(selected.id) ? -1 : 1))
                    } : prev)
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill={likedSet.has(selected.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                  <span>{selected.likes_count}</span>
                </button>
              </div>

              {user?.id === selected.user_id && !editMode && (
                <div className={styles.ownerActions}>
                  <button
                    className={styles.ownerEditBtn}
                    type="button"
                    onClick={() => { setEditMode(true); setDeleteConfirm(false) }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit
                  </button>
                  {deleteConfirm ? (
                    <div className={styles.deleteConfirm}>
                      <span className={styles.deleteConfirmText}>Delete this post?</span>
                      <button className={styles.deleteConfirmYes} type="button" onClick={handleDeletePost}>Yes, delete</button>
                      <button className={styles.deleteConfirmNo} type="button" onClick={() => setDeleteConfirm(false)}>Cancel</button>
                    </div>
                  ) : (
                    <button
                      className={styles.ownerDeleteBtn}
                      type="button"
                      onClick={() => setDeleteConfirm(true)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6"/><path d="M14 11v6"/>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                      Delete
                    </button>
                  )}
                </div>
              )}

              {editMode ? (
                <div className={styles.editForm}>
                  <input
                    className={styles.editTitleInput}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Title"
                    maxLength={80}
                  />
                  <textarea
                    className={styles.editDescInput}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Description (optional)"
                    maxLength={280}
                    rows={3}
                  />
                  <div className={styles.editActions}>
                    <button className={styles.editSaveBtn} type="button" onClick={handleEditSave} disabled={saving || !editTitle.trim()}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button className={styles.editCancelBtn} type="button" onClick={() => setEditMode(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className={styles.overlayTitle}>{selected.title}</h2>
                  {selected.description && (
                    <p className={styles.overlayDesc}>{selected.description}</p>
                  )}
                </>
              )}

              <p className={styles.overlayDate}>Published {formatRelativeTime(selected.published_at)}</p>

              {!editMode && (
                <div className={styles.modelSection}>
                  <span className={styles.modelLabel}>Select model to use (optional)</span>
                  <ModelSelector
                    page="dashboard"
                    selectedModel={selectedModel}
                    onModelSelect={setSelectedModel}
                    placement="bottom"
                    subLayout="stacked"
                  />
                </div>
              )}

              <div className={styles.spacer} />

              {!editMode && (
                <button
                  className={styles.useBtn}
                  type="button"
                  onClick={handleUseProject}
                  disabled={launching}
                  style={{ background: postAccentColor(selected.title) }}
                >
                  {launching ? 'Starting…' : 'Use this project →'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
