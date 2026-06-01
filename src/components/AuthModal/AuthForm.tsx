import { useState, type FormEvent } from 'react'
import styles from './AuthForm.module.css'

interface AuthFormProps {
  mode: 'signin' | 'signup'
  onSubmit: (data: { email: string; password: string; name?: string }) => Promise<void>
  loading: boolean
  error: string | null
  onClearError: () => void
}

export default function AuthForm({ mode, onSubmit, loading, error, onClearError }: AuthFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const errors: Record<string, string> = {}

    if (mode === 'signup' && !name.trim()) {
      errors.name = 'Name is required'
    }

    if (!email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email'
    }

    if (!password) {
      errors.password = 'Password is required'
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    }

    if (mode === 'signup' && password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    onClearError()
    if (!validate()) return
    await onSubmit({ email, password, name: mode === 'signup' ? name : undefined })
  }

  const handleInputChange = (field: string) => {
    onClearError()
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {mode === 'signup' && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="auth-name">Name</label>
          <input
            id="auth-name"
            className={`${styles.input} ${fieldErrors.name ? styles.inputError : ''}`}
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => { setName(e.target.value); handleInputChange('name') }}
            disabled={loading}
            autoComplete="name"
          />
          {fieldErrors.name && <span className={styles.fieldError}>{fieldErrors.name}</span>}
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="auth-email">Email</label>
        <input
          id="auth-email"
          className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); handleInputChange('email') }}
          disabled={loading}
          autoComplete="email"
        />
        {fieldErrors.email && <span className={styles.fieldError}>{fieldErrors.email}</span>}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="auth-password">Password</label>
        <div className={styles.passwordWrapper}>
          <input
            id="auth-password"
            className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => { setPassword(e.target.value); handleInputChange('password') }}
            disabled={loading}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>
        {fieldErrors.password && <span className={styles.fieldError}>{fieldErrors.password}</span>}
      </div>

      {mode === 'signup' && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="auth-confirm-password">Confirm password</label>
          <input
            id="auth-confirm-password"
            className={`${styles.input} ${fieldErrors.confirmPassword ? styles.inputError : ''}`}
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); handleInputChange('confirmPassword') }}
            disabled={loading}
            autoComplete="new-password"
          />
          {fieldErrors.confirmPassword && <span className={styles.fieldError}>{fieldErrors.confirmPassword}</span>}
        </div>
      )}

      {error && (
        <div className={styles.errorBanner}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{error}</span>
        </div>
      )}

      <button className={styles.submitBtn} type="submit" disabled={loading}>
        {loading
          ? (mode === 'signup' ? 'Creating account…' : 'Signing in…')
          : (mode === 'signup' ? 'Create account' : 'Sign in')
        }
      </button>
    </form>
  )
}
