import { useState, useEffect, useCallback } from 'react'
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
    transition: { duration: 0.25, ease: [0.34, 1.56, 0.64, 1] },
  },
  exit: { opacity: 0, scale: 0.95, y: 4, transition: { duration: 0.15 } },
}

export default function AuthModal({ isOpen, onClose, initialMode }: AuthModalProps) {
  const { signIn, signUp, signInWithGoogle, signInWithGitHub } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [socialLoading, setSocialLoading] = useState<'google' | 'github' | null>(null)

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode)
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

    let result: { error?: string }

    if (mode === 'signup') {
      result = await signUp(data.email, data.password, data.name ?? '')
    } else {
      result = await signIn(data.email, data.password)
    }

    setLoading(false)

    if (result.error) {
      setError(result.error)
    }
  }, [mode, signIn, signUp])

  const switchMode = (newMode: 'signin' | 'signup') => {
    setMode(newMode)
    setError(null)
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
          aria-label={mode === 'signin' ? 'Sign in' : 'Sign up'}
        >
          <motion.div
            className={styles.card}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            {/* Tab switcher */}
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${mode === 'signin' ? styles.tabActive : ''}`}
                onClick={() => switchMode('signin')}
                type="button"
              >
                Sign in
              </button>
              <button
                className={`${styles.tab} ${mode === 'signup' ? styles.tabActive : ''}`}
                onClick={() => switchMode('signup')}
                type="button"
              >
                Sign up
              </button>
            </div>

            {/* Social buttons */}
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

            {/* Divider */}
            <div className={styles.divider}>
              <span className={styles.dividerLine} />
              <span className={styles.dividerText}>or continue with email</span>
              <span className={styles.dividerLine} />
            </div>

            {/* Email form */}
            <AuthForm
              mode={mode}
              onSubmit={handleSubmit}
              loading={loading}
              error={error}
              onClearError={() => setError(null)}
            />

            {/* Terms (signup only) */}
            {mode === 'signup' && (
              <p className={styles.terms}>
                By continuing, you agree to our{' '}
                <a href="#" className={styles.termsLink}>Terms of Service</a>
                {' '}and{' '}
                <a href="#" className={styles.termsLink}>Privacy Policy</a>
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
