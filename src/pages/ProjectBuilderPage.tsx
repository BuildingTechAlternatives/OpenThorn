import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import JSZip from 'jszip'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { bundleProject, deployToStorage } from '../lib/deploy'
import { pushFiles, createRepo, getGitHubUser } from '../lib/github'
import PromptInput from '../components/PromptInput/PromptInput'
import styles from './ProjectBuilderPage.module.css'

interface ProjectRouteState {
  prompt?: string
  title?: string
}

const codeFiles = [
  {
    path: 'src/App.tsx',
    language: 'tsx',
    code: `import PreviewShell from './components/PreviewShell'\nimport Hero from './components/Hero'\nimport './styles/theme.css'\n\nexport default function App() {\n  return (\n    <PreviewShell>\n      <Hero />\n    </PreviewShell>\n  )\n}`,
  },
  {
    path: 'src/components/Hero.tsx',
    language: 'tsx',
    code: `export default function Hero() {\n  return (\n    <section className="hero">\n      <p className="eyebrow">Generated with Bloom</p>\n      <h1>Your first page is ready for refinement.</h1>\n      <p className="lede">\n        The preview canvas will render the generated app once the build pipeline is connected.\n      </p>\n    </section>\n  )\n}`,
  },
  {
    path: 'src/components/PreviewShell.tsx',
    language: 'tsx',
    code: `import type { ReactNode } from 'react'\n\nexport default function PreviewShell({ children }: { children: ReactNode }) {\n  return <main className="preview-shell">{children}</main>\n}`,
  },
  {
    path: 'src/styles/theme.css',
    language: 'css',
    code: `.preview-shell {\n  min-height: 100vh;\n  background: #fbfaf8;\n  color: #241f2a;\n}\n\n.hero {\n  max-width: 960px;\n  margin: 0 auto;\n  padding: 96px 32px;\n}\n\n.eyebrow {\n  color: #4f978e;\n  font-weight: 700;\n}`,
  },
]

const suggestions = [
  'Add authentication',
  'Make it responsive',
]

type ViewMode = 'preview' | 'code'
type DeviceMode = 'desktop' | 'tablet' | 'phone'
type SharePermission = 'view' | 'edit'
type ProjectAccess = 'owner' | SharePermission

interface Collaborator {
  id: string
  email: string
  name: string
  permission: SharePermission
  invitedAt: string
  accountVerified: boolean
}

const deviceOrder: DeviceMode[] = ['desktop', 'tablet', 'phone']

