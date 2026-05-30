import { useState } from 'react'
import { readFile } from '../../lib/workspace'
import styles from './ToolExecutionCard.module.css'

interface Props {
  tool: string
  args?: Record<string, string>
  result: string  // The display string from tool execution
  success: boolean // Whether the tool succeeded
}

export default function ToolExecutionCard({ tool, args = {}, result, success }: Props) {
  const [expanded, setExpanded] = useState(false)

  const config = getToolConfig(tool, result, args)

  return (
    <div className={`${styles.card} ${success ? styles.success : styles.failure}`}>
      <button
        className={styles.header}
        onClick={() => setExpanded(!expanded)}
      >
        <span className={styles.icon}>{config.icon}</span>
        <span className={styles.label}>{config.label}</span>
        {config.detail && (
          <span className={styles.detail}>{config.detail}</span>
        )}
        <span className={`${styles.badge} ${success ? styles.badgeOk : styles.badgeErr}`}>
          {success ? config.okText : config.errText}
        </span>
        {config.expandable && (
          <svg
            className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}
            width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {expanded && config.expandable && config.renderExpanded && (
        <div className={styles.expanded}>
          {config.renderExpanded()}
        </div>
      )}
    </div>
  )
}

/* ── Tool configuration ─────────────────────────── */

interface ToolConfig {
  icon: string
  label: string
  detail?: string
  okText: string
  errText: string
  expandable: boolean
  renderExpanded?: () => React.ReactNode
}

function getToolConfig(tool: string, result: string, args: Record<string, string>): ToolConfig {
  const ok = !result.includes('❌') && !result.includes('failed')

  switch (tool) {
    case 'list_files':
      return {
        icon: '📂',
        label: 'Listed files',
        okText: 'Done',
        errText: 'Failed',
        expandable: false,
      }

    case 'read_file':
      return {
        icon: '📖',
        label: 'Read file',
        detail: args.path ?? '',
        okText: 'Read',
        errText: 'Failed',
        expandable: true,
        renderExpanded: () => {
          const content = args.path ? readFile(args.path) : null
          return content ? (
            <div className={styles.codeBlock}>
              <div className={styles.codeMeta}>
                {args.path} — {content.split('\n').length} lines
              </div>
              <pre className={styles.code}><code>{content.slice(0, 2000)}{content.length > 2000 ? '\n...truncated' : ''}</code></pre>
            </div>
          ) : null
        },
      }

    case 'write_file': {
      const isNew = result.includes('📄') || result.includes('Created')
      return {
        icon: isNew ? '+' : '✎',
        label: isNew ? 'Created' : 'Modified',
        detail: args.path ?? '',
        okText: 'Written',
        errText: 'Failed',
        expandable: true,
        renderExpanded: () => {
          const content = args.path ? readFile(args.path) : null
          return content ? (
            <div className={styles.codeBlock}>
              <div className={styles.codeMeta}>
                {args.path} — {content.split('\n').length} lines
              </div>
              <pre className={styles.code}><code>{content.slice(0, 2000)}{content.length > 2000 ? '\n...truncated' : ''}</code></pre>
            </div>
          ) : null
        },
      }
    }

    case 'edit_file': {
      return {
        icon: '✎',
        label: 'Edited',
        detail: args.path ?? '',
        okText: 'Applied',
        errText: 'Failed',
        expandable: true,
        renderExpanded: () => {
          const content = args.path ? readFile(args.path) : null
          return content ? (
            <div className={styles.codeBlock}>
              <div className={styles.codeMeta}>
                {args.path}
              </div>
              <pre className={styles.code}><code>{content.slice(0, 2000)}{content.length > 2000 ? '\n...truncated' : ''}</code></pre>
            </div>
          ) : null
        },
      }
    }

    case 'delete_file':
      return {
        icon: '−',
        label: 'Deleted',
        detail: args.path ?? '',
        okText: 'Removed',
        errText: 'Failed',
        expandable: false,
      }

    case 'execute_build':
      return {
        icon: ok ? '✓' : '✗',
        label: ok ? 'Build passed' : 'Build failed',
        okText: ok ? 'Pass' : 'Fail',
        errText: 'Fail',
        expandable: !ok,
        renderExpanded: !ok ? () => (
          <div className={styles.errorBlock}>
            {result.replace(/^(?:✅|🔨)\s*(?:Build (?:passed|failed)[\s—–-]*)?/i, '') || 'No details available'}
          </div>
        ) : undefined,
      }

    case 'get_errors':
      return {
        icon: '⊙',
        label: 'Diagnostics',
        okText: 'OK',
        errText: 'Issues',
        expandable: true,
        renderExpanded: () => (
          <div className={styles.errorBlock}>
            {result || 'No diagnostics available'}
          </div>
        ),
      }

    default:
      return {
        icon: '·',
        label: tool,
        okText: 'Done',
        errText: 'Failed',
        expandable: false,
      }
  }
}
