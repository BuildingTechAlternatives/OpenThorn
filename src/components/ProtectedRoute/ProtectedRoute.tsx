import { useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import AuthModal from '../AuthModal/AuthModal'
import styles from './ProtectedRoute.module.css'

interface ProtectedRouteProps {
  children: React.ReactNode
  pageName?: string
}

export default function ProtectedRoute({ children, pageName }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'signin' | 'signup'>('signin')

  if (loading) return null

  if (!user) {
    const openSignIn = () => { setModalMode('signin'); setModalOpen(true) }
    const openSignUp = () => { setModalMode('signup'); setModalOpen(true) }

    return (
      <div className={styles.gate}>
        <div className={styles.card}>
          <div className={styles.logo}>
            <img src="/assets/logo.png" alt="OpenThorn" className={styles.logoImg} />
          </div>
          <h1 className={styles.heading}>Sign in to continue</h1>
          <p className={styles.subtext}>
            {pageName
              ? `You need an account to access ${pageName}.`
              : 'You need an account to access this page.'}
          </p>
          <div className={styles.actions}>
            <button className={styles.btnPrimary} onClick={openSignUp}>
              Create account
            </button>
            <button className={styles.btnSecondary} onClick={openSignIn}>
              Sign in
            </button>
          </div>
        </div>
        <AuthModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          initialMode={modalMode}
        />
      </div>
    )
  }

  return <>{children}</>
}
