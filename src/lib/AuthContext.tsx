import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { getErrorMessage, logError } from './errors'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string; needsConfirmation?: boolean }>
  signInWithGoogle: () => Promise<void>
  signInWithGitHub: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          logError('AuthSession', error)
        }
        setSession(session)
        setUser(session?.user ?? null)
      })
      .catch((error) => {
        logError('AuthSession', error)
        setSession(null)
        setUser(null)
      })
      .finally(() => setLoading(false))

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error: error.message }
      return {}
    } catch (error) {
      logError('AuthSignIn', error)
      return { error: getErrorMessage(error, 'Could not sign in. Please try again.') }
    }
  }

  const signUp = async (email: string, password: string, name: string): Promise<{ error?: string; needsConfirmation?: boolean }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })
      if (error) return { error: error.message }
      // If no session returned, email confirmation is required
      if (!data.session) return { needsConfirmation: true }
      return {}
    } catch (error) {
      logError('AuthSignUp', error)
      return { error: getErrorMessage(error, 'Could not create your account. Please try again.') }
    }
  }

  const resetPassword = async (email: string): Promise<{ error?: string }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/dashboard`,
      })
      if (error) return { error: error.message }
      return {}
    } catch (error) {
      logError('AuthPasswordReset', error)
      return { error: getErrorMessage(error, 'Could not send a reset link. Please try again.') }
    }
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) throw error
  }

  const signInWithGitHub = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      logError('AuthSignOut', error)
      throw error
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signIn, signUp, signInWithGoogle, signInWithGitHub, resetPassword, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Auth provider for build-time SSR (src/entry-ssr.tsx): renders children in the
 * logged-out, non-loading state so public pages emit their full marketing
 * content. All actions are no-ops — nothing interactive runs during prerender.
 */
export function StaticAuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        user: null,
        session: null,
        loading: false,
        signIn: async () => ({}),
        signUp: async () => ({}),
        signInWithGoogle: async () => {},
        signInWithGitHub: async () => {},
        resetPassword: async () => ({}),
        signOut: async () => {},
      }}
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
