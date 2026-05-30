import { useState, useRef, useEffect, useCallback } from 'react'
import { useApp } from '../../App'
import { runAgentLoop } from '../../lib/agent-loop'
import { resetWorkspace } from '../../lib/workspace'
import { supabase } from '../../lib/supabase'
import type { ProviderConfig } from '../../lib/providers'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import styles from './ChatPanel.module.css'

export interface ContentBlock {
  type: 'text' | 'tool' | 'file_change' | 'status'
  content?: string
  icon?: string
  action?: string
  path?: string
  tool?: string
  toolArgs?: Record<string, string>
  toolResult?: string
  toolSuccess?: boolean
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  blocks?: ContentBlock[]
}

const welcomeMessage: Message = {
  id: 'welcome',
  role: 'assistant',
  text: "Hey! I'm Bloom, your AI coding companion. I build full-stack web applications using TypeScript and React — just describe what you want to create and I'll handle the rest.\n\n**Build mode**: I analyze, plan, build, and verify — all in one go, fixing errors automatically.\n**Plan mode**: I research and design the architecture first, then you approve before I write any code.\n\nWhat should we build today?",
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([welcomeMessage])
  const [mode, setMode] = useState<'plan' | 'build'>('build')
  const [providerId, setProviderId] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const [appearance, setAppearance] = useState<'light' | 'dark' | 'system'>('dark')
  const { navigateTo } = useApp()
  const bottomRef = useRef<HTMLDivElement>(null)
  const projectMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  const handleSend = useCallback(
    async (text: string) => {
      const userMsg: Message = { id: Date.now().toString(), role: 'user', text }
      setMessages((prev) => [...prev, userMsg])
      if (!providerId || !model) {
        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 1).toString(), role: 'assistant', text: 'Please select a provider and model first. Click the provider dropdown in the input bar.' },
        ])
        return
      }

      const { data: provider, error: providerError } = await supabase
        .from('providers')
        .select('*')
        .eq('id', providerId)
        .single()

      if (providerError || !provider) {
        console.error('Provider lookup failed:', providerError)
        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 1).toString(), role: 'assistant', text: 'Could not find your provider configuration. Please check your settings.' },
        ])
        return
      }

      const assistantId = (Date.now() + 1).toString()
      setStreaming(true)

      // Ordered content blocks — text, file cards, status interleaved chronologically
      const blocks: ContentBlock[] = []

      // Current streaming text block (gets flushed when a tool call starts)
      let currentTextBlock: ContentBlock | null = null

      function flushText() {
        if (currentTextBlock && currentTextBlock.content?.trim()) {
          blocks.push({ ...currentTextBlock })
          currentTextBlock = null
        }
      }

      function updateMessage() {
        const displayBlocks = [...blocks]
        if (currentTextBlock && currentTextBlock.content?.trim()) {
          displayBlocks.push({ ...currentTextBlock })
        }
        const fullText = displayBlocks
          .filter((b) => b.type === 'text')
          .map((b) => b.content)
          .join('\n\n')

        setMessages((prev) => {
          const existing = prev.find((m) => m.id === assistantId)
          if (existing) {
            return prev.map((m) =>
              m.id === assistantId
                ? { ...m, text: fullText, blocks: displayBlocks }
                : m
            )
          }
          return [
            ...prev,
            {
              id: assistantId,
              role: 'assistant' as const,
              text: fullText,
              blocks: displayBlocks,
            },
          ]
        })
      }

      try {
        for await (const event of runAgentLoop(
          text,
          provider as ProviderConfig,
          model,
          mode,
          messages
        )) {
          switch (event.type) {
            case 'text': {
              if (!currentTextBlock) {
                currentTextBlock = { type: 'text', content: '' }
              }
              currentTextBlock.content += event.content ?? ''
              updateMessage()
              break
            }

            case 'tool_call': {
              const tc = event.toolCall
              if (!tc) break

              // Flush current text before showing tool work
              flushText()

              // Add a status block with args for the tool result to use
              const statusText = getToolStatus(tc.name, tc.arguments)
              if (statusText) {
                blocks.push({
                  type: 'status',
                  content: statusText,
                  tool: tc.name,
                  toolArgs: tc.arguments,
                })
              }
              updateMessage()
              break
            }

            case 'tool_result': {
              const tr = event.toolResult
              if (!tr) break

              // Remove matching status block
              const statusIdx = findLastIndex(
                blocks,
                (b) => b.type === 'status'
              )
              if (statusIdx >= 0) {
                blocks.splice(statusIdx, 1)
              }

              // Determine success from display
              const isOk = !tr.display.includes('❌') &&
                !tr.display.includes('failed') &&
                !tr.display.includes('Error')

              // Extract args from the preceding tool_call — we store them in the status block
              blocks.push({
                type: 'tool',
                tool: tr.name,
                toolArgs: {},
                toolResult: tr.display,
                toolSuccess: isOk,
              })

              updateMessage()
              break
            }

            case 'error': {
              flushText()
              blocks.push({
                type: 'status',
                content: `❌ ${event.content}`,
              })
              updateMessage()
              break
            }

            case 'done': {
              flushText()
              updateMessage()
              break
            }
          }
        }
      } catch (e) {
        console.error('Agent loop error:', e)
        flushText()
        blocks.push({
          type: 'status',
          content: `❌ ${(e as Error).message}`,
        })
        updateMessage()
      } finally {
        setStreaming(false)
      }
    },
    [messages, providerId, model, mode]
  )

  useEffect(() => {
    if (!projectMenuOpen) return
    const onClick = (e: MouseEvent) => {
      if (
        projectMenuRef.current &&
        !projectMenuRef.current.contains(e.target as Node)
      ) {
        setProjectMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProjectMenuOpen(false)
    }
    window.addEventListener('click', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [projectMenuOpen])

  return (
    <div className={styles.panel}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <img src="/logo.png" alt="Logo" className={styles.logoImg} />
          <div className={styles.projectMenuWrap} ref={projectMenuRef}>
            <button
              className={`${styles.projectBtn} ${projectMenuOpen ? styles.projectBtnOpen : ''}`}
              onClick={() => setProjectMenuOpen(!projectMenuOpen)}
            >
              <span className={styles.projectName}>Bloom Project</span>
              <svg
                className={styles.chevron}
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {projectMenuOpen && (
              <div className={styles.projectMenu}>
                <button
                  className={styles.projectMenuItem}
                  onClick={() => {
                    resetWorkspace()
                    setMessages([welcomeMessage])
                    setProjectMenuOpen(false)
                  }}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21.5 2.5l-18 19M8.5 2.5l13 13M2.5 8.5l13 13" />
                  </svg>
                  New Project
                </button>

                <button className={styles.projectMenuItem}>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                  Go to dashboard
                </button>

                <div className={styles.menuDivider} />

                <button
                  className={styles.projectMenuItem}
                  onClick={() => {
                    setProjectMenuOpen(false)
                    navigateTo('settings')
                  }}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  Settings
                </button>

                <button className={styles.projectMenuItem}>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 4h16 M4 12h16 M4 20h16 M8 4v16 M16 4v16" />
                  </svg>
                  Connectors
                </button>

                <button
                  className={styles.projectMenuItem}
                  onClick={() => {
                    setProjectMenuOpen(false)
                    navigateTo('settings')
                  }}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                  </svg>
                  Configure Providers
                </button>

                <div className={styles.menuDivider} />

                <div className={styles.appearanceGroup}>
                  <span className={styles.appearanceLabel}>Appearance</span>
                  <div className={styles.appearanceOptions}>
                    <button
                      className={`${styles.appearanceBtn} ${appearance === 'light' ? styles.appearanceActive : ''}`}
                      onClick={() => setAppearance('light')}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="5" />
                        <line x1="12" y1="1" x2="12" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="23" />
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                        <line x1="1" y1="12" x2="3" y2="12" />
                        <line x1="21" y1="12" x2="23" y2="12" />
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                      </svg>
                      Light
                    </button>
                    <button
                      className={`${styles.appearanceBtn} ${appearance === 'dark' ? styles.appearanceActive : ''}`}
                      onClick={() => setAppearance('dark')}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                      Dark
                    </button>
                    <button
                      className={`${styles.appearanceBtn} ${appearance === 'system' ? styles.appearanceActive : ''}`}
                      onClick={() => setAppearance('system')}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect
                          x="2"
                          y="3"
                          width="20"
                          height="14"
                          rx="2"
                          ry="2"
                        />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                      </svg>
                      System
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.historyBtn} title="View History">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            streaming={streaming && msg.id === messages[messages.length - 1]?.id}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput
        mode={mode}
        onToggleMode={setMode}
        providerId={providerId}
        model={model}
        onProviderSelect={(pid, m) => {
          setProviderId(pid)
          setModel(m)
        }}
        onSend={handleSend}
        streaming={streaming}
      />
    </div>
  )
}

/* ── Helpers ──────────────────────────────────────── */

/**
 * Get a human-readable one-sentence status for a tool call.
 */
function getToolStatus(
  name: string,
  args: Record<string, string>
): string | null {
  switch (name) {
    case 'list_files':
      return 'Analyzing workspace...'
    case 'read_file':
      return `Reading ${shortPath(args.path)}...`
    case 'write_file': {
      const existed = true // we don't know yet, but this is the optimistic label
      return existed
        ? `Modifying ${shortPath(args.path)}...`
        : `Creating ${shortPath(args.path)}...`
    }
    case 'edit_file':
      return `Editing ${shortPath(args.path)}...`
    case 'delete_file':
      return `Removing ${shortPath(args.path)}...`
    case 'execute_build':
      return 'Verifying build...'
    case 'get_errors':
      return 'Checking build errors...'
    default:
      return null
  }
}

function shortPath(path: string): string {
  const parts = path.split('/')
  return parts.length > 2 ? `…/${parts[parts.length - 2]}/${parts[parts.length - 1]}` : path
}

function findLastIndex<T>(arr: T[], pred: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return i
  }
  return -1
}
