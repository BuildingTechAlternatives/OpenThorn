import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../lib/AuthContext'
import {
  adminListUsers,
  adminUserAction,
  adminSetPublishBanned,
  type AdminUserRow,
} from '../../lib/admin'
import styles from './AdminUsersPage.module.css'

export default function AdminUsersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setUsers(await adminListUsers())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter(u =>
      u.email.toLowerCase().includes(q) || (u.full_name ?? '').toLowerCase().includes(q),
    )
  }, [users, query])

  const run = useCallback(async (id: string, fn: () => Promise<void>) => {
    setBusyId(id)
    setError(null)
    try {
      await fn()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusyId(null)
      setDeleteConfirmId(null)
    }
  }, [load])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Users</h1>
        <input
          className={styles.search}
          type="search"
          placeholder="Search by email or name…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </header>

      {error && <div className={styles.error} role="alert">{error}</div>}
      {loading && <p className={styles.muted}>Loading users…</p>}
      {!loading && filtered.length === 0 && <p className={styles.muted}>No users match.</p>}

      {!loading && filtered.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>User</th>
              <th>Projects</th>
              <th>Posts</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => {
              const isSelf = u.id === user?.id
              const busy = busyId === u.id
              return (
                <tr key={u.id}>
                  <td>
                    <div className={styles.userCell}>
                      <span className={styles.userName}>{u.full_name || '—'}</span>
                      <span className={styles.userEmail}>{u.email}</span>
                    </div>
                  </td>
                  <td>{u.project_count}</td>
                  <td>{u.post_count}</td>
                  <td>
                    <div className={styles.badges}>
                      {u.is_admin && <span className={`${styles.badge} ${styles.badgeAdmin}`}>admin</span>}
                      {u.suspended && <span className={`${styles.badge} ${styles.badgeDanger}`}>suspended</span>}
                      {u.publish_banned && <span className={`${styles.badge} ${styles.badgeWarn}`}>publish ban</span>}
                    </div>
                  </td>
                  <td>
                    {isSelf ? (
                      <span className={styles.muted}>you</span>
                    ) : (
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.btn}
                          disabled={busy}
                          onClick={() => run(u.id, () => adminSetPublishBanned(u.id, !u.publish_banned))}
                        >
                          {u.publish_banned ? 'Unban publish' : 'Ban publish'}
                        </button>
                        <button
                          type="button"
                          className={styles.btn}
                          disabled={busy}
                          onClick={() => run(u.id, () => adminUserAction(u.suspended ? 'unsuspend-user' : 'suspend-user', u.id))}
                        >
                          {u.suspended ? 'Unsuspend' : 'Suspend'}
                        </button>
                        {deleteConfirmId === u.id ? (
                          <>
                            <button
                              type="button"
                              className={`${styles.btn} ${styles.btnDanger}`}
                              disabled={busy}
                              onClick={() => run(u.id, () => adminUserAction('delete-user', u.id))}
                            >
                              Confirm delete
                            </button>
                            <button type="button" className={styles.btn} onClick={() => setDeleteConfirmId(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnDanger}`}
                            disabled={busy}
                            onClick={() => setDeleteConfirmId(u.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
