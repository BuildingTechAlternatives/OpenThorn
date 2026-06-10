import { Link } from 'react-router-dom'
import { usePageTitle } from '../lib/usePageTitle'
import styles from './NotFoundPage.module.css'

export default function NotFoundPage() {
  usePageTitle('Page Not Found', {
    description: 'The page you are looking for could not be found.',
  })
  return (
    <div className={styles.root}>
      <div className={styles.inner}>
        <img src="/assets/logo.png" alt="OpenThorn" className={styles.logo} />
        <span className={styles.code} aria-hidden="true">404</span>
        <h1 className={styles.title}>This page wandered off</h1>
        <p className={styles.message}>
          We couldn't find that page. It might have moved, or the URL might be incorrect.
        </p>
        <div className={styles.actions}>
          <Link to="/" className={styles.button}>
            Back to OpenThorn
          </Link>
          <Link to="/faq" className={styles.ghostLink}>
            Visit the FAQ
          </Link>
        </div>
      </div>
    </div>
  )
}
