import { useState } from 'react'
import { readFile } from '../../lib/workspace'
import styles from './ToolExecutionCard.module.css'

interface Props {
  tool: string
  args?: Record<string, string>
  result: string
  success: boolean
}

export default function ToolExecutionCard({ tool, args = {}, result, success }: Props) {
  const [expanded, setExpanded] = useState(false)
  const config = getToolConfig(tool, result, success, args)
  const ExpandIcon = config.expandable ? (
    <svg
      className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}
      width="10" height="10" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ) : null

  return (
    <div className={`${styles.card} ${success ? styles.ok : styles.err}`}>
      <button
        className={styles.header}
        onClick={() => config.expandable && setExpanded(!expanded)}
      >
        <span className={styles.icon}>{config.icon}</span>
        <span className={styles.label}>{config.label}</span>
        <span className={styles.detail}>{config.detail}</span>
        <span className={`${styles.badge} ${success ? styles.badgeOk : styles.badgeErr}`}>
          {config.badge}
        </span>
        {ExpandIcon}
      </button>

      {expanded && config.expandable && config.body && (
        <div className={styles.body}>
          {config.body}
        </div>
      )}
    </div>
  )
}

/* ── Tool configuration ─────────────────────────── */

interface ToolConfig {
  icon: React.ReactNode
  label: string
  detail: string
  badge: string
  expandable: boolean
  body?: React.ReactNode
}

function getToolConfig(
  tool: string,
  result: string,
  success: boolean,
  args: Record<string, string>
): ToolConfig {
  switch (tool) {
    case 'list_files':
      return {
        icon: <ListIcon />,
        label: 'Listed files',
        detail: '',
        badge: 'Done',
        expandable: false,
      }

    case 'read_file': {
      const path = args.path ?? ''
      const content = path ? readFile(path) : null
      const lines = content ? content.split('\n').length : 0
      return {
        icon: <ReadIcon />,
        label: 'Read',
        detail: path,
        badge: success ? (lines > 0 ? `${lines} lines` : 'OK') : 'Failed',
        expandable: !!content,
        body: content ? <CodeBlock path={path} code={content} /> : undefined,
      }
    }

    case 'write_file': {
      const path = args.path ?? ''
      const content = path ? readFile(path) : null
      const lines = content ? content.split('\n').length : 0
      const isNew = result.includes('Created')
      return {
        icon: isNew ? <NewIcon /> : <EditIcon />,
        label: isNew ? 'Created' : 'Modified',
        detail: path,
        badge: success ? (lines > 0 ? `${lines} lines` : 'OK') : 'Failed',
        expandable: !!content,
        body: content ? <CodeBlock path={path} code={content} /> : undefined,
      }
    }

    case 'edit_file': {
      const path = args.path ?? ''
      const content = path ? readFile(path) : null
      return {
        icon: <EditIcon />,
        label: 'Edited',
        detail: path,
        badge: success ? 'Applied' : 'Failed',
        expandable: !!content,
        body: content ? <CodeBlock path={path} code={content} /> : undefined,
      }
    }

    case 'delete_file':
      return {
        icon: <TrashIcon />,
        label: 'Deleted',
        detail: args.path ?? '',
        badge: success ? 'Removed' : 'Failed',
        expandable: false,
      }

    case 'execute_build':
      return {
        icon: success ? <PassIcon /> : <FailIcon />,
        label: success ? 'Build passed' : 'Build failed',
        detail: '',
        badge: success ? 'Pass' : 'Fail',
        expandable: !success,
        body: !success ? (
          <pre className={styles.errorText}>
            {result.replace(/^(?:✅|🔨)\s*(?:Build (?:passed|failed)[\s—–-]*)?/i, '') || 'No details'}
          </pre>
        ) : undefined,
      }

    case 'get_errors':
      return {
        icon: <DiagnosticsIcon />,
        label: 'Diagnostics',
        detail: '',
        badge: success ? 'Clear' : 'Issues',
        expandable: !!result,
        body: result ? (
          <pre className={styles.errorText}>{result}</pre>
        ) : undefined,
      }

    default:
      return {
        icon: <DotIcon />,
        label: tool,
        detail: '',
        badge: success ? 'Done' : 'Failed',
        expandable: false,
      }
  }
}

/* ── Sub-components ─────────────────────────────── */

function CodeBlock({ path, code }: { path: string; code: string }) {
  const truncated = code.length > 3000 ? code.slice(0, 3000) + '\n\n/* … truncated */' : code
  return (
    <div className={styles.codeWrap}>
      <div className={styles.codeMeta}>
        {path} — {code.split('\n').length} lines
      </div>
      <pre className={styles.code}><code>{truncated}</code></pre>
    </div>
  )
}

/* ── SVG Icons ──────────────────────────────────── */

function ListIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function ReadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

function NewIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function PassIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function FailIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function DiagnosticsIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

function DotIcon() {
  return <span className={styles.dotIcon}>·</span>
}
