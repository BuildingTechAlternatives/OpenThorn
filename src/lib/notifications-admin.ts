import { supabase } from './supabase'

export interface AdminNotificationRow {
  id: string
  text: string
  time_label: string
  is_active: boolean
  created_at: string
}

export interface NotificationDraft {
  text: string
  time_label: string
}

export async function adminListNotifications(): Promise<AdminNotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id,text,time_label,is_active,created_at')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as AdminNotificationRow[]
}

export async function adminSendNotification(draft: NotificationDraft): Promise<void> {
  const text = draft.text.trim()
  const timeLabel = draft.time_label.trim() || 'New'
  if (!text) throw new Error('Message is required')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action: 'send-notification', text, timeLabel }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || 'Notification failed')
  }
}

export async function adminSetNotificationActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function adminDeleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
