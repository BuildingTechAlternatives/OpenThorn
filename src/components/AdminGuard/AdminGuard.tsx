import { Navigate } from 'react-router-dom'
import { useIsAdmin } from '../../lib/useIsAdmin'

/**
 * Gate for /admin routes. Non-admins (including signed-out visitors) are
 * sent to the dashboard — the admin area is not advertised to them.
 */
export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useIsAdmin()

  if (loading) return null
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
