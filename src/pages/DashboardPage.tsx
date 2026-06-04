import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
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
  created_at: string
  starred: boolean
  isShared?: boolean
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

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/', { replace: true })
    }
  }, [user, authLoading, navigate])

  // Fetch owned + shared projects with real-time sync
  useEffect(() => {
    if (!user) return

    const fetchProjects = async () => {
      // Owned projects
      const { data: owned } = await supabase
        .from('projects')
        .select('id, user_id, title, preview_url, created_at, starred')
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
          .select('id, user_id, title, preview_url, created_at, starred')
          .in('id', ids)
          .order('created_at', { ascending: false })
        shared = (sharedData ?? []).map((p) => ({ ...p, isShared: true }))
      }

      // Merge, deduplicate by id
      const seen = new Set<string>()
      const all: Project[] = []
      for (const p of [...(owned ?? []), ...shared]) {
        if (!seen.has(p.id)) {
          seen.add(p.id)
          all.push(p)
        }
      }
      setProjects(all)
      setProjectsLoading(false)
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
      .channel('projects_shared')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'project_collaborators',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        fetchProjects()
        const row = payload.new as { email?: string; permission?: string }
        setSidebarNotifications((prev) => [
          {
            id: `share-${Date.now()}`,
            text: `A project was shared with you (${row.permission === 'edit' ? 'edit access' : 'view-only'}).`,
            time: 'Just now',
            unread: true,
          },
          ...prev,
        ])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(ownedChannel)
      supabase.removeChannel(sharedChannel)
    }
  }, [user])

  const handlePromptSubmit = useCallback(async (prompt: string, selectedModel: SelectedModel | null): Promise<boolean> => {
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
      state: { prompt, title, selectedModel },
    })
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

  const filteredProjects = projects.filter((p) => {
    if (activeFilter === 'starred') return p.starred
    if (activeFilter === 'mine') return p.user_id === user?.id
    if (activeFilter === 'shared') return p.isShared === true
    return true
  })

  const filterLabel =
    activeFilter === 'starred' ? 'Starred projects'
    : activeFilter === 'mine' ? 'Created by me'
    : activeFilter === 'shared' ? 'Shared with me'
    : 'Your projects'

  if (authLoading) return null

  const hasProjects = !projectsLoading && projects.length > 0

  return (
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
        onNotificationsRead={() =>
          setSidebarNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
        }
      />

      <main className={`${styles.main} ${hasProjects ? styles.mainWithProjects : ''}`}>
        <div className={styles.content}>
          {/* Hero area — centered when no projects */}
          <div className={styles.hero}>
            <h1 className={styles.greeting}>
              What do you want to build, <span className={styles.name}>{firstName}</span>?
            </h1>

            <div className={styles.promptWrapper}>
              <PromptInput defaultValue={promptDefault} onSubmit={handlePromptSubmit} page="dashboard" />
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
          </div>

          {/* Projects section */}
          <section ref={projectsSectionRef} className={styles.projectsSection}>
            <h2 className={styles.sectionTitle}>{filterLabel}</h2>

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
                  {activeFilter === 'starred' ? 'No starred projects' : activeFilter === 'mine' ? 'No projects yet' : 'No projects yet'}
                </h3>
                <p className={styles.emptyText}>
                  {activeFilter === 'starred'
                    ? 'Star a project to find it here quickly.'
                    : 'Describe what you want to build above and hit Send to create your first project.'}
                </p>
              </div>
            ) : (
              <div className={styles.projectGrid}>
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className={styles.projectCard}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/projects/${project.id}`, { state: { title: project.title } })}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/projects/${project.id}`, { state: { title: project.title } }) }}
                  >
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
                      <span className={styles.projectDate}>
                        {new Date(project.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
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
  )
}
