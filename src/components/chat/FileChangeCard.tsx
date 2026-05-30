import { useState } from 'react'
import { readFile } from '../../lib/workspace'
import styles from './FileChangeCard.module.css'

interface Props {
  icon: string // "📄" | "✏️" | "🗑️"
  action: string // "Created" | "Modified" | "Deleted" | "Edited"
  path: string
}

export default function FileChangeCard({ icon, action, path }: Props) {
  const [expanded, setExpanded] = useState(false)
  const content = action !== 'Deleted' ? readFile(path) : null
  const ext = path.split('.').pop()?.toLowerCase() ?? 'text'

  const actionClass =
    action === 'Created'
      ? styles.created
      : action === 'Deleted'
        ? styles.deleted
        : styles.modified

  return (
    <div className={`${styles.card} ${actionClass}`}>
      <button
        className={styles.header}
        onClick={() => content !== null && setExpanded(!expanded)}
        tabIndex={content !== null ? 0 : -1}
      >
        <span className={styles.icon}>{icon}</span>
        <span className={styles.action}>{action}</span>
        <span className={styles.path}>{path}</span>
        {content !== null && (
          <svg
            className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>
      {expanded && content !== null && (
        <div className={styles.codeBlock}>
          <div className={styles.codeHeader}>
            <span className={styles.lang}>{ext}</span>
            <span className={styles.lineCount}>
              {content.split('\n').length} lines
            </span>
          </div>
          <pre className={styles.code}>
            <code>{content}</code>
          </pre>
        </div>
      )}
    </div>
  )
}
