import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  authorizeUrl, listProjects, pickProject, disconnectProject, createProject, type RemoteProject,
} from '../../lib/backend-connection'
import styles from './ConnectBackend.module.css'

interface Props {
  /** Current OpenThorn project id. */
  projectId: string
  /** Notified whenever the connected state is determined or changes. */
  onStatusChange?: (connected: boolean) => void
}

const READY = 'ACTIVE_HEALTHY'

/** Human label for a non-ready project status. */
function statusLabel(status: string): string {
  if (status === 'COMING_UP' || status === 'UNKNOWN' || status === 'INITIATING') return 'provisioning…'
  if (status === 'INACTIVE' || status === 'PAUSED') return 'paused'
  if (status === 'RESTORING') return 'restoring…'
  return status.toLowerCase().replace(/_/g, ' ')
}

/**
 * "Add a backend" panel. Lets the user authorize their Supabase account (OAuth),
 * pick (or create) a project, and connect it to this OpenThorn project — adding a
 * database + auth to the generated app. Self-contained: reads the session from
 * useAuth and the connection status from the project_backends table.
 */
export function ConnectBackend({ projectId, onStatusChange }: Props) {
  const { session } = useAuth()
  const token = session?.access_token ?? ''

  const [connected, setConnected] = useState<boolean | null>(null)
  const [projects, setProjects] = useState<RemoteProject[] | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // New-project creation UI state.
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const refreshStatus = useCallback(async () => {
    const { data } = await supabase
      .from('project_backends')
      .select('project_ref')
      .eq('project_id', projectId)
      .maybeSingle()
    const isConnected = Boolean(data)
    setConnected(isConnected)
    onStatusChange?.(isConnected)
  }, [projectId, onStatusChange])

  useEffect(() => { void refreshStatus() }, [refreshStatus])

  // Load the org's project list. If there's no connection yet, fall back to the
  // Authorize button. Runs whenever the panel mounts for a not-yet-connected project.
  const loadProjects = useCallback(async () => {
    if (!token) return
    try {
      const { projects } = await listProjects(token)
      setProjects(projects)
      setNeedsAuth(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (/no supabase connection/i.test(msg)) {
        setNeedsAuth(true)
      } else {
        setError(msg || 'Failed to load projects')
      }
    }
  }, [token])

  useEffect(() => {
    if (connected === false) {
      void loadProjects()
      const params = new URLSearchParams(window.location.search)
      if (params.get('backend') === 'error') setError(params.get('message') || 'Authorization failed')
    }
  }, [connected, loadProjects])

  // Poll while any listed project is still provisioning, so newly-created projects
  // flip to selectable on their own. Stops once everything is healthy.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    const anyPending = (projects ?? []).some((p) => p.status !== READY)
    if (!anyPending) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      return
    }
    if (pollRef.current) return
    pollRef.current = setInterval(() => { void loadProjects() }, 8000)
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [projects, loadProjects])

  const choose = useCallback(async (ref: string) => {
    setBusy(true); setError(null)
    try {
      await pickProject(token, projectId, ref)
      await refreshStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect project')
    } finally {
      setBusy(false)
    }
  }, [token, projectId, refreshStatus])

  const create = useCallback(async () => {
    const name = newName.trim()
    if (!name) return
    setCreating(true); setError(null)
    try {
      const { project } = await createProject(token, name)
      setProjects((prev) => [project, ...(prev ?? []).filter((p) => p.ref !== project.ref)])
      setShowNew(false)
      setNewName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }, [token, newName])

  const disconnect = useCallback(async () => {
    setBusy(true); setError(null)
    try {
      await disconnectProject(token, projectId)
      setProjects(null)
      setNeedsAuth(false)
      await refreshStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to disconnect')
    } finally {
      setBusy(false)
    }
  }, [token, projectId, refreshStatus])

  if (connected === null) return null

  if (connected) {
    return (
      <div className={styles.panel}>
        <p className={styles.connected}>Backend connected ✓</p>
        <p className={styles.desc}>This app can use a database and user accounts.</p>
        <button className={styles.secondary} type="button" disabled={busy} onClick={disconnect}>
          Disconnect
        </button>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>Add a backend</h3>
      <p className={styles.desc}>
        Connect your Supabase project to add a database, accounts, and saved data to this app.
      </p>
      {error && <p className={styles.error}>{error}</p>}

      {needsAuth && (
        <a className={styles.primary} href={authorizeUrl(token, projectId)}>Authorize Supabase</a>
      )}

      {!needsAuth && projects && (
        <>
          {showNew ? (
            <div className={styles.newRow}>
              <input
                className={styles.newInput}
                type="text"
                value={newName}
                placeholder="New project name"
                autoFocus
                disabled={creating}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void create() }}
              />
              <button className={styles.primary} type="button" disabled={creating || !newName.trim()} onClick={create}>
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button className={styles.secondary} type="button" disabled={creating} onClick={() => setShowNew(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button className={styles.addBtn} type="button" onClick={() => { setShowNew(true); setError(null) }}>
              + Add new project
            </button>
          )}
          <ul className={styles.list}>
            {projects.length === 0 && !showNew && (
              <li className={styles.desc}>No projects found in your Supabase org.</li>
            )}
            {projects.map((p) => {
              const ready = p.status === READY
              return (
                <li key={p.ref}>
                  <button
                    className={styles.projectBtn}
                    type="button"
                    disabled={busy || !ready}
                    onClick={() => choose(p.ref)}
                  >
                    {p.name} <span className={styles.ref}>{ready ? p.region : statusLabel(p.status)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {(projects ?? []).some((p) => p.status !== READY) && (
            <p className={styles.desc}>New projects take a minute or two to provision — this list refreshes automatically.</p>
          )}
        </>
      )}
    </div>
  )
}
