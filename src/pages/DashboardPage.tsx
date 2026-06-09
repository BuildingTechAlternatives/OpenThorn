import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { usePageTitle } from '../lib/usePageTitle'
import type { AgentThinkingLevel } from '../lib/agent-thinking'
import DashboardSidebar, { type ProjectFilter, type SidebarNotification } from '../components/DashboardSidebar/DashboardSidebar'
import PromptInput from '../components/PromptInput/PromptInput'
import FloatingParticles from '../components/FloatingParticles/FloatingParticles'
import type { SelectedModel } from '../components/ModelSelector/ModelSelector'
import styles from './DashboardPage.module.css'

interface Project {
  id: string
  user_id: string
  title: string
  preview_url: string | null
  netlify_site_id: string | null
  created_at: string
  updated_at: string
  starred: boolean
  isShared?: boolean
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
  '#7c6af7', // violet
  '#4f9cf9', // blue
  '#34c98a', // teal
  '#f97b4f', // orange
  '#e05ae0', // pink
  '#f7c048', // amber
  '#5ec7f7', // sky
  '#a78bfa', // lavender
]

function projectAccentColor(title: string): string {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) >>> 0
  }
  return ACCENT_COLORS[hash % ACCENT_COLORS.length]
}

const examplePrompts = [
  { title: 'Portfolio', prompt: 'Design a sleek portfolio website for a photographer with a dark, cinematic feel and fullscreen image galleries' },
  { title: 'SaaS Landing Page', prompt: 'Build a modern landing page for a SaaS startup with hero, features, pricing, and a waitlist signup form' },
  { title: 'Restaurant Menu', prompt: 'Create a restaurant website with an interactive menu, online ordering, reservations, and location map' },
  { title: 'Personal Blog', prompt: 'Build a personal blog with a clean minimalist design, article pages, tags, and a newsletter signup' },
  { title: 'Task Dashboard', prompt: 'Create a task management dashboard with kanban boards, calendar view, team collaboration, and analytics' },
  { title: 'Online Course', prompt: 'Build an online course platform with video lessons, progress tracking, quizzes, and student discussion forums' },
  { title: 'Marketplace', prompt: 'Design a marketplace with product listings, search filters, shopping cart, checkout flow, and seller profiles' },
  { title: 'Event Booking', prompt: 'Create an event booking platform with calendar scheduling, ticket types, payment processing, and attendee management' },
]

const INITIAL_VISIBLE = 4

