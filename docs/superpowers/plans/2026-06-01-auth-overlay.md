# Auth Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add production-ready authentication overlay to Bloom with Supabase Auth (Email, Google, GitHub).

**Architecture:** Supabase client singleton (`src/lib/supabase.ts`) → AuthProvider context (`src/lib/AuthContext.tsx`) wraps app → AuthModal component renders full-screen overlay with Sign In / Sign Up tabs, social OAuth buttons, and email form → Header consumes auth state to swap buttons for avatar.

**Tech Stack:** React 19, TypeScript, Vite, framer-motion, react-router-dom, @supabase/supabase-js

---

### Task 1: Environment Setup & Dependencies

**Files:**
- Modify: `.env` (create)
- Modify: `package.json`

- [ ] **Step 1: Create `.env` file**

```
VITE_SUPABASE_URL=https://ofssvvittiiysoibojts.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mc3N2dml0dGlpeXNvaWJvanRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMjAxNTQsImV4cCI6MjA5NTg5NjE1NH0.grl2-K48tDs5Q-nPA8Gb4kK3Tbql3sAjMEOr38ZvNYE
```

- [ ] **Step 2: Install supabase-js**

Run: `npm install @supabase/supabase-js`
Expected: Package added to package.json, no errors.

- [ ] **Step 3: Verify `.env` is in `.gitignore`**

Run: `Get-Content .gitignore | Select-String ".env"`
Expected: Should find `.env` in gitignore. If not, add it:

```
.env
.env.local
```

- [ ] **Step 4: Commit**

```bash
git add .env.example package.json package-lock.json
git commit -m "chore: add @supabase/supabase-js dependency and env template"
```

---

### Task 2: Supabase Client Singleton

**Files:**
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Create supabase client**

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: add Supabase client singleton"
```

---

### Task 3: AuthContext Provider

**Files:**
- Create: `src/lib/AuthContext.tsx`

- [ ] **Step 1: Create AuthContext with full implementation**

```typescript
// src/lib/AuthContext.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string }>
  signInWithGoogle: () => Promise<void>
  signInWithGitHub: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return {}
  }

  const signUp = async (email: string, password: string, name: string): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })
    if (error) return { error: error.message }
    return {}
  }

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const signInWithGitHub = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signIn, signUp, signInWithGoogle, signInWithGitHub, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within SupabaseAuthProvider')
  return ctx
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/AuthContext.tsx
git commit -m "feat: add SupabaseAuthProvider and useAuth hook"
```

---

### Task 4: SocialButton Component

**Files:**
- Create: `src/components/AuthModal/SocialButton.tsx`
- Create: `src/components/AuthModal/SocialButton.module.css`

- [ ] **Step 1: Create SocialButton component**

```typescript
// src/components/AuthModal/SocialButton.tsx
import type { MouseEvent } from 'react'
import styles from './SocialButton.module.css'

interface SocialButtonProps {
  provider: 'google' | 'github'
  onClick: (e: MouseEvent) => void
  loading?: boolean
}

const providerConfig = {
  google: {
    label: 'Continue with Google',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
  },
  github: {
    label: 'Continue with GitHub',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
      </svg>
    ),
  },
}

export default function SocialButton({ provider, onClick, loading = false }: SocialButtonProps) {
  const config = providerConfig[provider]

  return (
    <button
      className={styles.btn}
      onClick={onClick}
      disabled={loading}
      type="button"
    >
      <span className={styles.icon}>
        {loading ? <span className={styles.spinner} /> : config.icon}
      </span>
      <span className={styles.label}>{config.label}</span>
    </button>
  )
}
```

- [ ] **Step 2: Create SocialButton styles**

```css
/* src/components/AuthModal/SocialButton.module.css */
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  height: 48px;
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--color-border-visible);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  text-decoration: none;
  position: relative;
}

.btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--color-border-glow);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.label {
  flex: 0 0 auto;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--color-text-secondary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/AuthModal/SocialButton.tsx src/components/AuthModal/SocialButton.module.css
git commit -m "feat: add SocialButton component for OAuth providers"
```

---

### Task 5: AuthForm Component

**Files:**
- Create: `src/components/AuthModal/AuthForm.tsx`
- Create: `src/components/AuthModal/AuthForm.module.css`

- [ ] **Step 1: Create AuthForm component**

```typescript
// src/components/AuthModal/AuthForm.tsx
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
```

- [ ] **Step 2: Create AuthForm styles**

```css
/* src/components/AuthModal/AuthForm.module.css */
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.input {
  height: 48px;
  padding: 0 14px;
  border-radius: var(--radius-md);
  font-size: 15px;
  font-family: var(--font-body);
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--color-border-visible);
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.input::placeholder {
  color: var(--color-text-muted);
}

.input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
}

.input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.inputError {
  border-color: #EF4444;
}

