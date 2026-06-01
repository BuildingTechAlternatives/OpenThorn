import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/AuthContext'
import SocialButton from './SocialButton'
import AuthForm from './AuthForm'
import styles from './AuthModal.module.css'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode: 'signin' | 'signup'
}

type ViewMode = 'signin' | 'signup' | 'forgotPassword'
type SuccessType = 'signup' | 'resetPassword' | null

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.34, 1.56, 0.64, 1] as const },
  },
  exit: { opacity: 0, scale: 0.95, y: 4, transition: { duration: 0.15 } },
}

export default function AuthModal({ isOpen, onClose, initialMode }: AuthModalProps) {
  const { signIn, signUp, signInWithGoogle, signInWithGitHub, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode)
  const [success, setSuccess] = useState<SuccessType>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [socialLoading, setSocialLoading] = useState<'google' | 'github' | null>(null)
  const [successEmail, setSuccessEmail] = useState('')

  useEffect(() => {
    if (isOpen) {
      setViewMode(initialMode)
      setSuccess(null)
      setError(null)
      setLoading(false)
    }
  }, [isOpen, initialMode])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const handleSocialLogin = useCallback(async (provider: 'google' | 'github') => {
    setSocialLoading(provider)
    setError(null)
    try {
      if (provider === 'google') await signInWithGoogle()
      else await signInWithGitHub()
    } catch {
      setError('Something went wrong. Please try again.')
      setSocialLoading(null)
    }
  }, [signInWithGoogle, signInWithGitHub])

  const handleSubmit = useCallback(async (data: { email: string; password: string; name?: string }) => {
    setLoading(true)
    setError(null)

    if (viewMode === 'signup') {
      const result = await signUp(data.email, data.password, data.name ?? '')
      setLoading(false)
      if (result.error) {
        setError(result.error)
      } else if (result.needsConfirmation) {
        setSuccessEmail(data.email)
        setSuccess('signup')
      } else {
        onClose()
        navigate('/dashboard')
      }
    } else {
      const result = await signIn(data.email, data.password)
      setLoading(false)
      if (result.error) {
        setError(result.error)
      } else {
        onClose()
        navigate('/dashboard')
      }
    }
  }, [viewMode, signIn, signUp, onClose, navigate])

  const handleForgotPassword = useCallback(async (email: string) => {
    setLoading(true)
    setError(null)
    const result = await resetPassword(email)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccessEmail(email)
      setSuccess('resetPassword')
    }
  }, [resetPassword])

  const switchView = (newMode: ViewMode) => {
    setViewMode(newMode)
    setError(null)
    setSuccess(null)
  }

  const renderContent = () => {
    // Success states
    if (success === 'signup') {
      return (
        <div className={styles.successState}>
          <div className={styles.successIcon}>
            <img src="/assets/logo.png" alt="Bloom" className={styles.successLogo} />
          </div>
          <h3 className={styles.successTitle}>Check your email</h3>
          <p className={styles.successText}>
            We sent a confirmation link to <strong>{successEmail}</strong>. Click the link to verify your account and get started.
          </p>
          <button className={styles.backBtn} onClick={() => { setSuccess(null); setViewMode('signin') }}>
            Back to sign in
          </button>
        </div>
      )
    }

    if (success === 'resetPassword') {
      return (
        <div className={styles.successState}>
          <div className={styles.successIcon}>
            <img src="/assets/logo.png" alt="Bloom" className={styles.successLogo} />
          </div>
          <h3 className={styles.successTitle}>Reset link sent</h3>
          <p className={styles.successText}>
            If an account exists for <strong>{successEmail}</strong>, you'll receive a password reset link shortly.
          </p>
          <button className={styles.backBtn} onClick={() => { setSuccess(null); setViewMode('signin') }}>
            Back to sign in
          </button>
        </div>
      )
    }

    // Normal form views
    return (
      <>
        {/* Bloom logo */}
        <div className={styles.brandIcon}>
          <img src="/assets/logo.png" alt="Bloom" className={styles.brandLogo} />
        </div>

        {/* Tab switcher */}
        {viewMode !== 'forgotPassword' && (
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${viewMode === 'signin' ? styles.tabActive : ''}`}
              onClick={() => switchView('signin')}
              type="button"
            >
              Sign in
            </button>
            <button
              className={`${styles.tab} ${viewMode === 'signup' ? styles.tabActive : ''}`}
              onClick={() => switchView('signup')}
              type="button"
            >
              Sign up
            </button>
          </div>
        )}

        {/* Forgot password heading */}
        {viewMode === 'forgotPassword' && (
          <h3 className={styles.forgotHeading}>Reset your password</h3>
        )}

        {/* Social buttons */}
        {viewMode !== 'forgotPassword' && (
          <>
            <div className={styles.socials}>
              <SocialButton
                provider="google"
                onClick={() => handleSocialLogin('google')}
                loading={socialLoading === 'google'}
              />
              <SocialButton
                provider="github"
                onClick={() => handleSocialLogin('github')}
                loading={socialLoading === 'github'}
              />
            </div>

            <div className={styles.divider}>
              <span className={styles.dividerLine} />
              <span className={styles.dividerText}>or continue with email</span>
              <span className={styles.dividerLine} />
            </div>
          </>
        )}

        {/* Email form */}
        <AuthForm
          mode={viewMode}
          onSubmit={handleSubmit}
          onForgotPassword={handleForgotPassword}
          onBackToSignIn={() => switchView('signin')}
          loading={loading}
          error={error}
          onClearError={() => setError(null)}
        />

        {/* Terms (signup only) */}
        {viewMode === 'signup' && (
          <p className={styles.terms}>
            By continuing, you agree to our{' '}
            <a href="#" className={styles.termsLink}>Terms of Service</a>
            {' '}and{' '}
            <a href="#" className={styles.termsLink}>Privacy Policy</a>
          </p>
        )}

        {/* Forgot password link (signin only) */}
        {viewMode === 'signin' && (
          <p className={styles.forgotLink}>
            <button type="button" className={styles.forgotLinkBtn} onClick={() => switchView('forgotPassword')}>
              Forgot your password?
            </button>
          </p>
        )}
      </>
    )
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.overlay}
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: 0.2 }}
          onClick={onClose}
          aria-modal="true"
          role="dialog"
          aria-label={
            success ? 'Check your email' :
            viewMode === 'forgotPassword' ? 'Reset password' :
            viewMode === 'signin' ? 'Sign in' : 'Sign up'
          }
        >
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <motion.div
            className={styles.card}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {renderContent()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
