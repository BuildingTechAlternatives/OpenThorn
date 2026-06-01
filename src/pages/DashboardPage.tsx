import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import DashboardSidebar from '../components/DashboardSidebar/DashboardSidebar'
import PromptInput from '../components/PromptInput/PromptInput'
import FloatingParticles from '../components/FloatingParticles/FloatingParticles'
import styles from './DashboardPage.module.css'

interface Project {
  id: string
  title: string
  preview_url: string | null
  created_at: string
}

const examplePrompts = [
  'A sleek portfolio for a photographer',
  'Landing page for a SaaS startup',
  'Restaurant menu with online ordering',
  'Personal blog with a minimalist vibe',
  'Task management dashboard',
  'Online course platform',
]

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [promptDefault, setPromptDefault] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there'

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/', { replace: true })
    }
  }, [user, authLoading, navigate])

  // Fetch projects
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
  }, [user])

  const handlePromptSubmit = useCallback((_prompt: string) => {
    // TODO: implement project generation
  }, [])

  const handleExampleClick = (prompt: string) => {
    setPromptDefault(prompt)
  }

  if (authLoading) return null

  const hasProjects = !projectsLoading && projects.length > 0

  return (
    <div className={styles.root}>
      <FloatingParticles
        particleCount={30}
        particleSize={2}
        particleOpacity={0.3}
        particleColor="#A78BFA"
        glowIntensity={8}
        movementSpeed={0.3}
        mouseInfluence={80}
        mouseGravity="attract"
        gravityStrength={20}
        glowAnimation="ease"
      />

      <DashboardSidebar />

      <main className={`${styles.main} ${hasProjects ? styles.mainWithProjects : ''}`}>
        <div className={styles.content}>
          {/* Hero area — centered when no projects */}
          <div className={styles.hero}>
            <h1 className={styles.greeting}>
              What do you want to build, <span className={styles.name}>{firstName}</span>?
            </h1>

            <div className={styles.promptWrapper}>
              <PromptInput defaultValue={promptDefault} onSubmit={handlePromptSubmit} />
            </div>

            <div className={styles.examples}>
              {examplePrompts.map((prompt) => (
                <button
                  key={prompt}
                  className={styles.exampleChip}
                  onClick={() => handleExampleClick(prompt)}
                  type="button"
                >
                  {prompt}
                </button>
              ))}
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
                  Describe what you want to build above and hit Generate to create your first project.
                </p>
              </div>
            ) : (
              <div className={styles.projectGrid}>
                {projects.map((project) => (
                  <div key={project.id} className={styles.projectCard}>
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
