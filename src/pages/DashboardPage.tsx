import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import DashboardSidebar from '../components/DashboardSidebar/DashboardSidebar'
import PromptInput from '../components/PromptInput/PromptInput'
import type { SelectedModel } from '../components/ModelSelector/ModelSelector'
import styles from './DashboardPage.module.css'

interface Project {
  id: string
  title: string
  preview_url: string | null
  created_at: string
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
  const [promptDefault, setPromptDefault] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [showAllPrompts, setShowAllPrompts] = useState(false)

  const visiblePrompts = showAllPrompts ? examplePrompts : examplePrompts.slice(0, INITIAL_VISIBLE)

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there'

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/', { replace: true })
    }
  }, [user, authLoading, navigate])

  // Fetch projects + real-time sync
  useEffect(() => {
    if (!user) return

    const fetchProjects = async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, preview_url, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setProjects(data)
      }
      setProjectsLoading(false)
    }

    fetchProjects()

    const channel = supabase
      .channel('projects_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchProjects()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  const handlePromptSubmit = useCallback(async (prompt: string, selectedModel: SelectedModel | null) => {
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

  const handleExampleClick = (prompt: string) => {
    setPromptDefault(prompt)
  }

  if (authLoading) return null

  const hasProjects = !projectsLoading && projects.length > 0

  return (
    <div className={styles.root}>
      <DashboardSidebar projects={projects} />

      <main className={`${styles.main} ${hasProjects ? styles.mainWithProjects : ''}`}>
        <div className={styles.content}>
          {/* Hero area — centered when no projects */}
          <div className={styles.hero}>
            <h1 className={styles.greeting}>
              What do you want to build, <span className={styles.name}>{firstName}</span>?
            </h1>

            <div className={styles.promptWrapper}>
              <PromptInput defaultValue={promptDefault} onSubmit={handlePromptSubmit} page="dashboard" />
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
          <section className={styles.projectsSection}>
            <h2 className={styles.sectionTitle}>Your projects</h2>

            {projectsLoading ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>Loading projects…</p>
              </div>
            ) : projects.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <line x1="3" y1="9" x2="21" y2="9"/>
                    <line x1="9" y1="21" x2="9" y2="9"/>
                  </svg>
                </div>
                <h3 className={styles.emptyTitle}>No projects yet</h3>
                <p className={styles.emptyText}>
                  Describe what you want to build above and hit Send to create your first project.
                </p>
              </div>
            ) : (
              <div className={styles.projectGrid}>
                {projects.map((project) => (
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
                        <img src={project.preview_url} alt={project.title} />
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
                      <h3 className={styles.projectTitle}>{project.title}</h3>
                      <span className={styles.projectDate}>
                        {new Date(project.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
