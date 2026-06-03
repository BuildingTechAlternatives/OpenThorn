import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { AgentCodeFile } from './agent'

export interface CollaboratorPresence {
  userId: string
  name: string
  initials: string
}

export interface CollaborationOptions {
  projectId: string | undefined
  userId: string | undefined
  userName: string
  onFilesUpdate: (files: AgentCodeFile[]) => void
  onChatUpdate: (chat: unknown[]) => void
  onGeneratingChange: (generating: boolean, generatingBy: string | null) => void
}

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function useCollaboration({
  projectId,
  userId,
  userName,
  onFilesUpdate,
  onChatUpdate,
  onGeneratingChange,
}: CollaborationOptions) {
  const [onlineCollaborators, setOnlineCollaborators] = useState<CollaboratorPresence[]>([])

  // Keep callback refs current to avoid stale closures in subscription handlers
  const onFilesUpdateRef = useRef(onFilesUpdate)
  const onChatUpdateRef = useRef(onChatUpdate)
  const onGeneratingChangeRef = useRef(onGeneratingChange)
  useEffect(() => { onFilesUpdateRef.current = onFilesUpdate }, [onFilesUpdate])
  useEffect(() => { onChatUpdateRef.current = onChatUpdate }, [onChatUpdate])
  useEffect(() => { onGeneratingChangeRef.current = onGeneratingChange }, [onGeneratingChange])

  useEffect(() => {
    if (!projectId || !userId) return

    const initials = getInitials(userName)

    const channel = supabase.channel(`project:${projectId}`, {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ userId: string; name: string; initials: string }>()
        const others = Object.values(state)
          .flat()
          .filter((p) => p.userId !== userId)
        setOnlineCollaborators(others)
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${projectId}`,
        },
        (payload) => {
          const row = payload.new as {
            files?: AgentCodeFile[]
            chat_history?: unknown[]
            generating?: boolean
            generating_by?: string | null
          }
          if (Array.isArray(row.files)) onFilesUpdateRef.current(row.files)
          if (Array.isArray(row.chat_history)) onChatUpdateRef.current(row.chat_history)
          if (typeof row.generating === 'boolean') {
            onGeneratingChangeRef.current(row.generating, row.generating_by ?? null)
          }
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userId, name: userName, initials })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, userId, userName])

  return { onlineCollaborators }
}
