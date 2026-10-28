import { useEffect, useState, useCallback } from 'react'
import {
  adminDeleteNotification,
  adminListNotifications,
  adminSendNotification,
  adminSetNotificationActive,
  type AdminNotificationRow,
} from '../../lib/notifications-admin'
import styles from './AdminNotificationsPage.module.css'

type Status = { kind: 'ok' | 'error'; text: string } | null

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminNotificationsPage() {
  const [rows, setRows] = useState<AdminNotificationRow[]>([])
  const [message, setMessage] = useState('')
  const [timeLabel, setTimeLabel] = useState('New')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await adminListNotifications())
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Could not load notifications' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const run = useCallback(async (label: string, fn: () => Promise<void>, okText: string) => {
    setBusy(label)
    setStatus(null)
    try {
      await fn()
      setStatus({ kind: 'ok', text: okText })
      await load()
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Action failed' })
    } finally {
      setBusy(null)
    }
  }, [load])

  const send = () => run('send', async () => {
    await adminSendNotification({ text: message, time_label: timeLabel })
    setMessage('')
    setTimeLabel('New')
  }, 'Notification sent to the dashboard bell.')

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Notifications</h1>
          <p className={styles.muted}>Send dashboard bell messages to all signed-in users.</p>
        </div>
      </div>

      {status && (
        <div className={status.kind === 'ok' ? styles.ok : styles.error} role="status">
          {status.text}
        </div>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>New bell message</h2>
        <textarea
          className={styles.textarea}
          rows={4}
          maxLength={240}
          placeholder="Tell users what changed..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className={styles.formRow}>
          <label className={styles.field}>
            <span className={styles.label}>Time label</span>
            <input
              className={styles.input}
              type="text"
              maxLength={24}
              value={timeLabel}
              onChange={(e) => setTimeLabel(e.target.value)}
              placeholder="New"
            />
          </label>
          <button className={styles.btn} type="button" disabled={!message.trim() || busy === 'send'} onClick={send}>
            {busy === 'send' ? 'Sending...' : 'Send to all users'}
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Recent messages</h2>
        {loading ? (
          <p className={styles.muted}>Loading notifications...</p>
        ) : rows.length === 0 ? (
          <p className={styles.muted}>No notifications yet.</p>
        ) : (
          <div className={styles.table}>
            {rows.map((row) => (
              <article key={row.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <div className={styles.rowMeta}>
                    <span className={row.is_active ? styles.badgeActive : styles.badgeMuted}>
                      {row.is_active ? 'active' : 'inactive'}
                    </span>
                    <span>{row.time_label}</span>
                    <span>{formatDate(row.created_at)}</span>
                  </div>
                  <p className={styles.message}>{row.text}</p>
                </div>
                <div className={styles.actions}>
                  <button
                    className={styles.btnSmall}
                    type="button"
                    disabled={busy === `toggle:${row.id}`}
                    onClick={() => run(
                      `toggle:${row.id}`,
                      () => adminSetNotificationActive(row.id, !row.is_active),
                      row.is_active ? 'Notification hidden.' : 'Notification reactivated.',
                    )}
                  >
                    {row.is_active ? 'Hide' : 'Reactivate'}
                  </button>
                  <button
                    className={styles.btnDanger}
                    type="button"
                    disabled={busy === `delete:${row.id}`}
                    onClick={() => run(`delete:${row.id}`, () => adminDeleteNotification(row.id), 'Notification deleted.')}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