export default function ProjectBuilderPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const { projectId } = useParams()
  const location = useLocation()
  const state = (location.state ?? {}) as ProjectRouteState
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop')
  const [activeFile, setActiveFile] = useState(codeFiles[0].path)
  const [fullscreen, setFullscreen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePermission, setInvitePermission] = useState<SharePermission>('edit')
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [shareLink, setShareLink] = useState('')
  const [inviteStatus, setInviteStatus] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [projectAccess, setProjectAccess] = useState<ProjectAccess>('owner')
  const [deployState, setDeployState] = useState<'idle' | 'deploying' | 'deployed' | 'error'>('idle')
  const [deployUrl, setDeployUrl] = useState('')
  const [deployError, setDeployError] = useState('')
  const [deployModalOpen, setDeployModalOpen] = useState(false)
  const [githubToken, setGithubToken] = useState('')
  const [githubUsername, setGithubUsername] = useState('')
  const [githubDialogOpen, setGithubDialogOpen] = useState(false)
  const [githubTokenInput, setGithubTokenInput] = useState('')
  const [githubConnecting, setGithubConnecting] = useState(false)
  const [githubError, setGithubError] = useState('')
  const [githubPushing, setGithubPushing] = useState(false)
  const [githubPushSuccess, setGithubPushSuccess] = useState('')

  const prompt = state.prompt || 'Build a polished web app with a strong hero, product sections, and a deploy-ready layout.'
  const title = state.title || 'Untitled project'
  const activeCodeFile = codeFiles.find((file) => file.path === activeFile) ?? codeFiles[0]
  const userInitial = user?.user_metadata?.full_name?.charAt(0).toUpperCase() ?? user?.email?.charAt(0).toUpperCase() ?? 'U'
  const userAvatar = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture
  const ownerName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'You'
  const ownerEmail = user?.email ?? 'Project owner'
  const isViewOnly = projectAccess === 'view'
  const canManageShare = projectAccess === 'owner'
  const canInvite = canManageShare && inviteEmail.trim().length > 0 && !inviteLoading
  const accessLabel = projectAccess === 'owner' ? 'Owner' : projectAccess === 'edit' ? 'Edit access' : 'View-only'

  const inviteLink = useMemo(() => {
    if (shareLink) return shareLink
    if (typeof window === 'undefined' || !projectId) return ''
    return new URL(`/projects/${projectId}`, window.location.origin).toString()
  }, [projectId, shareLink])

  useEffect(() => {
    if (!loading && !user) {
      navigate('/', { replace: true })
    }
  }, [loading, user, navigate])

  // Sync project to Supabase on mount
  useEffect(() => {
    if (!user || !projectId) return

    const saveProject = async () => {
      // Verify ownership before upserting to prevent IDOR
      const { data: existing } = await supabase
        .from('projects')
        .select('user_id')
        .eq('id', projectId)
        .single()

      if (existing && existing.user_id !== user.id) {
        // Project belongs to another user — redirect away
        const { data: collaboration, error: collaborationError } = await supabase
          .from('project_collaborators')
          .select('permission')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (collaborationError || !collaboration) {
          navigate('/dashboard', { replace: true })
          return
        }

        setProjectAccess(collaboration.permission === 'view' ? 'view' : 'edit')
        return
      }

      setProjectAccess('owner')

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
        console.error('Failed to sync project:', error.message)
      }
    }

    saveProject()
  }, [user, projectId, title, navigate])

  useEffect(() => {
    if (!user || !projectId) return

    let cancelled = false

    const loadCollaborators = async () => {
      const { data, error } = await supabase
        .from('project_collaborators')
        .select('*')
        .eq('project_id', projectId)
        .order('invited_at', { ascending: false })

      if (cancelled) return

      if (error) {
        if (!/does not exist|schema cache|permission denied/i.test(error.message)) {
          console.error('Failed to load collaborators:', error.message)
        }
        return
      }

      if (!data) return

      setCollaborators(data.map((item) => {
        const email = String(item.email ?? 'collaborator@bloom.app')
        return {
          id: String(item.user_id ?? item.id ?? email),
          email,
          name: String(item.name ?? item.full_name ?? email.split('@')[0]),
          permission: item.permission === 'view' ? 'view' : 'edit',
          invitedAt: String(item.invited_at ?? item.created_at ?? new Date().toISOString()),
          accountVerified: true,
        }
      }))
    }

    loadCollaborators()

    return () => { cancelled = true }
  }, [projectId, user])

  useEffect(() => {
    if (!user) return

    const loadGithubIntegration = async () => {
      const { data, error } = await supabase
        .from('user_integrations')
        .select('access_token, provider_username')
        .eq('user_id', user.id)
        .eq('provider', 'github')
        .maybeSingle()

      if (error || !data) return

      setGithubToken(data.access_token)
      setGithubUsername(data.provider_username || '')
    }

    loadGithubIntegration()
  }, [user])

  const handleDeploy = useCallback(async () => {
    setDeployState('deploying')
    setDeployError('')
    setDeployModalOpen(true)

    try {
      const html = bundleProject(codeFiles, title)
      const url = await deployToStorage(projectId!, html)
      setDeployUrl(url)
      setDeployState('deployed')
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : 'Deploy failed')
      setDeployState('error')
    }
  }, [projectId, title])

  const handleGithubConnect = useCallback(async () => {
    setGithubConnecting(true)
    setGithubError('')

    try {
      const githubUser = await getGitHubUser(githubTokenInput.trim())

      const { error } = await supabase
        .from('user_integrations')
        .upsert({
          user_id: user!.id,
          provider: 'github',
          access_token: githubTokenInput.trim(),
          provider_username: githubUser.login,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,provider' })

      if (error) {
        setGithubError(error.message)
        setGithubConnecting(false)
        return
      }

      setGithubToken(githubTokenInput.trim())
      setGithubUsername(githubUser.login)
      setGithubTokenInput('')
      setGithubDialogOpen(false)
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setGithubConnecting(false)
    }
  }, [githubTokenInput, user])

  const handleGithubPush = useCallback(async () => {
    setGithubPushing(true)
    setGithubPushSuccess('')
    setGithubError('')

    try {
      const repoName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'bloom-project'

      const repo = await createRepo(githubToken, repoName, true)
      await pushFiles(
        githubToken,
        repo.owner.login,
        repo.name,
        codeFiles.map((f) => ({ path: f.path, content: f.code })),
      )

      setGithubPushSuccess(repo.html_url)
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : 'Push failed')
    } finally {
      setGithubPushing(false)
    }
  }, [githubToken, title])

  const handleDownloadZip = useCallback(async () => {
    const zip = new JSZip()
    codeFiles.forEach((file) => {
      zip.file(file.path, file.code)
    })
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'}.zip`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }, [title])

  const buildInviteLink = useCallback(() => {
    if (typeof window === 'undefined' || !projectId) return ''
    const token = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    return new URL(`/projects/${projectId}?invite=${token}`, window.location.origin).toString()
  }, [projectId])

  const findBloomAccount = useCallback(async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase()
    const tables = ['profiles', 'users']

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .ilike('email', normalizedEmail)
        .maybeSingle()

      if (!error && data) {
        return {
          id: String(data.id ?? normalizedEmail),
          name: String(data.full_name ?? data.name ?? normalizedEmail.split('@')[0]),
        }
      }

      if (error && !/does not exist|schema cache|permission denied/i.test(error.message)) {
        break
      }
    }

    return null
  }, [])

  const handleInviteCollaborator = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setInviteError('')
    setInviteStatus('')
    setLinkCopied(false)

    const normalizedEmail = inviteEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setInviteError('Enter a valid email address.')
      return
    }

    if (normalizedEmail === user?.email?.toLowerCase()) {
      setInviteError('You already own this project.')
      return
    }

    if (collaborators.some((collaborator) => collaborator.email.toLowerCase() === normalizedEmail)) {
      setInviteError('That collaborator is already invited.')
      return
    }

    setInviteLoading(true)
    const account = await findBloomAccount(normalizedEmail)

    if (!account) {
      setInviteLoading(false)
      setInviteError('No Bloom account found for that email.')
      return
    }

    const createdLink = buildInviteLink()
    const invitedAt = new Date().toISOString()

    setCollaborators((current) => [
      {
        id: account.id,
        email: normalizedEmail,
        name: account.name,
        permission: invitePermission,
        invitedAt,
        accountVerified: true,
      },
      ...current,
    ])
    setShareLink(createdLink)
    setInviteEmail('')
    setInviteStatus(`${account.name} was invited with ${invitePermission === 'edit' ? 'edit' : 'view-only'} access.`)
    setInviteLoading(false)

    if (projectId) {
      const { error } = await supabase
        .from('project_collaborators')
        .upsert({
          project_id: projectId,
          user_id: account.id,
          email: normalizedEmail,
          permission: invitePermission,
          invited_by: user?.id,
          invited_at: invitedAt,
        }, { onConflict: 'project_id,user_id' })

      if (error && !/does not exist|schema cache|permission denied/i.test(error.message)) {
        console.error('Failed to persist collaborator:', error.message)
      }
    }
  }, [buildInviteLink, collaborators, findBloomAccount, inviteEmail, invitePermission, projectId, user])

  const handlePermissionChange = useCallback((collaboratorId: string, permission: SharePermission) => {
    setCollaborators((current) => current.map((collaborator) => (
      collaborator.id === collaboratorId ? { ...collaborator, permission } : collaborator
    )))

    const collaborator = collaborators.find((item) => item.id === collaboratorId)
    if (projectId && collaborator) {
      supabase
        .from('project_collaborators')
        .update({ permission })
        .eq('project_id', projectId)
        .eq('user_id', collaboratorId)
        .then(({ error }) => {
          if (error && !/does not exist|schema cache|permission denied/i.test(error.message)) {
            console.error('Failed to update collaborator:', error.message)
          }
        })
    }
  }, [collaborators, projectId])

  const handleRemoveCollaborator = useCallback((collaboratorId: string) => {
    setCollaborators((current) => current.filter((collaborator) => collaborator.id !== collaboratorId))

    if (projectId) {
      supabase
        .from('project_collaborators')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', collaboratorId)
        .then(({ error }) => {
          if (error && !/does not exist|schema cache|permission denied/i.test(error.message)) {
            console.error('Failed to remove collaborator:', error.message)
          }
        })
    }
  }, [projectId])

  const handleCopyLink = useCallback(async () => {
    const link = inviteLink || buildInviteLink()
    if (!shareLink) setShareLink(link)

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(link)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 1800)
    }
  }, [buildInviteLink, inviteLink, shareLink])

  if (loading) return null

  return (
    <div className={styles.root}>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <button className={styles.backBtn} type="button" onClick={() => navigate('/dashboard')} aria-label="Back to dashboard">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>

          <div className={styles.brandCluster}>
            <img src="/assets/logo.png" alt="Bloom" className={styles.logo} />
            <div>
              <div className={styles.projectName}>{title}</div>
              <div className={styles.projectMeta}>Draft project - {projectId?.slice(0, 8)} - {accessLabel}</div>
            </div>
          </div>
        </div>

        <div className={styles.topbarCenter}>
          <div className={styles.modeSwitch} aria-label="View mode">
            <button
              className={viewMode === 'preview' ? styles.modeActive : ''}
              type="button"
              onClick={() => setViewMode('preview')}
            >
              <GlobeIcon />
              Preview
            </button>
            <button
              className={viewMode === 'code' ? styles.modeActive : ''}
              type="button"
              onClick={() => setViewMode('code')}
            >
              <CodeIcon />
              Code
            </button>
          </div>
        </div>

        <div className={styles.topActions}>
          <button
            className={styles.iconBtn}
            type="button"
            aria-label={githubToken ? 'Push to GitHub' : 'Connect GitHub'}
            onClick={() => {
              if (githubToken) {
                handleGithubPush()
              } else {
                setGithubDialogOpen(true)
                setGithubTokenInput('')
                setGithubError('')
                setGithubPushSuccess('')
              }
            }}
          >
            <img src="/assets/github.png" alt="GitHub" className={styles.githubLogo} />
          </button>
          <button className={styles.iconBtn} type="button" aria-label="Download project as ZIP" onClick={handleDownloadZip}>
            <DownloadIcon />
          </button>
          <button className={styles.shareBtn} type="button" onClick={() => setShareOpen(true)}>
            <ShareIcon />
            Share
          </button>
          <button
            className={`${styles.deployBtn} ${deployState === 'deployed' ? styles.deployBtnDeployed : ''}`}
            type="button"
            onClick={deployState === 'deployed' ? () => window.open(deployUrl, '_blank') : handleDeploy}
            disabled={deployState === 'deploying'}
          >
            {deployState === 'deploying' ? (
              <><span className={styles.spinner} />Deploying…</>
            ) : deployState === 'deployed' ? (
              <>View site <ExternalIcon /></>
            ) : (
              <>Deploy</>
            )}
          </button>
        </div>
      </header>

      {shareOpen && (
        <div
          className={styles.shareOverlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShareOpen(false)
          }}
        >
          <section className={styles.shareDialog} role="dialog" aria-modal="true" aria-labelledby="share-dialog-title">
            <div className={styles.shareHeader}>
              <div>
                <h2 id="share-dialog-title">Share {title}</h2>
              </div>
              <button className={styles.closeBtn} type="button" aria-label="Close share dialog" onClick={() => setShareOpen(false)}>
                <CloseIcon />
              </button>
            </div>

            {canManageShare ? (
              <form className={styles.inviteForm} onSubmit={handleInviteCollaborator}>
                <label className={styles.inviteLabel} htmlFor="collaborator-email">Invite by email</label>
                <div className={styles.inviteRow}>
                  <div className={styles.emailInputWrap}>
                    <MailIcon />
                    <input
                      id="collaborator-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => {
                        setInviteEmail(event.target.value)
                        setInviteError('')
                        setInviteStatus('')
                      }}
                      placeholder="teammate@company.com"
                      autoComplete="email"
                    />
                  </div>

                  <div className={styles.permissionToggle} aria-label="Invite permission">
                    <button
                      className={invitePermission === 'view' ? styles.permissionActive : ''}
                      type="button"
                      onClick={() => setInvitePermission('view')}
                    >
                      View
                    </button>
                    <button
                      className={invitePermission === 'edit' ? styles.permissionActive : ''}
                      type="button"
                      onClick={() => setInvitePermission('edit')}
                    >
                      Edit
                    </button>
                  </div>

                  <button className={styles.inviteBtn} type="submit" disabled={!canInvite}>
                    {inviteLoading ? 'Checking' : 'Invite'}
                  </button>
                </div>

                <div className={styles.inviteFeedback} aria-live="polite">
                  {inviteError && <span className={styles.inviteError}>{inviteError}</span>}
                  {inviteStatus && <span className={styles.inviteSuccess}>{inviteStatus}</span>}
                </div>
              </form>
            ) : (
              <div className={styles.readOnlyShare}>
                You have {projectAccess === 'edit' ? 'edit' : 'view-only'} access. The project owner manages invitations and permissions.
              </div>
            )}

            <div className={styles.linkPanel}>
              <div className={styles.linkIcon}><LinkIcon /></div>
              <div className={styles.linkText}>
                <span>Invite link</span>
                <strong>{inviteLink}</strong>
              </div>
              <button className={styles.copyBtn} type="button" onClick={handleCopyLink}>
                {linkCopied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className={styles.peoplePanel}>
              <div className={styles.peopleHeader}>
                <h3>People with access</h3>
                <span>{collaborators.length + 1} total</span>
              </div>

              <div className={styles.personList}>
                <article className={styles.personItem}>
                  <div className={styles.personAvatar}>
                    {userAvatar ? <img src={userAvatar} alt="" /> : userInitial}
                  </div>
                  <div className={styles.personInfo}>
                    <strong>{ownerName}</strong>
                    <span>{ownerEmail}</span>
                  </div>
                  <span className={styles.ownerBadge}>Owner</span>
                </article>

                {collaborators.length === 0 ? (
                  <div className={styles.emptyInvites}>
                    Invite collaborators to keep feedback, edits, and handoff in one place.
                  </div>
                ) : (
                  collaborators.map((collaborator) => (
                    <article className={styles.personItem} key={collaborator.id}>
                      <div className={styles.personAvatar}>{collaborator.name.charAt(0).toUpperCase()}</div>
                      <div className={styles.personInfo}>
                        <strong>{collaborator.name}</strong>
                        <span>
                          {collaborator.email} - {collaborator.accountVerified ? 'Bloom account' : 'Pending'} - Invited {new Date(collaborator.invitedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      {canManageShare ? (
                        <>
                          <select
                            className={styles.permissionSelect}
                            value={collaborator.permission}
                            aria-label={`Permission for ${collaborator.email}`}
                            onChange={(event) => handlePermissionChange(collaborator.id, event.target.value as SharePermission)}
                          >
                            <option value="view">Can view</option>
                            <option value="edit">Can edit</option>
                          </select>
                          <button
                            className={styles.removeBtn}
                            type="button"
                            aria-label={`Remove ${collaborator.email}`}
                            onClick={() => handleRemoveCollaborator(collaborator.id)}
                          >
                            <TrashIcon />
                          </button>
                        </>
                      ) : (
                        <span className={styles.ownerBadge}>{collaborator.permission === 'edit' ? 'Can edit' : 'Can view'}</span>
                      )}
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {deployModalOpen && (
        <div
          className={styles.shareOverlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && deployState !== 'deploying') {
              setDeployModalOpen(false)
            }
          }}
        >
          <section className={styles.deployModal} role="dialog" aria-modal="true" aria-labelledby="deploy-modal-title">
            <div className={styles.shareHeader}>
              <div>
                <h2 id="deploy-modal-title">Deploy project</h2>
              </div>
              {deployState !== 'deploying' && (
                <button className={styles.closeBtn} type="button" aria-label="Close" onClick={() => setDeployModalOpen(false)}>
                  <CloseIcon />
                </button>
              )}
            </div>

            <div className={styles.deployBody}>
              {deployState === 'deploying' && (
                <div className={styles.deployStatus}>
                  <span className={styles.spinnerLarge} />
                  <p>Bundling and deploying your project…</p>
                </div>
              )}

              {deployState === 'deployed' && (
                <div className={styles.deployStatus}>
                  <div className={styles.deploySuccessIcon}>
                    <CheckIconLarge />
                  </div>
                  <p>Your site is live!</p>
                  <a href={deployUrl} target="_blank" rel="noopener noreferrer" className={styles.deployUrl}>
                    {deployUrl}
                  </a>
                  <button
                    className={styles.deployBtn}
                    type="button"
                    onClick={() => window.open(deployUrl, '_blank')}
                  >
                    View site <ExternalIcon />
                  </button>
                </div>
              )}

              {deployState === 'error' && (
                <div className={styles.deployStatus}>
                  <p className={styles.deployError}>{deployError}</p>
                  <button className={styles.deployBtn} type="button" onClick={handleDeploy}>
                    Retry
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {githubDialogOpen && (
        <div
          className={styles.shareOverlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !githubConnecting && !githubPushing) {
              setGithubDialogOpen(false)
            }
          }}
        >
          <section className={styles.deployModal} role="dialog" aria-modal="true" aria-labelledby="github-dialog-title">
            <div className={styles.shareHeader}>
              <div>
                <h2 id="github-dialog-title">Connect GitHub</h2>
              </div>
              <button className={styles.closeBtn} type="button" aria-label="Close" onClick={() => setGithubDialogOpen(false)}>
                <CloseIcon />
              </button>
            </div>

            <div className={styles.deployBody}>
              {githubPushSuccess ? (
                <div className={styles.deployStatus}>
                  <div className={styles.deploySuccessIcon}>
                    <CheckIconLarge />
                  </div>
                  <p>Code pushed to GitHub!</p>
                  <a href={githubPushSuccess} target="_blank" rel="noopener noreferrer" className={styles.deployUrl}>
                    {githubPushSuccess}
                  </a>
                </div>
              ) : githubToken ? (
                <div className={styles.deployStatus}>
                  <p>
                    Pushing to <strong>{githubUsername}</strong>'s GitHub account
                  </p>
                  <button
                    className={styles.deployBtn}
                    type="button"
                    onClick={handleGithubPush}
                    disabled={githubPushing}
                  >
                    {githubPushing ? <><span className={styles.spinner} />Pushing…</> : 'Push to new repo'}
                  </button>
                  {githubError && <p className={styles.deployError}>{githubError}</p>}
                </div>
              ) : (
                <div className={styles.deployBodyInner}>
                  <p className={styles.githubInstructions}>
                    Create a{' '}
                    <a
                      href="https://github.com/settings/tokens/new?scopes=repo&description=Bloom"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      fine-grained personal access token
                    </a>{' '}
                    with <strong>repo</strong> scope and paste it below.
                  </p>
                  <div className={styles.emailInputWrap}>
                    <input
                      type="password"
                      value={githubTokenInput}
                      onChange={(e) => {
                        setGithubTokenInput(e.target.value)
                        setGithubError('')
                      }}
                      placeholder="github_pat_…"
                      autoComplete="off"
                    />
                  </div>
                  <button
                    className={styles.deployBtn}
                    type="button"
                    onClick={handleGithubConnect}
                    disabled={!githubTokenInput.trim() || githubConnecting}
                  >
                    {githubConnecting ? <><span className={styles.spinner} />Connecting…</> : 'Connect'}
                  </button>
                  {githubError && <p className={styles.deployError}>{githubError}</p>}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      <main className={styles.shell}>
        <aside className={styles.chatPanel}>
          <div className={styles.panelHeader}>
            <h1>{title}</h1>
          </div>

          <div className={styles.thread}>
            <article className={styles.userMessage}>
              <div className={styles.avatar}>
                {userAvatar ? <img src={userAvatar} alt="" /> : userInitial}
              </div>
              <div className={styles.userBubble}>
                <p>{prompt}</p>
              </div>
            </article>

            <article className={styles.assistantMessage}>
              <div className={styles.assistantTop}>
                <img src="/assets/logo.png" alt="" />
                <span>Frontend scaffold prepared.</span>
              </div>
              <MarkdownBlock
                markdown={`The editor shell is ready.\n\n- Preview is connected to the responsive device frame.\n- Code view includes the current frontend files.\n- Backend generation can plug into this route later.`}
              />
              <div className={styles.fileList}>
                {codeFiles.map((file) => (
                  <span key={file.path}>
                    <FileIcon />
                    {file.path}
                  </span>
                ))}
              </div>
            </article>
          </div>

          <div className={styles.suggestionBlock}>
            {suggestions.map((suggestion) => (
              <button key={suggestion} type="button">{suggestion}</button>
            ))}
          </div>

          <div className={styles.composer}>
            {isViewOnly ? (
              <div className={styles.viewOnlyNotice}>
                View-only access. Ask the owner for edit permission to make changes.
              </div>
            ) : (
              <PromptInput
                size="small"
                page="dashboard"
                disableTyping
                placeholder="Ask Bloom for a change..."
                onSubmit={() => undefined}
              />
            )}
          </div>
        </aside>

        <section className={`${styles.previewPane} ${fullscreen ? styles.previewPaneFullscreen : ''}`}>
          <div className={styles.previewToolbar}>
            <div className={styles.previewCenter}>
              <button
                className={styles.iconBtn}
                type="button"
                aria-label={`Switch device preview. Current: ${deviceMode}`}
                onClick={() => setDeviceMode((current) => deviceOrder[(deviceOrder.indexOf(current) + 1) % deviceOrder.length])}
              >
                <DeviceIcon mode={deviceMode} />
              </button>
              <div className={styles.addressBar}>
                {deployUrl ? (
                  <>
                    <RefreshIcon />
                    <span>{new URL(deployUrl).hostname}{new URL(deployUrl).pathname}</span>
                  </>
                ) : (
                  <>
                    <RefreshIcon />
                    <span>/</span>
                    <ChevronDownIcon />
                  </>
                )}
              </div>
            </div>

            <div className={styles.previewTools}>
              <button
                className={styles.iconBtn}
                type="button"
                aria-label={fullscreen ? 'Exit fullscreen preview' : 'Fullscreen preview'}
                onClick={() => setFullscreen((value) => !value)}
              >
                {fullscreen ? <MinimizeIcon /> : <FullscreenIcon />}
              </button>
            </div>
          </div>

          {viewMode === 'preview' ? (
            <div className={styles.previewStage}>
              <div className={`${styles.deviceFrame} ${styles[deviceMode]}`}>
                <div className={styles.previewCard}>
                  <div className={styles.previewChrome}>
                    <div className={styles.previewChromeDots}>
                      <span />
                      <span />
                      <span />
                    </div>
                    <span className={styles.previewPath}>/{title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'preview'}</span>
                    <span className={styles.previewState}>Waiting for build</span>
                  </div>

                  <div className={styles.previewEmpty}>
                    <div className={styles.previewMark}>
                      <img src="/assets/logo.png" alt="" />
                    </div>
                    <h2>Preview will appear here</h2>
                    <p>{prompt}</p>
                    <div className={styles.previewChecklist}>
                      <span><CheckIcon /> Layout shell</span>
                      <span><CheckIcon /> Prompt captured</span>
                      <span><ClockIcon /> Generation pipeline</span>
                    </div>
                  </div>

                  <div className={styles.previewSkeleton} aria-hidden="true">
                    <div className={styles.skeletonWide} />
                    <div />
                    <div />
                    <div />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.codeWorkspace}>
              <aside className={styles.codeSidebar}>
                <div className={styles.codeSidebarTitle}>Explorer</div>
                {codeFiles.map((file) => (
                  <button
                    key={file.path}
                    className={file.path === activeFile ? styles.codeFileActive : styles.codeFile}
                    type="button"
                    onClick={() => setActiveFile(file.path)}
                  >
                    <span className={styles.fileIcon}>
                      <FileIcon />
                    </span>
                    <span className={styles.fileName}>{file.path.split('/').pop()}</span>
                    <span className={styles.filePath}>{file.path.split('/').slice(0, -1).join('/')}</span>
                  </button>
                ))}
              </aside>

              <div className={styles.editorPane}>
                <div className={styles.editorTabs}>
                  <div className={styles.editorTab}>
                    <span className={styles.tabIcon}>
                      <FileIcon />
                    </span>
                    {activeCodeFile.path.split('/').pop()}
                    <button className={styles.tabClose} type="button" aria-label="Close tab">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                </div>
                <div className={styles.editorBody}>
                  <div className={styles.editorGutter}>
                    {activeCodeFile.code.split('\n').map((_, i) => (
                      <span key={i}>{i + 1}</span>
                    ))}
                  </div>
                  <pre className={styles.codeBlock}><code>{activeCodeFile.code}</code></pre>
                </div>
                <div className={styles.editorStatusBar}>
                  <span>{activeCodeFile.language.toUpperCase()}</span>
                  <span>UTF-8</span>
                  <span>Ln {activeCodeFile.code.split('\n').length}</span>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function ExternalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
    </svg>
  )
}

function CheckIconLarge() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function MarkdownBlock({ markdown }: { markdown: string }) {
  const blocks = markdown.trim().split(/\n{2,}/)

  return (
    <div className={styles.markdown}>
      {blocks.map((block, index) => {
        const lines = block.split('\n').filter(Boolean)

        if (lines.every((line) => line.startsWith('- '))) {
          return (
            <ul key={index}>
              {lines.map((line, lineIndex) => (
                <li key={`${line}-${lineIndex}`}>{line.slice(2)}</li>
              ))}
            </ul>
          )
        }

        return <p key={index}>{lines.join(' ')}</p>
      })}
    </div>
  )
}

function GlobeIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20"/></svg>
}

function CodeIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></svg>
}

function DownloadIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z" />
      <path d="M12 11v5M9 14l3 3 3-3" />
    </svg>
  )
}

function ShareIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M16 6l-8 4.5M8 13.5l8 4.5"/><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/></svg>
}

function CloseIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
}

function MailIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z"/><path d="M22 6l-10 7L2 6"/></svg>
}

function LinkIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
}

function TrashIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
}

function FileIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
}

function DesktopIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>
}

function RefreshIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12a9 9 0 11-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
}

function ChevronDownIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
}

function CheckIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 6L9 17l-5-5"/></svg>
}

function ClockIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
}

function DeviceIcon({ mode }: { mode: DeviceMode }) {
  if (mode === 'tablet') {
    return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M11 18h2"/></svg>
  }

  if (mode === 'phone') {
    return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>
  }

  return <DesktopIcon />
}

function FullscreenIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5"/></svg>
}

function MinimizeIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 3v5H3M16 3v5h5M8 21v-5H3M21 16h-5v5"/></svg>
}
