import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from './supabase'

/**
 * Resolves whether the signed-in user is an admin (profiles.is_admin).
 * RLS lets every user read their own row, so this is safe to call anywhere.
 */
export function useIsAdmin(): { isAdmin: boolean; loading: boolean } {
  const { user, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setIsAdmin(false)
      setLoading(false)
      return
    }
    let cancelled = false
    supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!cancelled) {
          setIsAdmin(Boolean(data?.is_admin))
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [user, authLoading])

  return { isAdmin, loading: loading || authLoading }
}
