import { Component, type ErrorInfo, type ReactNode } from 'react'
import styles from './ErrorBoundary.module.css'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  static isChunkError(error: Error | null): boolean {
    if (!error) return false
    const msg = error.message ?? ''
    return (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      error.name === 'ChunkLoadError'
    )
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      const isChunk = ErrorBoundary.isChunkError(this.state.error)
      return (
        <div className={styles.root}>
          <div className={styles.card}>
            <span className={styles.icon} aria-hidden="true">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </span>
            <h1 className={styles.title}>
              {isChunk ? 'Update available' : 'Something went sideways'}
            </h1>
            <p className={styles.message}>
              {isChunk
                ? 'OpenThorn was updated. Refresh the page to load the latest version.'
                : (this.state.error?.message || 'An unexpected error occurred. We\'ve logged it and will investigate.')}
            </p>
            <button
              className={styles.button}
              onClick={isChunk ? () => window.location.reload() : this.handleReset}
            >
              {isChunk ? 'Refresh page' : 'Reload'}
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
