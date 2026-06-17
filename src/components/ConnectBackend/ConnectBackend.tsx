import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  authorizeUrl, listProjects, pickProject, revokeBackend, createProject, type RemoteProject,
} from '../../lib/backend-connection'
import styles from './ConnectBackend.module.css'

interface Props {
  /** Current OpenThorn project id. */
  projectId: string
}

/**
 * "Add a backend" panel. Lets the user authorize their Supabase account (OAuth),
 * pick a project, and connect it to this OpenThorn project — adding a database +
 * auth to the generated app. Self-contained: reads the session from useAuth and
 * the connection status from the project_backends table.
 */
export function ConnectBackend({ projectId }: Props) {
  const { session } = useAuth()
  const token = session?.access_token ?? ''

  const [connected, setConnected] = useState<boolean | null>(null)
  const [projects, setProjects] = useState<RemoteProject[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // New-project creation UI state.
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  // Refs of projects created in this session — still provisioning, not yet connectable.
  const [provisioning, setProvisioning] = useState<Set<string>>(new Set())

  const refreshStatus = useCallback(async () => {
    const { data } = await supabase
      .from('project_backends')
      .select('project_ref')
      .eq('project_id', projectId)
      .maybeSingle()
    setConnected(Boolean(data))
  }, [projectId])

  useEffect(() => { void refreshStatus() }, [refreshStatus])

  // After the OAuth redirect bounces back (?backend=connected) we can list projects.
  useEffect(() => {
    if (!token) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('backend') === 'connected') {
      setBusy(true)
      listProjects(token)
        .then((r) => setProjects(r.projects))
        .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load projects'))
        .finally(() => setBusy(false))
    }
    if (params.get('backend') === 'error') setError(params.get('message') || 'Authorization failed')
  }, [token])

  const choose = useCallback(async (ref: string) => {
    setBusy(true); setError(null)
    try {
      await pickProject(token, projectId, ref)
      setProjects(null)
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
      setProjects((prev) => [project, ...(prev ?? [])])
      setProvisioning((prev) => new Set(prev).add(project.ref))
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
      await revokeBackend(token)
      setProjects(null)
      await refreshStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to disconnect')
    } finally {
      setBusy(false)
    }
  }, [token, refreshStatus])

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
      {!projects && (
        <a className={styles.primary} href={authorizeUrl(token, projectId)}>Authorize Supabase</a>
      )}
      {projects && (
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
              const isProvisioning = provisioning.has(p.ref)
              return (
                <li key={p.ref}>
                  <button
                    className={styles.projectBtn}
                    type="button"
                    disabled={busy || isProvisioning}
                    onClick={() => choose(p.ref)}
                  >
                    {p.name}{' '}
                    <span className={styles.ref}>{isProvisioning ? 'provisioning…' : p.region}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {provisioning.size > 0 && (
            <p className={styles.desc}>
              New projects take a minute or two to provision. Once ready, reopen this panel to connect them.
            </p>
          )}
        </>
      )}
    </div>
  )
}
