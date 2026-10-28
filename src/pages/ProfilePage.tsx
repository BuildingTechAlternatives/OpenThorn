import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { usePageTitle } from '../lib/usePageTitle'
import DashboardSidebar from '../components/DashboardSidebar/DashboardSidebar'
import styles from './ProfilePage.module.css'

interface CommunityPost {
  id: string
  project_id: string
  user_id: string
  title: string
  description: string | null
  preview_url: string | null
  author_name: string
  likes_count: number
  published_at: string
}

const ACCENT_COLORS = [
  '#7c6af7', '#4f9cf9', '#34c98a', '#f97b4f',
  '#e05ae0', '#f7c048', '#5ec7f7', '#a78bfa',
]

function accentFor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  return ACCENT_COLORS[hash % ACCENT_COLORS.length]
}

function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
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

export default function ProfilePage() {
  usePageTitle('Profile', {
    description: 'View your OpenThorn profile and community activity.',
  })
  const { user } = useAuth()
  const navigate = useNavigate()

  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Name editing
  const [editing, setEditing] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    const name = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? ''
    setDisplayName(name)
  }, [user])

  useEffect(() => {
    if (!user) return
    supabase
      .from('community_posts')
      .select('id, project_id, user_id, title, description, preview_url, author_name, likes_count, published_at')
      .eq('user_id', user.id)
      .order('published_at', { ascending: false })
      .then(({ data }) => {
        setPosts((data ?? []) as CommunityPost[])
        setPostsLoading(false)
      })
  }, [user])

  useEffect(() => {
    if (editing && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [editing])

  const startEditing = () => {
    setNameValue(displayName)
    setSaveError('')
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setSaveError('')
  }

  const saveName = async () => {
    const trimmed = nameValue.trim()
    if (!trimmed || trimmed === displayName) { cancelEditing(); return }
    setSaving(true)
    setSaveError('')
    const { error: metaError } = await supabase.auth.updateUser({ data: { full_name: trimmed } })
    if (!metaError) {
      await supabase.from('profiles').update({ full_name: trimmed }).eq('id', user!.id)
    }
    setSaving(false)
    if (metaError) {
      setSaveError('Failed to save. Try again.')
    } else {
      setDisplayName(trimmed)
      setEditing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveName()
    if (e.key === 'Escape') cancelEditing()
  }

  if (!user) return null

  const initial = displayName.charAt(0).toUpperCase() || '?'
  const joinDate = user.created_at ? formatJoinDate(user.created_at) : null

  return (
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
        {/* ── Hero ── */}
        <section className={styles.hero}>
          <div className={styles.heroGlow} style={{ '--glow-color': accentFor(displayName) } as React.CSSProperties} />

          <div className={styles.avatarRing} style={{ '--ring-color': accentFor(displayName) } as React.CSSProperties}>
            <div className={styles.avatar} style={{ background: accentFor(displayName) }}>
              {initial}
            </div>
          </div>

          {/* Name row */}
          <div className={styles.nameRow}>
            {editing ? (
              <div className={styles.nameEditRow}>
                <input
                  ref={nameInputRef}
                  className={styles.nameInput}
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={60}
                  placeholder="Your name"
                />
                <button className={styles.saveBtn} onClick={saveName} disabled={saving} type="button">
                  {saving ? (
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.spinner}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                  ) : 'Save'}
                </button>
                <button className={styles.cancelBtn} onClick={cancelEditing} type="button">Cancel</button>
              </div>
            ) : (
              <>
                <h1 className={styles.name}>{displayName}</h1>
                <button className={styles.editBtn} onClick={startEditing} type="button" aria-label="Edit name">
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              </>
            )}
          </div>

          {saveError && <p className={styles.saveError}>{saveError}</p>}

          <div className={styles.meta}>
            {joinDate && (
              <span className={styles.metaItem}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Joined {joinDate}
              </span>
            )}
            <span className={styles.metaItem}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
              {postsLoading ? '—' : posts.length} published {posts.length === 1 ? 'app' : 'apps'}
            </span>
          </div>
        </section>

        {/* ── Published apps ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Published apps</h2>

          {postsLoading ? (
            <div className={styles.loadingGrid}>
              {[...Array(3)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}
            </div>
          ) : posts.length === 0 ? (
            <div className={styles.empty}>
              <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={styles.emptyIcon}>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
              <p className={styles.emptyTitle}>No published apps yet</p>
              <p className={styles.emptyText}>Apps you publish to the community will appear here.</p>
              <button className={styles.emptyAction} onClick={() => navigate('/dashboard')} type="button">
                Go to Dashboard
              </button>
            </div>
          ) : (
            <div className={styles.grid}>
              {posts.map((post) => (
                <article
                  key={post.id}
                  className={styles.card}
                  onClick={() => navigate('/community')}
                  style={{ '--accent': accentFor(post.title) } as React.CSSProperties}
                >
                  <div className={styles.cardAccentBar} />

                  <div className={styles.cardPreview}>
                    {post.preview_url ? (
                      <img src={post.preview_url} alt={post.title} className={styles.cardImg} loading="lazy" />
                    ) : (
                      <div className={styles.cardPreviewFallback}>
                        <span className={styles.cardPreviewInitial} style={{ color: accentFor(post.title) }}>
                          {post.title.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className={styles.cardBody}>
                    <h3 className={styles.cardTitle}>{post.title}</h3>
                    {post.description && (
                      <p className={styles.cardDesc}>{post.description}</p>
                    )}
                    <div className={styles.cardFooter}>
                      <span className={styles.cardTime}>{formatRelativeTime(post.published_at)}</span>
                      <span className={styles.cardLikes}>
                        <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor" stroke="none">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                        {post.likes_count}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