.inputError:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
}

.fieldError {
  font-size: 12px;
  color: #FCA5A5;
}

.passwordWrapper {
  position: relative;
}

.passwordWrapper .input {
  width: 100%;
  padding-right: 44px;
}

.passwordToggle {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.15s ease;
  font-family: inherit;
}

.passwordToggle:hover {
  color: var(--color-text-secondary);
}

.errorBanner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #FCA5A5;
  font-size: 14px;
  line-height: 1.4;
}

.errorBanner svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.submitBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 48px;
  border-radius: var(--radius-full);
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #08050C;
  background: var(--color-accent);
  border: none;
  cursor: pointer;
  transition: opacity 0.2s ease, transform 0.15s ease;
  margin-top: 4px;
}

.submitBtn:hover:not(:disabled) {
  opacity: 0.92;
}

.submitBtn:active:not(:disabled) {
  transform: scale(0.98);
}

.submitBtn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/AuthModal/AuthForm.tsx src/components/AuthModal/AuthForm.module.css
git commit -m "feat: add AuthForm component with validation"
```

---

### Task 6: AuthModal Component

**Files:**
- Create: `src/components/AuthModal/AuthModal.tsx`
- Create: `src/components/AuthModal/AuthModal.module.css`

- [ ] **Step 1: Create AuthModal component**

```typescript
// src/components/AuthModal/AuthModal.tsx
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
```

- [ ] **Step 2: Create AuthModal styles**

```css
/* src/components/AuthModal/AuthModal.module.css */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
  background: rgba(7, 5, 10, 0.75);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
}

.card {
  position: relative;
  width: 100%;
  max-width: 420px;
  padding: 32px;
  background: var(--color-surface-overlay);
  border: 1px solid var(--color-border-visible);
  border-radius: var(--radius-xl);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(139, 92, 246, 0.04);
  max-height: calc(100vh - 48px);
  overflow-y: auto;
}

.closeBtn {
  position: absolute;
  top: 14px;
  right: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
  font-family: inherit;
}

.closeBtn:hover {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.06);
}

/* Tabs */
.tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: var(--radius-full);
  margin-bottom: 24px;
}