export default function DashboardPage() {
  usePageTitle('Dashboard', {
    description: 'Create, manage, search, publish, and deploy your OpenThorn projects.',
  })
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = (location.state ?? {}) as { activeFilter?: ProjectFilter; scrollToProjects?: boolean }
  const [promptDefault, setPromptDefault] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [showAllPrompts, setShowAllPrompts] = useState(false)
  const [activeFilter, setActiveFilter] = useState<ProjectFilter>(locationState.activeFilter ?? 'all')
  const projectsSectionRef = useRef<HTMLElement>(null)
  const [modelError, setModelError] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ projectId: string; x: number; y: number } | null>(null)
  const [renamingProject, setRenamingProject] = useState<{ id: string; title: string } | null>(null)
  const [sidebarNotifications, setSidebarNotifications] = useState<SidebarNotification[]>([])
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'starred'>('recent')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [publishingProject, setPublishingProject] = useState<{ id: string; title: string; previewUrl: string | null } | null>(null)
  const [publishDescription, setPublishDescription] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null)
  const [hasEnabledProvider, setHasEnabledProvider] = useState(false)
  const [checklistModel, setChecklistModel] = useState<SelectedModel | null>(() => {
    try {
      const stored = localStorage.getItem('dashboard:selectedModel')
      return stored ? (JSON.parse(stored) as SelectedModel) : null
    } catch {
      return null
    }
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const visiblePrompts = showAllPrompts ? examplePrompts : examplePrompts.slice(0, INITIAL_VISIBLE)

  // Scroll to projects section when navigating here with scrollToProjects flag
  useEffect(() => {
    if (locationState.scrollToProjects && projectsSectionRef.current) {
      const timer = setTimeout(() => {
        projectsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [location.key])

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there'

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenu])

  // Fetch owned + shared projects with real-time sync
  useEffect(() => {
    if (!user) return

    const SEEN_KEY = `seen_shared_projects_${user.id}`

    const fetchProjects = async () => {
      // Owned projects
      const { data: owned } = await supabase
        .from('projects')
        .select('id, user_id, title, preview_url, netlify_site_id, created_at, updated_at, starred')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      // Shared projects — look up via collaborator records
      const { data: collabRows } = await supabase
        .from('project_collaborators')
        .select('project_id')
        .eq('user_id', user.id)

      let shared: Project[] = []
      if (collabRows && collabRows.length > 0) {
        const ids = collabRows.map((r) => r.project_id as string)
        const { data: sharedData } = await supabase
          .from('projects')
          .select('id, user_id, title, preview_url, netlify_site_id, created_at, updated_at, starred')
          .in('id', ids)
          .order('created_at', { ascending: false })
        shared = (sharedData ?? []).map((p) => ({ ...p, isShared: true }))
      }

      // Merge, deduplicate by id
      const seenIds = new Set<string>()
      const all: Project[] = []
      for (const p of [...(owned ?? []), ...shared]) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id)
          all.push(p)
        }
      }
      setProjects(all)
      setProjectsLoading(false)

      // Notify about shared projects the user hasn't seen yet — persists across refreshes
      if (shared.length > 0) {
        const notifiedIds: string[] = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')
        const notifiedSet = new Set(notifiedIds)
        const novel = shared.filter((p) => !notifiedSet.has(p.id))
        if (novel.length > 0) {
          setSidebarNotifications((prev) => {
            const existingIds = new Set(prev.map((n) => n.id))
            const newItems = novel
              .map((p) => ({
                id: `share-${p.id}`,
                text: `"${p.title}" was shared with you.`,
                time: 'New',
                unread: true,
              }))
              .filter((n) => !existingIds.has(n.id))
            return newItems.length > 0 ? [...newItems, ...prev] : prev
          })
        }
      }
    }

    fetchProjects()

    // Watch owned project changes
    const ownedChannel = supabase
      .channel('projects_owned')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: `user_id=eq.${user.id}`,
      }, () => { fetchProjects() })
      .subscribe()

    // Watch for new shares directed at this user
    const sharedChannel = supabase
      .channel(`projects_shared_${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'project_collaborators',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchProjects()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(ownedChannel)
      supabase.removeChannel(sharedChannel)
    }
  }, [user])

  useEffect(() => {
    if (!user) return

    let cancelled = false

    const fetchProviderStatus = async () => {
      const { data } = await supabase
        .from('provider_keys')
        .select('id')
        .eq('user_id', user.id)
        .eq('enabled', true)
        .limit(1)

      if (!cancelled) setHasEnabledProvider(Boolean(data?.length))
    }

    fetchProviderStatus()

    const channel = supabase
      .channel(`dashboard_provider_status_${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'provider_keys',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchProviderStatus()
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [user])

  // Fetch global notifications from Supabase (controlled in production via dashboard)
  useEffect(() => {
    if (!user) return
    supabase
      .from('notifications')
      .select('id, text, time_label, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data || data.length === 0) return
        setSidebarNotifications((prev) => {
          const existingIds = new Set(prev.map((n) => n.id))
          const incoming = data
            .map((n) => ({ id: n.id as string, text: n.text as string, time: n.time_label as string }))
            .filter((n) => !existingIds.has(n.id))
          return incoming.length > 0 ? [...prev, ...incoming] : prev
        })
      })
  }, [user])

  const handlePromptSubmit = useCallback(async (
    prompt: string,
    selectedModel: SelectedModel | null,
    thinkingLevel: AgentThinkingLevel,
  ): Promise<boolean> => {
    if (!selectedModel) {
      setModelError(true)
      setTimeout(() => setModelError(false), 3000)
      return false
    }
    setModelError(false)

    const projectId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `draft-${Date.now()}`

    const title = prompt
      .replace(/^(build|create|design|make)\s+/i, '')
      .split(/[.,-]/)[0]
      .trim()
      .slice(0, 54) || 'Untitled project'

    // Save project to Supabase
    if (user) {
      const { error } = await supabase
        .from('projects')
        .upsert({
          id: projectId,
          user_id: user.id,
          title,
          preview_url: null,
          created_at: new Date().toISOString(),
        }, { onConflict: 'id' })

      if (error) {
        console.error('Failed to save project:', error.message)
      }
    }

    navigate(`/projects/${projectId}`, {
      state: { prompt, title, selectedModel, thinkingLevel },
    })
    return true
  }, [navigate, user])

  const handleDeleteProject = useCallback(async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setContextMenu(null)
    if (!user) return
    const { error } = await supabase.from('projects').delete().eq('id', projectId).eq('user_id', user.id)
    if (error) console.error('Failed to delete project:', error.message)
    setProjects((prev) => prev.filter((p) => p.id !== projectId))
  }, [user])

  const handleRenameStart = useCallback((project: Project, e: React.MouseEvent) => {
    e.stopPropagation()
    setContextMenu(null)
    setRenamingProject({ id: project.id, title: project.title })
  }, [])

  const handleRenameSubmit = useCallback(async () => {
    if (!renamingProject || !user) return
    const newTitle = renamingProject.title.trim() || 'Untitled project'
    const { error } = await supabase
      .from('projects')
      .update({ title: newTitle })
      .eq('id', renamingProject.id)
      .eq('user_id', user.id)
    if (error) {
      console.error('Failed to rename project:', error.message)
    } else {
      setProjects((prev) => prev.map((p) => p.id === renamingProject.id ? { ...p, title: newTitle } : p))
    }
    setRenamingProject(null)
  }, [renamingProject, user])

  const handleOpenInNewTab = useCallback((projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setContextMenu(null)
    window.open(`/projects/${projectId}`, '_blank')
  }, [])

  const handlePublishStart = useCallback((project: Project, e: React.MouseEvent) => {
    e.stopPropagation()
    setContextMenu(null)
    setPublishDescription('')
    setPublishingProject({ id: project.id, title: project.title, previewUrl: project.preview_url })
  }, [])

  const handlePublishSubmit = useCallback(async () => {
    if (!publishingProject || !user || publishing) return
    setPublishing(true)

    const { data: projectData, error: fetchError } = await supabase
      .from('projects')
      .select('files')
      .eq('id', publishingProject.id)
      .single()

    if (fetchError) {
      console.error('Failed to fetch project files:', fetchError.message)
      setPublishing(false)
      return
    }

    const authorName =
      user.user_metadata?.full_name ??
      user.email?.split('@')[0] ??
      'Anonymous'

    const { error } = await supabase.from('community_posts').insert({
      project_id: publishingProject.id,
      user_id: user.id,
      title: publishingProject.title,
      description: publishDescription.trim() || null,
      preview_url: publishingProject.previewUrl,
      author_name: authorName,
      files_snapshot: (projectData?.files ?? []) as unknown as Record<string, unknown>[],
    })

    setPublishing(false)
    if (error) {
      console.error('Failed to publish:', error.message)
      return
    }
    setPublishingProject(null)
    setPublishSuccess(publishingProject.title)
    setTimeout(() => setPublishSuccess(null), 3000)
  }, [publishingProject, publishDescription, user, publishing])

  const handleStarToggle = useCallback(async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) return
    const project = projects.find((p) => p.id === projectId)
    if (!project) return
    const newStarred = !project.starred
    setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, starred: newStarred } : p))
    const { error } = await supabase
      .from('projects')
      .update({ starred: newStarred })
      .eq('id', projectId)
      .eq('user_id', user.id)
    if (error) {
      console.error('Failed to update starred:', error.message)
      setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, starred: !newStarred } : p))
    }
  }, [projects, user])

  const handleExampleClick = (prompt: string) => {
    setPromptDefault(prompt)
  }

  const filteredProjects = projects
    .filter((p) => {
      if (activeFilter === 'starred') return p.starred
      if (activeFilter === 'mine') return p.user_id === user?.id
      if (activeFilter === 'shared') return p.isShared === true
      return true
    })
    .filter((p) => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.title.localeCompare(b.title)
      if (sortBy === 'starred') return Number(b.starred) - Number(a.starred)
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })

  const filterLabel =
    activeFilter === 'starred' ? 'Starred projects'
    : activeFilter === 'mine' ? 'Created by me'
    : activeFilter === 'shared' ? 'Shared with me'
    : 'Your projects'

  if (authLoading) return null

  const hasProjects = !projectsLoading && projects.length > 0
  const deployedProject = projects.find((p) => p.netlify_site_id)
  const firstProject = projects[0]
  const focusPrompt = () => {
    document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Describe your website idea"]')?.focus()
  }
  const onboardingItems = [
    {
      label: 'Add provider',
      complete: hasEnabledProvider,
      action: 'Providers',
      onClick: () => navigate('/providers'),
    },
    {
      label: 'Choose model',
      complete: Boolean(checklistModel),
      action: 'Select',
      onClick: focusPrompt,
    },
    {
      label: 'Create project',
      complete: hasProjects,
      action: 'Start',
      onClick: focusPrompt,
    },
    {
      label: 'Deploy',
      complete: Boolean(deployedProject),
      action: firstProject ? 'Open' : 'Start',
      onClick: () => firstProject ? navigate(`/projects/${firstProject.id}`) : focusPrompt(),
    },
  ]
  const onboardingComplete = onboardingItems.every((item) => item.complete)

  return (
    <>
      <div className={styles.root}>
      <FloatingParticles
        particleCount={30}
        particleSize={2}
        particleOpacity={0.25}
        particleColor="#A78BFA"
        glowIntensity={10}
        movementSpeed={0.25}
        mouseInfluence={100}
        mouseGravity="attract"
        gravityStrength={20}
        glowAnimation="ease"
      />
      <DashboardSidebar
        projects={projects}
        activeFilter={activeFilter}
        onProjectFilterChange={setActiveFilter}
        notifications={sidebarNotifications}
        onNotificationsRead={() => {
          setSidebarNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
          const seenKey = `seen_shared_projects_${user?.id}`
          const sharedIds = projects.filter((p) => p.isShared).map((p) => p.id)
          const existing: string[] = JSON.parse(localStorage.getItem(seenKey) ?? '[]')
          localStorage.setItem(seenKey, JSON.stringify([...new Set([...existing, ...sharedIds])]))
        }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

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

      <main className={`${styles.main} ${hasProjects ? styles.mainWithProjects : ''}`}>
        <div className={styles.content}>
          {/* Hero area — centered when no projects */}
          <div className={styles.hero}>
            <h1 className={styles.greeting}>
              What do you want to build, <span className={styles.name}>{firstName}</span>?
            </h1>

            <div className={styles.promptWrapper}>
              <PromptInput
                defaultValue={promptDefault}
                onSubmit={handlePromptSubmit}
                initialModel={checklistModel}
                onModelChange={(model) => {
                  setChecklistModel(model)
                  try {
                    if (model) localStorage.setItem('dashboard:selectedModel', JSON.stringify(model))
                    else localStorage.removeItem('dashboard:selectedModel')
                  } catch { /* ignore */ }
                }}
                page="dashboard"
              />
              {modelError && (
                <p className={styles.modelError}>Please select a model first.</p>
              )}
            </div>

            <div className={styles.examples}>
              {visiblePrompts.map((item) => (
                <button
                  key={item.title}
                  className={styles.exampleChip}
                  onClick={() => handleExampleClick(item.prompt)}
                  type="button"
                >
                  {item.title}
                </button>
              ))}
              {!showAllPrompts && examplePrompts.length > INITIAL_VISIBLE && (
                <button
                  className={`${styles.exampleChip} ${styles.moreChip}`}
                  onClick={() => setShowAllPrompts(true)}
                  type="button"
                >
                  More…
                </button>
              )}
            </div>

            {!onboardingComplete && (
              <section className={styles.onboardingCard} aria-label="Launch checklist">
                <div className={styles.onboardingHeader}>
                  <span className={styles.onboardingEyebrow}>Launch checklist</span>
                  <span className={styles.onboardingProgress}>
                    {onboardingItems.filter((item) => item.complete).length}/{onboardingItems.length}
                  </span>
                </div>
                <div className={styles.onboardingItems}>
                  {onboardingItems.map((item) => (
                    <button
                      key={item.label}
                      className={`${styles.onboardingItem} ${item.complete ? styles.onboardingItemDone : ''}`}
                      type="button"
                      onClick={item.onClick}
                    >
                      <span className={styles.onboardingCheck} aria-hidden="true">
                        {item.complete ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <span />
                        )}
                      </span>
                      <span>{item.label}</span>
                      <span className={styles.onboardingAction}>{item.complete ? 'Done' : item.action}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Projects section */}
          <section ref={projectsSectionRef} className={styles.projectsSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{filterLabel}</h2>
              <div className={styles.controls}>
                <div className={styles.searchWrapper}>
                  <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    className={styles.searchInput}
                    type="text"
                    placeholder="Search projects…"
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
                  onChange={(e) => setSortBy(e.target.value as 'recent' | 'name' | 'starred')}
                  aria-label="Sort projects"
                >
                  <option value="recent">Recent</option>
                  <option value="name">Name</option>
                  <option value="starred">Starred</option>
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
            </div>

            {projectsLoading ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>Loading projects…</p>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <line x1="3" y1="9" x2="21" y2="9"/>
                    <line x1="9" y1="21" x2="9" y2="9"/>
                  </svg>
                </div>
                <h3 className={styles.emptyTitle}>
                  {searchQuery
                    ? 'No projects match'
                    : activeFilter === 'starred' ? 'No starred projects'
                    : 'No projects yet'}
                </h3>
                <p className={styles.emptyText}>
                  {searchQuery
                    ? `No projects found for "${searchQuery}". Try a different search.`
                    : activeFilter === 'starred'
                    ? 'Star a project to find it here quickly.'
                    : 'Describe what you want to build above and hit Send to create your first project.'}
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className={styles.projectGrid}>
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className={styles.projectCard}
                    role="button"
                    tabIndex={0}
                    style={{ '--accent': projectAccentColor(project.title) } as React.CSSProperties}
                    onClick={() => navigate(`/projects/${project.id}`, { state: { title: project.title } })}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/projects/${project.id}`, { state: { title: project.title } }) }}
                  >
                    <div className={styles.projectAccentBar} />
                    <div className={styles.projectPreview}>
                      {project.preview_url ? (
                        <img
                          src={project.preview_url}
                          alt={project.title}
                          className={styles.projectPreviewImg}
                          draggable={false}
                        />
                      ) : (
                        <div className={styles.projectPlaceholder}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className={styles.projectMeta}>
                      {renamingProject?.id === project.id ? (
                        <input
                          className={styles.renameInput}
                          value={renamingProject.title}
                          onChange={(e) => setRenamingProject({ ...renamingProject, title: e.target.value })}
                          onBlur={() => handleRenameSubmit()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSubmit()
                            if (e.key === 'Escape') setRenamingProject(null)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <h3 className={styles.projectTitle}>{project.title}</h3>
                      )}
                      <div className={styles.projectFooter}>
                        <span className={styles.projectDate}>
                          {formatRelativeTime(project.updated_at)}
                        </span>
                        {project.isShared && (
                          <span className={styles.sharedBadge}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                            </svg>
                            Shared
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className={`${styles.starBtn} ${project.starred ? styles.starBtnActive : ''}`}
                      type="button"
                      aria-label={project.starred ? 'Unstar project' : 'Star project'}
                      onClick={(e) => handleStarToggle(project.id, e)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill={project.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                    </button>
                    <button
                      className={styles.contextMenuBtn}
                      type="button"
                      aria-label="Project actions"
                      onClick={(e) => {
                        e.stopPropagation()
                        setContextMenu(contextMenu?.projectId === project.id ? null : { projectId: project.id, x: e.clientX, y: e.clientY })
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <circle cx="8" cy="3" r="1.5" />
                        <circle cx="8" cy="8" r="1.5" />
                        <circle cx="8" cy="13" r="1.5" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.projectList}>
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className={styles.projectListRow}
                    role="button"
                    tabIndex={0}
                    style={{ '--accent': projectAccentColor(project.title) } as React.CSSProperties}
                    onClick={() => navigate(`/projects/${project.id}`, { state: { title: project.title } })}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/projects/${project.id}`, { state: { title: project.title } }) }}
                  >
                    <div className={styles.listRowAccent} />
                    <div className={styles.listRowMain}>
                      {renamingProject?.id === project.id ? (
                        <input
                          className={styles.renameInput}
                          value={renamingProject.title}
                          onChange={(e) => setRenamingProject({ ...renamingProject, title: e.target.value })}
                          onBlur={() => handleRenameSubmit()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSubmit()
                            if (e.key === 'Escape') setRenamingProject(null)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <span className={styles.listRowTitle}>{project.title}</span>
                      )}
                    </div>
                    <div className={styles.listRowMeta}>
                      {project.isShared && (
                        <span className={styles.sharedBadge}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                          </svg>
                          Shared
                        </span>
                      )}
                      <span className={styles.listRowDate}>{formatRelativeTime(project.updated_at)}</span>
                    </div>
                    <div className={styles.listRowActions}>
                      <button
                        className={`${styles.starBtn} ${project.starred ? styles.starBtnActive : ''}`}
                        type="button"
                        aria-label={project.starred ? 'Unstar project' : 'Star project'}
                        onClick={(e) => handleStarToggle(project.id, e)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={project.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      </button>
                      <button
                        className={styles.contextMenuBtn}
                        type="button"
                        aria-label="Project actions"
                        onClick={(e) => {
                          e.stopPropagation()
                          setContextMenu(contextMenu?.projectId === project.id ? null : { projectId: project.id, x: e.clientX, y: e.clientY })
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <circle cx="8" cy="3" r="1.5" />
                          <circle cx="8" cy="8" r="1.5" />
                          <circle cx="8" cy="13" r="1.5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Context menu */}
          {contextMenu && (
            <div
              ref={contextMenuRef}
              className={styles.contextMenu}
              style={{ top: contextMenu.y, left: contextMenu.x }}
            >
              <button
                type="button"
                onClick={(e) => {
                  handleStarToggle(contextMenu.projectId, e)
                  setContextMenu(null)
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={projects.find((p) => p.id === contextMenu.projectId)?.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: projects.find((p) => p.id === contextMenu.projectId)?.starred ? '#f59e0b' : undefined }}>
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                {projects.find((p) => p.id === contextMenu.projectId)?.starred ? 'Unstar' : 'Star'}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  const project = projects.find((p) => p.id === contextMenu.projectId)
                  if (project) handleRenameStart(project, e)
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Rename
              </button>
              <button
                type="button"
                onClick={(e) => {
                  const project = projects.find((p) => p.id === contextMenu.projectId)
                  if (project) handleOpenInNewTab(project.id, e)
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg>
                Open in new tab
              </button>
              <button
                type="button"
                onClick={(e) => {
                  const project = projects.find((p) => p.id === contextMenu.projectId)
                  if (project) handlePublishStart(project, e)
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Publish to Community
              </button>
              <hr className={styles.contextMenuDivider} />
              <button
                type="button"
                className={styles.contextMenuDanger}
                onClick={(e) => handleDeleteProject(contextMenu.projectId, e)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                Delete
              </button>
            </div>
          )}
        </div>
      </main>

    </div>

    {/* Publish to Community modal — outside root to avoid overflow:hidden stacking context */}
    {publishingProject && (
        <div className={styles.publishBackdrop} onClick={(e) => { if (e.target === e.currentTarget) setPublishingProject(null) }}>
          <div className={styles.publishModal}>
            <button className={styles.publishClose} type="button" onClick={() => setPublishingProject(null)} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <h2 className={styles.publishTitle}>Publish to Community</h2>
            <p className={styles.publishSubtitle}>
              Share <strong>{publishingProject.title}</strong> with the OpenThorn community.
            </p>
            <label className={styles.publishLabel}>
              Description <span className={styles.publishOptional}>(optional)</span>
            </label>
            <textarea
              className={styles.publishTextarea}
              placeholder="What did you build? Add a short description…"
              value={publishDescription}
              onChange={(e) => setPublishDescription(e.target.value)}
              rows={3}
              maxLength={280}
            />
            <button
              className={styles.publishBtn}
              type="button"
              onClick={handlePublishSubmit}
              disabled={publishing}
            >
              {publishing ? 'Publishing…' : 'Publish →'}
            </button>
          </div>
        </div>
      )}

      {/* Success toast */}
      {publishSuccess && (
        <div className={styles.publishToast}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          "{publishSuccess}" published to Community
        </div>
      )}
    </>
  )
}
