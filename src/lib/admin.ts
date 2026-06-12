import { supabase } from './supabase'

export interface AdminUserRow {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  is_admin: boolean
  suspended: boolean
  publish_banned: boolean
  project_count: number
  post_count: number
}

export type AdminUserAction = 'suspend-user' | 'unsuspend-user' | 'delete-user'

/** All users with per-user counts. Server-side admin check via RPC. */
export async function adminListUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc('admin_list_users')
  if (error) throw new Error(error.message)
  return (data ?? []) as AdminUserRow[]
}

/** Calls the /api/admin endpoint for actions that need the service role. */
export async function adminUserAction(action: AdminUserAction, userId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, userId }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || 'Admin action failed')
  }
}

/** Toggle a user's permission to publish to the community (direct, via admin RLS). */
export async function adminSetPublishBanned(userId: string, banned: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ publish_banned: banned })
    .eq('id', userId)
  if (error) throw new Error(error.message)
}