.tab {
  flex: 1;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.tab:hover {
  color: var(--color-text);
}

.tabActive {
  background: var(--color-accent);
  color: #fff;
}

.tabActive:hover {
  color: #fff;
}

/* Social buttons */
.socials {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

/* Divider */
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.dividerLine {
  flex: 1;
  height: 1px;
  background: var(--color-border-visible);
}

.dividerText {
  font-size: 12px;
  color: var(--color-text-muted);
  white-space: nowrap;
}

/* Terms */
.terms {
  text-align: center;
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.5;
  margin-top: 20px;
}

.termsLink {
  color: var(--color-accent);
  text-decoration: none;
  transition: opacity 0.15s ease;
}

.termsLink:hover {
  opacity: 0.8;
  text-decoration: underline;
}

@media (max-width: 480px) {
  .card {
    padding: 24px 20px;
  }
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/AuthModal/AuthModal.tsx src/components/AuthModal/AuthModal.module.css
git commit -m "feat: add AuthModal overlay with sign in / sign up tabs"
```

---

### Task 7: Update Header for Auth Awareness

**Files:**
- Modify: `src/components/Header/Header.tsx`
- Modify: `src/components/Header/Header.module.css`

- [ ] **Step 1: Update Header component**

The Header currently has hardcoded buttons. Replace with auth-aware logic:

```typescript
// src/components/Header/Header.tsx
// ... (keep existing imports)
import { useAuth } from '../../lib/AuthContext'
// ...

interface HeaderProps {
  onSignIn: () => void
  onSignUp: () => void
}

export default function Header({ onSignIn, onSignUp }: HeaderProps) {
  const { user, loading } = useAuth()
  // ... (keep all existing state and refs)
```

Replace the actions div:
```tsx
// Replace this:
// <div className={styles.actions}>
//   <NeumorphButton>Sign in</NeumorphButton>
//   <SlideInButton>Start free</SlideInButton>
//   ...
// </div>

// With this:
<div className={styles.actions}>
  {loading ? null : user ? (
    <>
      <div className={styles.avatar} title={user.email}>
        {user.user_metadata?.full_name
          ? user.user_metadata.full_name.charAt(0).toUpperCase()
          : user.email?.charAt(0).toUpperCase()}
      </div>
      <SlideInButton>Dashboard</SlideInButton>
    </>
  ) : (
    <>
      <NeumorphButton onClick={onSignIn}>Sign in</NeumorphButton>
      <SlideInButton onClick={onSignUp}>Start free</SlideInButton>
    </>
  )}
  <button className={styles.mobileMenuBtn} aria-label="Menu" onClick={() => setMobileOpen(true)}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12h18M3 6h18M3 18h18" />
    </svg>
  </button>
</div>
```

To make NeumorphButton work with onClick (it currently wraps a `<button>` without an href — check: yes, when no `href` it renders `<button onClick={onClick}>`), so this works.

To make SlideInButton work with onClick: same — it renders `<button onClick={onClick}>` when no `href`.

- [ ] **Step 2: Add avatar styles to Header.module.css**

Append to `src/components/Header/Header.module.css`:

```css
/* Avatar */
.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--color-accent);
  color: #08050C;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  cursor: default;
  flex-shrink: 0;
  user-select: none;
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/Header/Header.tsx src/components/Header/Header.module.css
git commit -m "feat: make Header auth-aware with user avatar and modal triggers"
```

---

### Task 8: Wire Everything Together

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Wrap app in SupabaseAuthProvider**

Modify `src/main.tsx`:

```typescript
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SupabaseAuthProvider } from './lib/AuthContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SupabaseAuthProvider>
        <App />
      </SupabaseAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 2: Add AuthModal and state management to App**

Modify `src/App.tsx`:

```typescript
// src/App.tsx
import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'
import Header from './components/Header/Header'
import HeroSection from './components/HeroSection/HeroSection'
import MeetBloomSection from './components/MeetBloomSection/MeetBloomSection'
import BYOKSection from './components/BYOKSection/BYOKSection'
import BottomCTA from './components/BottomCTA/BottomCTA'
import Footer from './components/Footer/Footer'
import PricingPage from './pages/PricingPage'
import NotFoundPage from './pages/NotFoundPage'
import AuthModal from './components/AuthModal/AuthModal'
import styles from './App.module.css'

function HomePage() {
  return (
    <>
      <HeroSection />
      <MeetBloomSection />
      <BYOKSection />
      <BottomCTA />
    </>
  )
}

function Layout({ children }: { children: React.ReactNode }) {
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin')

  const openSignIn = () => { setAuthModalMode('signin'); setAuthModalOpen(true) }
  const openSignUp = () => { setAuthModalMode('signup'); setAuthModalOpen(true) }

  return (
    <>
      <Header onSignIn={openSignIn} onSignUp={openSignUp} />
      <main>{children}</main>
      <Footer />
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <div className={styles.app}>
        <Routes>
          <Route path="/" element={<Layout><HomePage /></Layout>} />
          <Route path="/pricing" element={<Layout><PricingPage /></Layout>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </ErrorBoundary>
  )
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors.

- [ ] **Step 4: Start dev server and test**

Run: `npm run dev`
Expected: Dev server starts. Navigate to http://localhost:5173, click "Sign in" → modal opens. Click "Start free" → modal opens with Sign Up tab. Social buttons render. Form validates.

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx src/App.tsx
git commit -m "feat: wire up AuthProvider, AuthModal, and auth-aware Header"
```

---

### Task 9: Configure Supabase Auth Providers

**Files:** None (dashboard configuration)

- [ ] **Step 1: Verify email auth is enabled**

Email/Password auth is enabled by default in Supabase. No action needed unless the user wants to disable "Confirm email" for development.

- [ ] **Step 2: Set up Google OAuth provider**

In the Supabase dashboard at https://supabase.com/dashboard/project/ofssvvittiiysoibojts/auth/providers:
1. Enable Google provider
2. Configure Google Cloud Console OAuth credentials:
   - Authorized redirect URI: `https://ofssvvittiiysoibojts.supabase.co/auth/v1/callback`
3. Add Client ID and Client Secret

- [ ] **Step 3: Set up GitHub OAuth provider**

In the same dashboard section:
1. Enable GitHub provider
2. Configure GitHub OAuth App:
   - Authorization callback URL: `https://ofssvvittiiysoibojts.supabase.co/auth/v1/callback`
3. Add Client ID and Client Secret

- [ ] **Step 4: Set Site URL in Supabase**

In Authentication → URL Configuration:
- Site URL: `http://localhost:5173` (for dev)
- Redirect URLs: `http://localhost:5173, https://*.netlify.app` (or production URL)

---

### Task 10: Final Verification

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Manual test checklist**

1. Click "Sign in" → modal opens in sign-in mode
2. Click "Sign up" tab → switches to sign-up form with name field
3. Click backdrop → modal closes
4. Press Escape → modal closes
5. Submit empty form → field-level validation errors appear
6. Enter invalid email → "Please enter a valid email"
7. Enter password < 8 chars → "Password must be at least 8 characters"
8. Sign-up: mismatch passwords → "Passwords do not match"
9. Social buttons render with correct icons
10. Tab between inputs works, focus styles visible

- [ ] **Step 3: Commit any final tweaks**

```bash
git add -A
git commit -m "chore: final auth overlay tweaks and verification"
```
