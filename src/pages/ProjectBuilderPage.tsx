import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { usePageTitle } from '../lib/usePageTitle'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import JSZip from 'jszip'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { describeAgentError, getErrorMessage, isAbortError, logError, type AgentErrorInfo } from '../lib/errors'
import { deploySite } from '../lib/deploy'
import { ConnectBackend } from '../components/ConnectBackend/ConnectBackend'
import { buildPreview, escapeHtml } from '../lib/preview-bundle'
import { capturePreviewThumbnail } from '../lib/preview-screenshot'
import PreviewEditPopover from '../components/PreviewEditPopover/PreviewEditPopover'
import {
  composeEditInstruction,
  formatEditLabel,
  applyTextEdit,
  resolveOeidPath,
  type EditSelection,
} from '../lib/preview-edit'
import { runOpenThornAgent, type AgentCodeFile, type LlmMessage, type SelectedAgentModel } from '../lib/agent'
import {
  normalizeThinkingLevel,
  type AgentThinkingLevel,
} from '../lib/agent-thinking'
import PromptInput from '../components/PromptInput/PromptInput'
import { useCollaboration, type CollaboratorPresence } from '../lib/useCollaboration'
import styles from './ProjectBuilderPage.module.css'

interface ProjectRouteState {
  prompt?: string
  title?: string
  selectedModel?: SelectedAgentModel | null
  thinkingLevel?: AgentThinkingLevel
  templateFiles?: AgentCodeFile[]
  isTemplate?: boolean
  templateName?: string
}


const EMPTY_CODE_FILE: AgentCodeFile = {
  path: 'No files yet',
  language: 'txt',
  code: 'OpenThorn will show the generated files after the first successful build.',
}

interface FileTreeNode {
  name: string
  path: string
  type: 'folder' | 'file'
  children: FileTreeNode[]
  language?: string
}

function highlightCode(code: string, language: string): string {
  // Simple but effective tokenizer for TSX/JSX/TS and CSS
  const escaped = escapeHtml(code)

  if (language === 'css') {
    // CSS tokenizer
    return escaped
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="syn-comment">$1</span>')
      .replace(/(@[a-z-]+)/g, '<span class="syn-keyword">$1</span>')
      .replace(/([.#]?[a-zA-Z_-]+)(?=\s*\{)/g, '<span class="syn-selector">$1</span>')
      .replace(/([a-z-]+)(?=\s*:)/g, '<span class="syn-property">$1</span>')
      .replace(/(:\s*)([^;]+)/g, '$1<span class="syn-value">$2</span>')
      .replace(/(&quot;(?:[^&]|&(?!quot;))*&quot;|&#39;(?:[^&]|&(?!#39;))*&#39;)/g, '<span class="syn-string">$1</span>')
      .replace(/(\b[\d.]+(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?\b)/g, '<span class="syn-number">$1</span>')
  }

  // TSX/JSX/TS/JS tokenizer
  let result = escaped

  // Strings (do first to avoid matching inside them)
  result = result.replace(/(&quot;(?:[^&]|&(?!quot;))*&quot;|&#39;(?:[^&]|&(?!#39;))*&#39;|`(?:[^`\\]|\\.)*`)/g, '<span class="syn-string">$1</span>')
  // Single-line comments
  result = result.replace(/(\/\/.*$)/gm, '<span class="syn-comment">$1</span>')
  // JSX tags — match escaped opening/closing tags (&lt; → < after escaping)
  result = result.replace(/(&lt;\/?)([A-Z][a-zA-Z0-9]*)/g, '$1<span class="syn-tag">$2</span>')
  result = result.replace(/(&lt;\/?)([a-z][a-zA-Z0-9]*)/g, '$1<span class="syn-tag-lower">$2</span>')
  // JSX attributes
  result = result.replace(/(\s)([a-zA-Z-]+)(=)/g, '$1<span class="syn-attr">$2</span>$3')
  // JSX expression braces
  result = result.replace(/(\{|\})/g, '<span class="syn-brace">$1</span>')
  // Keywords
  result = result.replace(/\b(export|default|function|return|const|let|var|import|from|if|else|for|while|class|new|this|async|await|typeof|instanceof|extends|implements|interface|type|enum|switch|case|break|continue|throw|try|catch|finally|void|null|undefined|true|false|as)\b/g, '<span class="syn-keyword">$1</span>')
  // Numbers
  result = result.replace(/\b(\d+\.?\d*)\b/g, '<span class="syn-number">$1</span>')
  // Arrow functions and template literal expressions
  result = result.replace(/(=&gt;)/g, '<span class="syn-keyword">$1</span>')

  return result
}

function buildFileTree(files: AgentCodeFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = []
  const folderMap = new Map<string, FileTreeNode>()

  // Sort: folders first, then files, each alphabetically
  const sorted = [...files].sort((a, b) => {
    const aParts = a.path.split('/')
    const bParts = b.path.split('/')
    const minLen = Math.min(aParts.length, bParts.length)
    for (let i = 0; i < minLen; i++) {
      const aIsLast = i === aParts.length - 1
      const bIsLast = i === bParts.length - 1
      if (aIsLast && !bIsLast) return 1  // files after folders
      if (!aIsLast && bIsLast) return -1
      if (aParts[i] !== bParts[i]) return aParts[i].localeCompare(bParts[i])
    }
    return aParts.length - bParts.length
  })

  for (const file of sorted) {
    const parts = file.path.split('/')
    let current: FileTreeNode[] = root
    let currentPath = ''

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]
      const isLast = i === parts.length - 1
      currentPath = currentPath ? `${currentPath}/${name}` : name

      if (isLast) {
        current.push({
          name,
          path: file.path,
          type: 'file',
          children: [],
          language: file.language,
        })
      } else {
        let folder = folderMap.get(currentPath)
        if (!folder) {
          folder = {
            name,
            path: currentPath,
            type: 'folder',
            children: [],
          }
          current.push(folder)
          folderMap.set(currentPath, folder)
        }
        current = folder.children
      }
    }
  }

  return root
}

type ViewMode = 'preview' | 'code'
type DeviceMode = 'desktop' | 'tablet' | 'phone'
type SharePermission = 'view' | 'edit'
type ProjectAccess = 'owner' | SharePermission

interface Collaborator {
  id: string
  email: string
  name: string
  permission: SharePermission
  invitedAt: string
  accountVerified: boolean
}

/** A single event in the agent's chronological timeline. */
interface TimelineEvent {
  id: string
  type: 'text' | 'thinking' | 'tool_call' | 'status'
  timestamp: number
  // text
  text?: string
  // thinking
  thought?: string
  thinkingCollapsed?: boolean
  // tool call
  toolLabel?: string
  toolStatus?: 'running' | 'done' | 'error'
  toolDetail?: string
  toolResult?: string
  statusTone?: 'info' | 'success'
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content?: string       // user messages
  title?: string
  summary?: string
  files?: AgentCodeFile[]
  error?: boolean
  errorInfo?: AgentErrorInfo
  timeline: TimelineEvent[]  // assistant messages
  turns?: number
  providerName?: string
  modelName?: string
}


const AVATAR_COLORS = [
  '#7c3aed', // violet
  '#0d9488', // teal
  '#d97706', // amber
  '#e11d48', // rose
  '#0284c7', // sky
  '#16a34a', // emerald
  '#ea580c', // orange
  '#db2777', // pink
]

function avatarColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function cloneAgentFiles(files: AgentCodeFile[]): AgentCodeFile[] {
  return files.map((file) => ({ ...file }))
}

function formatToolLabel(name: string, input?: Record<string, unknown>): string {
  switch (name) {
    case 'think':
      return 'Thinking'
    case 'list_files':
      return 'Checking project files'
    case 'read_file':
      return `Reading ${input?.path || 'file'}`
    case 'write_file':
      return `Writing ${input?.path || 'file'}`
    case 'edit_file':
      return `Editing ${input?.path || 'file'}`
    case 'multi_edit':
      return `Editing ${input?.path || 'file'}`
    case 'delete_file':
      return `Deleting ${input?.path || 'file'}`
    case 'compile':
      return 'Verifying build'
    case 'done':
      return 'Wrapping up'
    case 'set_title':
      return 'Naming project'
    case 'update_plan':
      return 'Updating checklist'
    default:
      return name.replace(/_/g, ' ').replace(/^\w/, (char) => char.toUpperCase())
  }
}

function formatToolDetail(name: string, input?: Record<string, unknown>): string {
  switch (name) {
    case 'think':
      return ''
    case 'write_file':
      return `${input?.language || 'tsx'} - ${formatCharCount(String(input?.code ?? '').length)}`
    case 'edit_file':
      return `Replacing ${formatCharCount(String(input?.old_string ?? '').length)}`
    case 'multi_edit':
      return `${Array.isArray(input?.edits) ? input.edits.length : 0} edits`
    case 'delete_file':
      return 'Removing unused file'
    case 'compile':
      return 'Building and running preview'
    case 'done':
      // The full summary renders as the completion paragraph below the
      // timeline — repeating a truncated copy here reads as a glitch.
      return ''
    case 'set_title':
      return String(input?.title ?? '')
    default:
      return ''
  }
}

function formatCharCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k chars`
  return `${count} chars`
}

function formatToolResultDetail(name: string, result?: string, error?: boolean): string {
  const text = result?.trim() ?? ''
  if (!text) return error ? 'Needs attention' : ''

  if (error) return firstLine(text).slice(0, 160)

  switch (name) {
    case 'write_file':
      return 'File saved'
    case 'edit_file':
    case 'multi_edit':
      return 'Changes applied'
    case 'delete_file':
      return 'File removed'
    case 'compile':
      if (text.includes('Compilation + runtime check passed')) return 'Build and runtime check passed'
      if (text.includes('with warnings')) return 'Passed with warnings'
      return firstLine(text).slice(0, 160)
    case 'set_title': {
      const title = parseJsonStringField(text, 'title')
      return title ? `Project named "${title}"` : 'Title updated'
    }
    case 'update_plan':
      return formatPlanResultDetail(text)
    case 'done':
      // Full summary renders separately as the completion paragraph.
      return ''
    default:
      return firstLine(text).slice(0, 160)
  }
}

function firstLine(text: string): string {
  return text.split('\n').find((line) => line.trim())?.trim() ?? ''
}

function parseJsonStringField(text: string, field: string): string {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const value = parsed[field]
    return typeof value === 'string' ? value.trim() : ''
  } catch {
    return ''
  }
}

function formatPlanResultDetail(text: string): string {
  const match = text.match(/Plan updated\. (\d+) requirement\(s\), (\d+) still unchecked\./)
  if (!match) return 'Checklist updated'
  const total = Number(match[1])
  const remaining = Number(match[2])
  const complete = Math.max(0, total - remaining)
  return `${complete}/${total} requirements complete`
}

const CHAT_SAVE_INTERVAL_MS = 750


/** True when the chat's last assistant turn is mid-run (a tool call left spinning). */
function chatHasRunningTimeline(chat: ChatMessage[]): boolean {
  const lastAssistant = [...chat].reverse().find((m) => m.role === 'assistant')
  return Boolean(
    lastAssistant?.timeline?.some((e) => e.type === 'tool_call' && e.toolStatus === 'running'),
  )
}

/** Resolve any "running" tool calls to "done" so stale spinners don't spin forever. */
function sanitizeChatTimelines(chat: ChatMessage[]): ChatMessage[] {
  return chat.map((message) => {
    if (
      message.role !== 'assistant' ||
      !message.timeline?.some((e) => e.type === 'tool_call' && e.toolStatus === 'running')
    ) {
      return message
    }
    return {
      ...message,
      timeline: message.timeline.map((e) =>
        e.type === 'tool_call' && e.toolStatus === 'running'
          ? { ...e, toolStatus: 'done' as const }
          : e,
      ),
    }
  })
}

export default function ProjectBuilderPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const { projectId } = useParams()
  const location = useLocation()
  const state = (location.state ?? {}) as ProjectRouteState
  // Capture once at mount — immune to location.state being cleared on reload
  const [hasInitialPrompt] = useState(Boolean(state.prompt))
  const prompt = state.prompt || ''
  const initialThinkingLevel = normalizeThinkingLevel(state.thinkingLevel)
  const [title, setTitle] = useState(state.title ?? '')
  usePageTitle(title || 'Project', {
    description: 'Build, preview, refine, export, and deploy an OpenThorn project.',
  })
  const [projectFiles, setProjectFiles] = useState<AgentCodeFile[]>([])
  const [activeModel, setActiveModel] = useState<SelectedAgentModel | null>(state.selectedModel ?? null)
  const [activeThinkingLevel, setActiveThinkingLevel] = useState<AgentThinkingLevel>(initialThinkingLevel)
  const [chatHistoryLoaded, setChatHistoryLoaded] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // Only create initial user message if we have a fresh prompt from dashboard
    // Otherwise wait for chat history to load from Supabase
    if (state.prompt) {
      return [{ id: 'initial-user', role: 'user', content: state.prompt, timeline: [] }]
    }
    return []
  })
  const [agentRunning, setAgentRunning] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [remoteGenerating, setRemoteGenerating] = useState(false)
  const remoteGeneratingPrevRef = useRef(false)
  const handleAgentRequestRef = useRef<((request: string, selectedModel: SelectedAgentModel | null, thinkingLevel?: AgentThinkingLevel, options?: { reuseInitialUser?: boolean; mode?: 'create' | 'refine' }) => Promise<void>) | null>(null)
  const [agentStatus, setAgentStatus] = useState('')
  const [firstRunComplete, setFirstRunComplete] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop')
  const [editMode, setEditMode] = useState(false)
  const [selection, setSelection] = useState<EditSelection | null>(null)
  const [previewHtml, setPreviewHtml] = useState('')
  const [lastReadyHtml, setLastReadyHtml] = useState('')
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'building' | 'ready' | 'error'>('idle')
  const [previewErrors, setPreviewErrors] = useState<string[]>([])
  const [activeFile, setActiveFile] = useState(EMPTY_CODE_FILE.path)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set<string>())
  const [fullscreen, setFullscreen] = useState(false)
  const [titleEditing, setTitleEditing] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePermission, setInvitePermission] = useState<SharePermission>('edit')
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [shareLink, setShareLink] = useState('')
  const [inviteStatus, setInviteStatus] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [activePresenceUser, setActivePresenceUser] = useState<CollaboratorPresence | null>(null)
  const [projectAccess, setProjectAccess] = useState<ProjectAccess>('owner')
  const [deployState, setDeployState] = useState<'idle' | 'deploying' | 'deployed' | 'error'>('idle')
  const [deployUrl, setDeployUrl] = useState('')
  const [deployError, setDeployError] = useState('')
  const [deployModalOpen, setDeployModalOpen] = useState(false)
  const [publishModalOpen, setPublishModalOpen] = useState(false)
  const [publishDescription, setPublishDescription] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [publishSuccess, setPublishSuccess] = useState(false)
  // Auto-open after the OAuth redirect (?backend=connected|error) so the user
  // sees the project picker / error without having to re-click "Backend".
  const [backendModalOpen, setBackendModalOpen] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('backend'),
  )
  const [cfPagesProjectName, setCfPagesProjectName] = useState<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const titleShouldSaveRef = useRef(true)
  const initialAgentStartedRef = useRef(false)
  const agentAbortRef = useRef<AbortController | null>(null)
  const agentHistoryRef = useRef<LlmMessage[]>([])
  const agentRunSnapshotRef = useRef<{
    controller: AbortController
    files: AgentCodeFile[]
    firstRunComplete: boolean
  } | null>(null)
  const isResumingRef = useRef(false)
  // Tracks whether the agent has already produced a turn for this project. The agent may
  // auto-name the project only on its very first run; after that the title is "owned".
  const agentHasRunRef = useRef(false)
  const pendingRequestRef = useRef<{ prompt: string; model: SelectedAgentModel | null; thinkingLevel: AgentThinkingLevel } | null>(null)
  const [filesLoaded, setFilesLoaded] = useState(false)
  const promptRef = useRef(prompt)
  const selectedModelRef = useRef(state.selectedModel)
  const thinkingLevelRef = useRef(initialThinkingLevel)
  const isTemplateProjectRef = useRef(Boolean(state.isTemplate))
  const templateNameRef = useRef(state.templateName ?? '')
  const resumePromptRef = useRef<string | null>(null)
  const resumeModeRef = useRef<'create' | 'refine'>('refine')
  const previewFrameRef = useRef<HTMLIFrameElement>(null)
  // Throttle + ordering state for persisting chat/files snapshots to Supabase.
  const lastChatSaveRef = useRef(0)
  const chatSaveChainRef = useRef<Promise<void>>(Promise.resolve())
  const filesSaveChainRef = useRef<Promise<void>>(Promise.resolve())

  const activeCodeFile = projectFiles.find((file) => file.path === activeFile) ?? projectFiles[0] ?? EMPTY_CODE_FILE
  const userInitial = user?.user_metadata?.full_name?.charAt(0).toUpperCase() ?? user?.email?.charAt(0).toUpperCase() ?? 'U'
  const userAvatar = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture
  const ownerName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'You'
  const ownerEmail = user?.email ?? 'Project owner'
  const isViewOnly = projectAccess === 'view'
  const canManageShare = projectAccess === 'owner'
  const canInvite = canManageShare && inviteEmail.trim().length > 0 && !inviteLoading
  const accessLabel = projectAccess === 'owner' ? 'Owner' : projectAccess === 'edit' ? 'Edit access' : 'View-only'

  const inviteLink = useMemo(() => {
    if (shareLink) return shareLink
    if (typeof window === 'undefined' || !projectId) return ''
    return new URL(`/projects/${projectId}`, window.location.origin).toString()
  }, [projectId, shareLink])

  useEffect(() => {
    if (!loading && !user) {
      navigate('/', { replace: true })
    }
  }, [loading, user, navigate])

  useEffect(() => {
    return () => {
      agentAbortRef.current?.abort()
    }
  }, [])

  // Clear route state from history so page reloads don't re-trigger the agent.
  // The values we need (prompt, model, templateFiles, isTemplate) are already frozen
  // in useState/useRef above, so this is safe to do immediately on mount.
  useEffect(() => {
    navigate(location.pathname, { replace: true, state: null })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load template files immediately on mount so the preview renders before the agent runs
  useEffect(() => {
    if (!state.templateFiles?.length) return
    setProjectFiles(state.templateFiles)
    setFirstRunComplete(true)
    initialAgentStartedRef.current = true
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setActiveFile((current) => (
      projectFiles.some((file) => file.path === current)
        ? current
        : projectFiles[0]?.path ?? EMPTY_CODE_FILE.path
    ))

    setExpandedFolders((current) => {
      const next = new Set(current)
      for (const file of projectFiles) {
        const parts = file.path.split('/')
        for (let i = 0; i < parts.length - 1; i += 1) {
          next.add(parts.slice(0, i + 1).join('/'))
        }
      }
      return next
    })
  }, [projectFiles])

  // Sync project to Supabase on mount + load persisted files
  useEffect(() => {
    if (!user || !projectId) return

    const loadProject = async () => {
      try {
      // Verify ownership before upserting to prevent IDOR
      const { data: existing, error: existingError } = await supabase
        .from('projects')
        .select('user_id, title, files, chat_history, agent_history, cf_pages_project_name, generating, generating_by, selected_model')
        .eq('id', projectId)
        .maybeSingle()

      if (existingError) throw existingError

      if (existing && existing.user_id !== user.id) {
        // Project belongs to another user — redirect away
        const { data: collaboration, error: collaborationError } = await supabase
          .from('project_collaborators')
          .select('permission')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (collaborationError || !collaboration) {
          navigate('/dashboard', { replace: true })
          return
        }

        setProjectAccess(collaboration.permission === 'view' ? 'view' : 'edit')

        if (Array.isArray(existing.files) && (existing.files as AgentCodeFile[]).length > 0) {
          setProjectFiles(existing.files as AgentCodeFile[])
          setFirstRunComplete(true)
          initialAgentStartedRef.current = true
        }

        if (Array.isArray(existing.chat_history) && (existing.chat_history as ChatMessage[]).length > 0) {
          const collaboratorChat = existing.chat_history as ChatMessage[]
          setMessages(sanitizeChatTimelines(collaboratorChat))
          if (collaboratorChat.some((m) => m.role === 'assistant')) agentHasRunRef.current = true
        }
        setChatHistoryLoaded(true)

        if (existing.title && existing.title !== 'Untitled project') {
          setTitle(existing.title)
        }

        setFilesLoaded(true)
        return
      }

      setProjectAccess('owner')

      // Load persisted files if they exist
      if (existing && Array.isArray(existing.files) && (existing.files as AgentCodeFile[]).length > 0) {
        const savedFiles = existing.files as AgentCodeFile[]
        setProjectFiles(savedFiles)
        setFirstRunComplete(true)
        // Don't auto-start agent on existing projects — user can refine
        initialAgentStartedRef.current = true
      }

      // Load persisted chat history if it exists
      const savedChat = (existing && Array.isArray(existing.chat_history) && (existing.chat_history as ChatMessage[]).length > 0)
        ? existing.chat_history as ChatMessage[]
        : null

      // Detect generation interrupted by a page reload. Trust either the DB flag (set when
      // our run started) OR a saved chat whose last assistant turn is still mid-run — the
      // latter catches cases where the `generating` flag never persisted before the reload.
      const flaggedGenerating = Boolean(existing?.generating && existing?.generating_by === user.id)
      const looksInterrupted = Boolean(savedChat && chatHasRunningTimeline(savedChat))
      const wasInterrupted = flaggedGenerating || looksInterrupted

      if (savedChat?.some((m) => m.role === 'assistant')) agentHasRunRef.current = true

      if (wasInterrupted && savedChat) {
        const lastUserMsg = [...savedChat].reverse().find(m => m.role === 'user')
        if (lastUserMsg) {
          // Strip the trailing incomplete assistant message so the re-run adds a fresh one
          const cleaned = savedChat[savedChat.length - 1]?.role === 'assistant'
            ? savedChat.slice(0, -1)
            : savedChat
          setMessages(cleaned)
          resumePromptRef.current = lastUserMsg.content as string
          // Interrupted initial build (no files landed yet) restarts in create
          // mode; once partial files exist the re-run continues as a refine.
          resumeModeRef.current =
            (Array.isArray(existing?.files) && (existing.files as AgentCodeFile[]).length > 0)
              ? 'refine'
              : 'create'
          isResumingRef.current = true
          setReconnecting(true)
          initialAgentStartedRef.current = true // block auto-start from racing with resume
        } else {
          // Nothing to resume from — at least clear the stuck spinners so nothing spins forever.
          setMessages(sanitizeChatTimelines(savedChat))
        }
      } else if (savedChat) {
        setMessages(sanitizeChatTimelines(savedChat))
      }
      // Restore LLM conversation history so the agent retains full context across page loads.
      // Don't restore if interrupted — the interrupted run will re-run and rebuild its own history.
      if (!wasInterrupted && Array.isArray(existing?.agent_history) && (existing.agent_history as LlmMessage[]).length > 0) {
        agentHistoryRef.current = existing.agent_history as LlmMessage[]
      }

      // Clear the interruption flag even when there was no chat to resume from,
      // so a stale `generating` never survives into the next session.
      if (wasInterrupted) {
        void supabase.from('projects').update({ generating: false, generating_by: null }).eq('id', projectId)
      }
      setChatHistoryLoaded(true)

      // Use the stored title if it's better than the route state title
      if (existing?.title && existing.title !== 'Untitled project') {
        setTitle(existing.title)
      }

      setCfPagesProjectName(typeof existing?.cf_pages_project_name === 'string' ? existing.cf_pages_project_name : null)

      // Restore persisted model selection (navigation state takes priority)
      if (!state.selectedModel && existing?.selected_model) {
        setActiveModel(existing.selected_model as SelectedAgentModel)
      }

      // Upsert project metadata (preserve existing title; files are not included so they're never overwritten)
      const { error } = await supabase
        .from('projects')
        .upsert({
          id: projectId,
          user_id: user.id,
          title: existing?.title ?? 'Untitled project',
          preview_url: null,
          created_at: new Date().toISOString(),
        }, { onConflict: 'id' })

      if (error) {
        throw error
      }

      setFilesLoaded(true)
      } catch (error) {
        logError('ProjectLoad', error)
        setMessages((current) => current.length > 0 ? current : [{
          id: 'project-load-error',
          role: 'assistant',
          content: 'I could not load this project. Please go back to the dashboard and try opening it again.',
          timeline: [],
          error: true,
        }])
        setChatHistoryLoaded(true)
        setFilesLoaded(true)
      }
    }

    loadProject()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, projectId, navigate])

  useEffect(() => {
    if (!user || !projectId) return

    let cancelled = false

    const loadCollaborators = async () => {
      try {
      const { data, error } = await supabase
        .from('project_collaborators')
        .select('*')
        .eq('project_id', projectId)
        .order('invited_at', { ascending: false })

      if (cancelled) return

      if (error) {
        if (!/does not exist|schema cache|permission denied/i.test(error.message)) {
          throw error
        }
        return
      }

      if (!data) return

      setCollaborators(data.map((item) => {
        const email = String(item.email ?? 'collaborator@bloom.app')
        return {
          id: String(item.user_id ?? item.id ?? email),
          email,
          name: String(item.name ?? item.full_name ?? email.split('@')[0]),
          permission: item.permission === 'view' ? 'view' : 'edit',
          invitedAt: String(item.invited_at ?? item.created_at ?? new Date().toISOString()),
          accountVerified: true,
        }
      }))
      } catch (error) {
        logError('ProjectLoadCollaborators', error)
        setInviteError(getErrorMessage(error, 'Could not load collaborators.'))
      }
    }

    loadCollaborators()

    return () => { cancelled = true }
  }, [projectId, user?.id])

  const userName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Unknown'

  const { onlineCollaborators } = useCollaboration({
    projectId,
    userId: user?.id,
    userName,
    userEmail: user?.email ?? '',
    onFilesUpdate: (files) => {
      if (!agentRunning) {
        setProjectFiles((current) => {
          const incoming = files as AgentCodeFile[]
          if (
            current.length === incoming.length &&
            current.every((f, i) => f.path === incoming[i].path && f.code === incoming[i].code)
          ) return current
          return incoming
        })
      }
    },
    onChatUpdate: (chat) => {
      if (!agentRunning && !isResumingRef.current) setMessages(chat as ChatMessage[])
    },
    onGeneratingChange: (generating, generatingBy) => {
      // Ignore own agent's generating state — only track remote collaborators
      if (generatingBy !== null && generatingBy === user?.id) return
      setRemoteGenerating(generating)
    },
  })


  useEffect(() => {
    if (!activePresenceUser) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Element
      if (!target.closest(`.${styles.presenceAvatars}`)) {
        setActivePresenceUser(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [activePresenceUser])

  useEffect(() => {
    if (titleEditing && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [titleEditing])

  useEffect(() => {
    if (previewStatus === 'ready' && previewHtml) {
      setLastReadyHtml(previewHtml)
    }
  }, [previewStatus, previewHtml])

  // Build live preview when files change, but only between agent iterations
  // (not on every mid-run 'files' event — the final setAgentRunning(false) re-triggers this)
  useEffect(() => {
    if (agentRunning) return

    let cancelled = false

    const build = async () => {
      if (projectFiles.length === 0) {
        setPreviewHtml('')
        setPreviewErrors([])
        setPreviewStatus('idle')
        return
      }

      setPreviewStatus('building')
      setPreviewErrors([])

      try {
        const result = await buildPreview(
          projectFiles.map((f) => ({ path: f.path, content: f.code })),
          undefined,
          { instrument: true },
        )
        if (cancelled) return
        if (result.errors.length > 0) {
          setPreviewErrors(result.errors)
          setPreviewStatus('error')
        } else {
          setPreviewHtml(result.html)
          setPreviewStatus('ready')
        }
      } catch (err) {
        if (cancelled) return
        setPreviewErrors([err instanceof Error ? err.message : String(err)])
        setPreviewStatus('error')
      }
    }

    build()

    return () => { cancelled = true }
  }, [projectFiles, agentRunning])

  // ── Visual click-to-edit ─────────────────────────────────────────────────
  // Tell the preview iframe to enter/leave select mode. Hover-tracking is
  // paused while a selection is open (the popover is showing) so the background
  // doesn't keep highlighting under the popover. Re-runs when the preview
  // rebuilds (new srcDoc) so the fresh frame gets the current mode.
  const selectActive = editMode && !selection
  useEffect(() => {
    const frame = previewFrameRef.current
    frame?.contentWindow?.postMessage({ __openthornEdit: selectActive ? 'enable' : 'disable' }, '*')
  }, [selectActive, previewHtml])

  useEffect(() => {
    if (!editMode) setSelection(null)
  }, [editMode])

  // Esc exits the visual editor: close the open popover first, otherwise leave
  // edit mode. Handles both parent focus (keydown) and preview-iframe focus
  // (the 'escape' message posted by the in-iframe select-mode script).
  useEffect(() => {
    if (!editMode) return
    const exit = () => {
      if (selection) setSelection(null)
      else setEditMode(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exit()
    }
    const onMsg = (e: MessageEvent) => {
      if (e.data?.__openthornEdit === 'escape') exit()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('message', onMsg)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('message', onMsg)
    }
  }, [editMode, selection])

  // Receive element selections from the preview iframe.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data
      if (!d || !d.__openthornEdit) return
      if (d.__openthornEdit === 'selected' && d.payload) {
        setSelection(d.payload as EditSelection)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Editing is disabled while the agent runs (edits trigger agent runs).
  useEffect(() => {
    if (agentRunning && editMode) {
      setEditMode(false)
      setSelection(null)
    }
  }, [agentRunning, editMode])

  // Persist files to Supabase when they change (after agent has started)
  useEffect(() => {
    if (!user || !projectId || !firstRunComplete || isViewOnly) return

    filesSaveChainRef.current = filesSaveChainRef.current
      .then(async () => {
        const { error } = await supabase
          .from('projects')
          .update({ files: projectFiles as unknown as Record<string, unknown>[] })
          .eq('id', projectId)

        if (error) throw error
      })
      .catch((error) => logError('ProjectSaveFiles', error))
  }, [projectFiles, user, projectId, firstRunComplete, isViewOnly])

  // Persist chat history to Supabase when messages change. During a run the
  // messages update on every streamed token, so the writes are throttled
  // (trailing, latest-wins) and serialized through a promise chain — parallel
  // HTTP updates can complete out of order and persist a stale chat, which a
  // later page reload would then restore.
  useEffect(() => {
    if (!user || !projectId || !chatHistoryLoaded || isViewOnly) return

    // Only save if there's actual conversation content beyond the initial user message
    const hasAssistantMessages = messages.some((m) => m.role === 'assistant')
    if (!hasAssistantMessages) return

    const wait = Math.max(0, CHAT_SAVE_INTERVAL_MS - (Date.now() - lastChatSaveRef.current))
    const timer = setTimeout(() => {
      lastChatSaveRef.current = Date.now()
      chatSaveChainRef.current = chatSaveChainRef.current
        .then(async () => {
          const { error } = await supabase
            .from('projects')
            .update({ chat_history: messages as unknown as Record<string, unknown>[] })
            .eq('id', projectId)
          if (error) throw error
        })
        .catch((error) => logError('ProjectSaveChat', error))
    }, wait)

    return () => clearTimeout(timer)
  }, [messages, user, projectId, chatHistoryLoaded, isViewOnly])

  // Save preview HTML to Supabase Storage when preview is ready
  useEffect(() => {
    if (!user || !projectId || previewStatus !== 'ready' || !previewHtml || isViewOnly) return

    const savePreview = async () => {
      try {
        const result = await buildPreview(
          projectFiles.map((f) => ({ path: f.path, content: f.code })),
        )

        if (result.errors.length > 0) {
          logError('ProjectPreviewBuild', result.errors)
          return
        }

        const jpegBlob = await capturePreviewThumbnail(result.html)
        if (!jpegBlob) {
          console.warn('Preview screenshot capture failed, skipping thumbnail')
          return
        }

        const thumbnailPath = `previews/${projectId}/${Date.now()}/thumbnail.png`

        const { error: uploadError } = await supabase.storage
          .from('deployments')
          .upload(thumbnailPath, jpegBlob, {
            contentType: 'image/png',
            upsert: false,
            cacheControl: '3600',
          })

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('deployments')
          .getPublicUrl(thumbnailPath)

        if (urlData?.publicUrl) {
          const { error: updateError } = await supabase
            .from('projects')
            .update({ preview_url: urlData.publicUrl })
            .eq('id', projectId)
            .eq('user_id', user.id)

          if (updateError) throw updateError
        }
      } catch (error) {
        logError('ProjectSavePreview', error)
      }
    }

    savePreview()
  }, [previewStatus, previewHtml, user, projectId, isViewOnly, projectFiles, title])

  const handlePublishToCommunity = useCallback(async () => {
    if (!user || publishing) return
    setPublishing(true)
    setPublishError('')

    try {
      const { data: projectData, error: fetchError } = await supabase
        .from('projects')
        .select('preview_url')
        .eq('id', projectId)
        .maybeSingle()

      if (fetchError) throw fetchError

      const authorName =
        user.user_metadata?.full_name ??
        user.email?.split('@')[0] ??
        'Anonymous'

      const { error } = await supabase.from('community_posts').insert({
        project_id: projectId,
        user_id: user.id,
        title: title || 'Untitled project',
        description: publishDescription.trim() || null,
        preview_url: projectData?.preview_url ?? null,
        author_name: authorName,
        files_snapshot: projectFiles as unknown as Record<string, unknown>[],
      })

      if (error) throw error
      setPublishModalOpen(false)
      setPublishDescription('')
      setPublishSuccess(true)
      setTimeout(() => setPublishSuccess(false), 3000)
    } catch (error) {
      logError('ProjectPublish', error)
      setPublishError(getErrorMessage(error, 'Could not publish this project. Please try again.'))
    } finally {
      setPublishing(false)
    }
  }, [user, publishing, projectId, title, publishDescription, projectFiles])

  const handleDeploy = useCallback(async () => {
    setDeployState('deploying')
    setDeployError('')
    setDeployModalOpen(true)

    try {
      // Use esbuild-based bundler — reliable, self-contained HTML
      const result = await buildPreview(
        projectFiles.map((f) => ({ path: f.path, content: f.code })),
      )

      if (result.errors.length > 0) {
        throw new Error(`Build failed: ${result.errors[0]}`)
      }

      const deploy = await deploySite(projectId!, result.html, cfPagesProjectName)
      setDeployUrl(deploy.url)

      if (deploy.siteId !== cfPagesProjectName && user && projectId) {
        const { error } = await supabase
          .from('projects')
          .update({ cf_pages_project_name: deploy.siteId })
          .eq('id', projectId)
          .eq('user_id', user.id)

        if (error) {
          throw new Error(`Deploy succeeded, but saving the site failed: ${error.message}`)
        }

        setCfPagesProjectName(deploy.siteId)
      }
      setDeployState('deployed')
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : 'Deploy failed')
      setDeployState('error')
    }
  }, [cfPagesProjectName, projectFiles, projectId, user])


  const handleDownloadZip = useCallback(async () => {
    const zip = new JSZip()
    projectFiles.forEach((file) => {
      zip.file(file.path, file.code)
    })
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'}.zip`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }, [projectFiles, title])

  const buildInviteLink = useCallback(() => {
    if (typeof window === 'undefined' || !projectId) return ''
    return new URL(`/projects/${projectId}`, window.location.origin).toString()
  }, [projectId])

  const findOpenThornAccount = useCallback(async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase()
    // profiles is locked to self-only via RLS; use the SECURITY DEFINER lookup
    // so we can resolve an invitee's account without exposing the table.
    const { data, error } = await supabase.rpc('find_account_by_email', { lookup_email: normalizedEmail })
    if (error) throw error

    const row = Array.isArray(data) ? data[0] : data
    if (!row) return null

    return {
      id: String(row.id),
      name: String(row.full_name ?? normalizedEmail.split('@')[0]),
    }
  }, [])

  const handleInviteCollaborator = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setInviteError('')
    setInviteStatus('')
    setLinkCopied(false)

    const normalizedEmail = inviteEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setInviteError('Enter a valid email address.')
      return
    }

    if (normalizedEmail === user?.email?.toLowerCase()) {
      setInviteError('You already own this project.')
      return
    }

    if (collaborators.some((collaborator) => collaborator.email.toLowerCase() === normalizedEmail)) {
      setInviteError('That collaborator is already invited.')
      return
    }

    setInviteLoading(true)
    let account: Awaited<ReturnType<typeof findOpenThornAccount>>
    try {
      account = await findOpenThornAccount(normalizedEmail)
    } catch (error) {
      logError('ProjectFindCollaborator', error)
      setInviteLoading(false)
      setInviteError(getErrorMessage(error, 'Could not look up that account.'))
      return
    }

    if (!account) {
      setInviteLoading(false)
      setInviteError('No OpenThorn account found for that email.')
      return
    }

    const createdLink = buildInviteLink()
    const invitedAt = new Date().toISOString()

    setCollaborators((current) => [
      {
        id: account.id,
        email: normalizedEmail,
        name: account.name,
        permission: invitePermission,
        invitedAt,
        accountVerified: true,
      },
      ...current,
    ])
    setShareLink(createdLink)
    setInviteEmail('')
    setInviteStatus(`${account.name} was invited with ${invitePermission === 'edit' ? 'edit' : 'view-only'} access.`)
    setInviteLoading(false)

    if (projectId) {
      const { error } = await supabase
        .from('project_collaborators')
        .upsert({
          project_id: projectId,
          user_id: account.id,
          email: normalizedEmail,
          permission: invitePermission,
          invited_by: user?.id,
          invited_at: invitedAt,
        }, { onConflict: 'project_id,user_id' })

      if (error && !/does not exist|schema cache|permission denied/i.test(error.message)) {
        logError('ProjectPersistCollaborator', error)
        setCollaborators((current) => current.filter((collaborator) => collaborator.id !== account.id))
        setInviteStatus('')
        setInviteError(getErrorMessage(error, 'Could not invite this collaborator.'))
      }
    }
  }, [buildInviteLink, collaborators, findOpenThornAccount, inviteEmail, invitePermission, projectId, user])

  const handlePermissionChange = useCallback((collaboratorId: string, permission: SharePermission) => {
    const previousCollaborators = collaborators
    setCollaborators((current) => current.map((collaborator) => (
      collaborator.id === collaboratorId ? { ...collaborator, permission } : collaborator
    )))

    const collaborator = collaborators.find((item) => item.id === collaboratorId)
    if (projectId && collaborator) {
      supabase
        .from('project_collaborators')
        .update({ permission })
        .eq('project_id', projectId)
        .eq('user_id', collaboratorId)
        .then(({ error }) => {
          if (error && !/does not exist|schema cache|permission denied/i.test(error.message)) {
            logError('ProjectUpdateCollaborator', error)
            setCollaborators(previousCollaborators)
            setInviteError(getErrorMessage(error, 'Could not update collaborator permissions.'))
          }
        }, (error: unknown) => {
          logError('ProjectUpdateCollaborator', error)
          setCollaborators(previousCollaborators)
          setInviteError(getErrorMessage(error, 'Could not update collaborator permissions.'))
        })
    }
  }, [collaborators, projectId])

  const handleRemoveCollaborator = useCallback((collaboratorId: string) => {
    const previousCollaborators = collaborators
    setCollaborators((current) => current.filter((collaborator) => collaborator.id !== collaboratorId))

    if (projectId) {
      supabase
        .from('project_collaborators')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', collaboratorId)
        .then(({ error }) => {
          if (error && !/does not exist|schema cache|permission denied/i.test(error.message)) {
            logError('ProjectRemoveCollaborator', error)
            setCollaborators(previousCollaborators)
            setInviteError(getErrorMessage(error, 'Could not remove this collaborator.'))
          }
        }, (error: unknown) => {
          logError('ProjectRemoveCollaborator', error)
          setCollaborators(previousCollaborators)
          setInviteError(getErrorMessage(error, 'Could not remove this collaborator.'))
        })
    }
  }, [collaborators, projectId])

  const handleCopyLink = useCallback(async () => {
    const link = inviteLink || buildInviteLink()
    if (!shareLink) setShareLink(link)

    if (navigator.clipboard) {
      try {
      await navigator.clipboard.writeText(link)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 1800)
      } catch (error) {
        logError('ProjectCopyInviteLink', error)
        setInviteError(getErrorMessage(error, 'Could not copy the link.'))
      }
    }
  }, [buildInviteLink, inviteLink, shareLink])

  const handleTitleSave = useCallback((newTitle: string) => {
    const trimmed = newTitle.trim()
    if (trimmed && trimmed !== title) {
      setTitle(trimmed)
      if (user && projectId) {
        supabase.from('projects').update({ title: trimmed }).eq('id', projectId).then(({ error }) => {
          if (error) logError('ProjectSaveTitle', error)
        }, (error: unknown) => logError('ProjectSaveTitle', error))
      }
    }
    setTitleEditing(false)
  }, [title, user, projectId])

  const updateAssistantMessage = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setMessages((current) => current.map((message) => (
      message.id === id ? { ...message, ...patch } : message
    )))
  }, [])

  const handleCancelAgent = useCallback(() => {
    pendingRequestRef.current = null
    setAgentStatus('Cancelling...')
    agentAbortRef.current?.abort()
  }, [])

  const handleAgentRequest = useCallback(async (
    request: string,
    selectedModel: SelectedAgentModel | null,
    thinkingLevel: AgentThinkingLevel = activeThinkingLevel,
    options: { reuseInitialUser?: boolean; mode?: 'create' | 'refine'; displayContent?: string } = {},
  ) => {
    if (!user || isViewOnly) return

    setReconnecting(false)

    // Queue if agent is running locally or on another collaborator's client
    if (agentAbortRef.current || remoteGenerating) {
      pendingRequestRef.current = { prompt: request, model: selectedModel, thinkingLevel }
      setMessages((current) => [
        ...current,
        { id: `user-queued-${Date.now()}`, role: 'user' as const, content: options.displayContent ?? request, timeline: [] },
      ])
      return
    }

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const assistantId = `assistant-${runId}`
    const chosenModel = selectedModel ?? activeModel
    const chosenThinkingLevel = thinkingLevel
    setActiveModel(chosenModel)
    setActiveThinkingLevel(chosenThinkingLevel)
    const timeline: TimelineEvent[] = []
    let eventCounter = 0

    // The agent may auto-name the project only on its first run. After any prior run the
    // title is considered owned (by the agent's earlier choice or a manual rename).
    const hadTitle = agentHasRunRef.current

    setMessages((current) => {
      const withUser = options.reuseInitialUser
        ? current
        : [...current, { id: `user-${runId}`, role: 'user' as const, content: options.displayContent ?? request, timeline: [] }]

      return [
        ...withUser,
        {
          id: assistantId,
          role: 'assistant' as const,
          title: 'OpenThorn',
          timeline: [],
        },
      ]
    })

    const pushTimeline = (event: Omit<TimelineEvent, 'id' | 'timestamp'>) => {
      const full: TimelineEvent = {
        ...event,
        id: `ev-${eventCounter++}`,
        timestamp: Date.now(),
      }
      timeline.push(full)
      updateAssistantMessage(assistantId, { timeline: [...timeline] })
    }

    const pushStatus = (text: string, tone: TimelineEvent['statusTone'] = 'info') => {
      const trimmed = text.trim()
      if (!trimmed) return
      const last = timeline[timeline.length - 1]
      if (last?.type === 'status' && last.text === trimmed) return
      pushTimeline({ type: 'status', text: trimmed, statusTone: tone })
    }

    // Find and update the last matching tool call event by label.
    const updateLastToolCall = (label: string, patch: Partial<TimelineEvent>) => {
      for (let i = timeline.length - 1; i >= 0; i--) {
        if (timeline[i].type === 'tool_call' && timeline[i].toolLabel === label) {
          timeline[i] = { ...timeline[i], ...patch }
          updateAssistantMessage(assistantId, { timeline: [...timeline] })
          return true
        }
      }
      return false
    }

    const replaceLastToolCall = (label: string, replacement: Omit<TimelineEvent, 'id' | 'timestamp'>) => {
      for (let i = timeline.length - 1; i >= 0; i--) {
        if (timeline[i].type === 'tool_call' && timeline[i].toolLabel === label) {
          timeline[i] = {
            ...replacement,
            id: timeline[i].id,
            timestamp: timeline[i].timestamp,
          }
          updateAssistantMessage(assistantId, { timeline: [...timeline] })
          return true
        }
      }
      return false
    }

    const controller = new AbortController()
    agentRunSnapshotRef.current = {
      controller,
      files: cloneAgentFiles(projectFiles),
      firstRunComplete,
    }
    agentAbortRef.current = controller
    agentHasRunRef.current = true
    setAgentRunning(true)
    setAgentStatus('Connecting...')

    if (projectId) {
      void supabase
        .from('projects')
        .update({ generating: true, generating_by: user.id })
        .eq('id', projectId)
    }

    try {
      const isFirstTemplateMessage = isTemplateProjectRef.current && !messages.some(m => m.role === 'assistant')
      const effectivePrompt = isFirstTemplateMessage
        ? `<system-reminder>\nTEMPLATE MODE: This project was started from the "${templateNameRef.current || 'template'}" template. The existing files are the template foundation — build upon them. Preserve the color system, component structure, and design language. Do not delete template files unless the user explicitly requests it.\n</system-reminder>\n\n${request}`
        : request

      const result = await runOpenThornAgent({
        userId: user.id,
        prompt: effectivePrompt,
        title,
        files: projectFiles.length > 0 ? projectFiles : [EMPTY_CODE_FILE],
        selectedModel: chosenModel,
        thinkingLevel: chosenThinkingLevel,
        mode: options.mode ?? 'refine',
        signal: controller.signal,
        history: agentHistoryRef.current.length > 0 ? agentHistoryRef.current : undefined,
        onProgress: (event) => {
          // Streaming text — append to last text event or create new one
          if (event.type === 'text' && event.text) {
            const last = timeline[timeline.length - 1]
            if (last && last.type === 'text') {
              last.text = (last.text || '') + event.text
              updateAssistantMessage(assistantId, { timeline: [...timeline] })
            } else {
              pushTimeline({ type: 'text', text: event.text })
            }
          }

          // Title set by agent early in the run (only on first creation)
          if (event.type === 'title' && event.text && !hadTitle) {
            setTitle(event.text)
            pushStatus(`Project title set to "${event.text}".`, 'success')
            if (user && projectId) {
              supabase.from('projects').update({ title: event.text }).eq('id', projectId).then(({ error }) => {
                if (error) logError('ProjectSaveTitle', error)
              }, (error: unknown) => logError('ProjectSaveTitle', error))
            }
          }

          // Model is generating — update the status label live so it shows the
          // step currently being produced instead of the previous (finished) one.
          if (event.type === 'generating') {
            setAgentStatus(event.toolName ? formatToolLabel(event.toolName, event.toolInput) : 'Thinking...')
          }

          // Tool call started — flushSync so each tool appears immediately in the
          // UI instead of being batched with subsequent events by React 18's
          // automatic batching (write_file is synchronous, so all writes for a
          // multi-file turn would otherwise render at once).
          if (event.type === 'tool_start' && event.toolName) {
            const label = formatToolLabel(event.toolName, event.toolInput)
            flushSync(() => {
              pushTimeline({
                type: 'tool_call',
                toolLabel: label,
                toolStatus: 'running',
                toolDetail: formatToolDetail(event.toolName!, event.toolInput),
              })
              setAgentStatus(label)
            })
          }

          // Tool result
          if (event.type === 'tool_result' && event.toolName) {
            if (event.toolName === 'think') {
              const label = formatToolLabel(event.toolName, event.toolInput)
              if (event.toolError) {
                updateLastToolCall(label, {
                  toolStatus: 'error',
                  toolDetail: formatToolResultDetail(event.toolName, event.toolResult, event.toolError),
                })
              } else if (event.toolResult?.trim()) {
                const replaced = replaceLastToolCall(label, {
                  type: 'thinking',
                  thought: event.toolResult,
                  thinkingCollapsed: true,
                })
                if (!replaced) {
                  pushTimeline({
                    type: 'thinking',
                    thought: event.toolResult,
                    thinkingCollapsed: true,
                  })
                }
              } else {
                updateLastToolCall(label, { toolStatus: 'done' })
              }
            } else {
              const label = formatToolLabel(event.toolName, event.toolInput)
              updateLastToolCall(label, {
                toolStatus: event.toolError ? 'error' : 'done',
                toolDetail: formatToolResultDetail(event.toolName, event.toolResult, event.toolError),
              })
            }

            if (event.toolName === 'done' && event.toolResult) {
              try {
                const doneData = JSON.parse(event.toolResult)
                if (!hadTitle && doneData.title && typeof doneData.title === 'string' && doneData.title.trim()) {
                  setTitle(doneData.title.trim())
                  if (user && projectId) {
                    supabase.from('projects').update({ title: doneData.title.trim() }).eq('id', projectId).then(({ error }) => {
                      if (error) logError('ProjectSaveTitle', error)
                    }, (error: unknown) => logError('ProjectSaveTitle', error))
                  }
                }
                if (typeof doneData.summary === 'string' && doneData.summary.trim()) {
                  updateAssistantMessage(assistantId, { summary: doneData.summary.trim() })
                }
              } catch { /* ok */ }
            }
          }

          if (event.type === 'status' && event.message) {
            setAgentStatus(event.message)
            pushStatus(event.message)
          }
          if ((event.type === 'files' || event.type === 'done') && event.files) {
            setProjectFiles(event.files)
            if (event.type === 'files' || event.filesMutated) setFirstRunComplete(true)
          }
        },
      })

      setProjectFiles(result.files)
      if (result.filesMutated) setFirstRunComplete(true)
      agentHistoryRef.current = result.conversationHistory
      if (projectId && !isViewOnly) {
        supabase.from('projects')
          .update({ agent_history: result.conversationHistory as unknown as Record<string, unknown>[] })
          .eq('id', projectId)
          .then(({ error }) => { if (error) logError('ProjectSaveAgentHistory', error) },
               (error: unknown) => logError('ProjectSaveAgentHistory', error))
      }
      setAgentStatus('')

      // Complete any remaining running tool calls
      for (let i = timeline.length - 1; i >= 0; i--) {
        if (timeline[i].type === 'tool_call' && timeline[i].toolStatus === 'running') {
          timeline[i] = { ...timeline[i], toolStatus: 'done' }
        }
      }

      updateAssistantMessage(assistantId, {
        title: result.filesMutated ? 'Project ready' : undefined,
        timeline: [...timeline],
        files: result.filesMutated ? result.files : undefined,
        turns: result.turns,
        providerName: result.providerName,
        modelName: result.modelName,
      })
    } catch (err) {
      if (isAbortError(err)) {
        const snapshot = agentRunSnapshotRef.current?.controller === controller
          ? agentRunSnapshotRef.current
          : null
        if (snapshot) {
          const restoredFiles = cloneAgentFiles(snapshot.files)
          setProjectFiles(restoredFiles)
          setFirstRunComplete(snapshot.firstRunComplete)

          if (projectId && !isViewOnly) {
            filesSaveChainRef.current = filesSaveChainRef.current
              .then(async () => {
                const { error } = await supabase
                  .from('projects')
                  .update({ files: restoredFiles as unknown as Record<string, unknown>[] })
                  .eq('id', projectId)

                if (error) throw error
              })
              .catch((error) => logError('ProjectRestoreFilesAfterAbort', error))
          }
        }
        setAgentStatus('')
        for (let i = timeline.length - 1; i >= 0; i--) {
          if (timeline[i].type === 'tool_call' && timeline[i].toolStatus === 'running') {
            timeline[i] = { ...timeline[i], toolStatus: 'error' }
          }
        }
        if (!timeline.some((event) => event.type === 'status' && event.text === 'Request cancelled.')) {
          timeline.push({
            id: `ev-${eventCounter++}`,
            timestamp: Date.now(),
            type: 'status',
            text: 'Request cancelled.',
          })
        }
        updateAssistantMessage(assistantId, {
          title: 'Request cancelled',
          timeline: [...timeline],
        })
        return
      }
      logError('ProjectAgentRun', err)
      setAgentStatus('')
      for (let i = timeline.length - 1; i >= 0; i--) {
        if (timeline[i].type === 'tool_call' && timeline[i].toolStatus === 'running') {
          timeline[i] = { ...timeline[i], toolStatus: 'error' }
        }
      }
      updateAssistantMessage(assistantId, {
        title: 'Something went wrong',
        timeline: [...timeline],
        errorInfo: describeAgentError(err, chosenModel?.model_id),
        error: true,
      })
    } finally {
      if (agentAbortRef.current === controller) {
        agentAbortRef.current = null
      }
      if (agentRunSnapshotRef.current?.controller === controller) {
        agentRunSnapshotRef.current = null
      }
      if (projectId) {
        void supabase
          .from('projects')
          .update({ generating: false, generating_by: null })
          .eq('id', projectId)
      }
      setAgentRunning(false)

      // Process queued request if any
      const pending = pendingRequestRef.current
      if (pending) {
        pendingRequestRef.current = null
        void handleAgentRequestRef.current?.(pending.prompt, pending.model, pending.thinkingLevel, { reuseInitialUser: true })
      }
    }
  }, [activeThinkingLevel, firstRunComplete, isViewOnly, projectFiles, projectId, state.selectedModel, title, updateAssistantMessage, user])

  // Keep ref current so the queue effect can call it without stale-closure issues
  useEffect(() => {
    handleAgentRequestRef.current = handleAgentRequest
  }, [handleAgentRequest])

  // Direct text-content edit from the visual editor — no AI. Patches the source
  // deterministically when the text can be located unambiguously; otherwise
  // falls back to the agent.
  const handleTextEdit = useCallback((sel: EditSelection, newText: string) => {
    if (isViewOnly) return
    const label = formatEditLabel(sel, `change text to "${newText}"`)
    const path = resolveOeidPath(projectFiles.map((f) => f.path), sel.oeid)
    const file = path ? projectFiles.find((f) => f.path === path) : undefined
    const patched = file ? applyTextEdit(file.code, sel.text, newText) : null

    if (!file || patched == null) {
      // Couldn't safely locate the text — let the agent handle it.
      setSelection(null)
      setEditMode(false)
      void handleAgentRequest(
        composeEditInstruction(sel, `Change the text to: ${newText}`),
        activeModel,
        activeThinkingLevel,
        { mode: 'refine', displayContent: label },
      )
      return
    }

    const nextFiles = projectFiles.map((f) => (f.path === path ? { ...f, code: patched } : f))
    setProjectFiles(nextFiles)
    // Record the edit in the chat (auto-persists), keep edit mode on, close popover.
    setMessages((current) => [
      ...current,
      { id: `user-textedit-${Date.now()}`, role: 'user' as const, content: label, timeline: [] },
      {
        id: `assistant-textedit-${Date.now()}`,
        role: 'assistant' as const,
        title: 'OpenThorn',
        summary: `Updated the text to “${newText}”.`,
        timeline: [],
        files: nextFiles,
      },
    ])
    setSelection(null)
  }, [isViewOnly, projectFiles, activeModel, activeThinkingLevel, handleAgentRequest])

  // Resume generation that was interrupted by a page reload
  useEffect(() => {
    const pending = resumePromptRef.current
    if (!pending || !filesLoaded || !chatHistoryLoaded || !user || isViewOnly) return
    resumePromptRef.current = null
    isResumingRef.current = false
    // Keep `reconnecting` true until handleAgentRequest flips agentRunning on, so the UI
    // shows "Reconnecting…" continuously instead of flickering back to the idle prompt.
    const timer = setTimeout(() => {
      void handleAgentRequestRef.current?.(pending, activeModel, activeThinkingLevel, {
        reuseInitialUser: true,
        mode: resumeModeRef.current,
      })
    }, 100)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesLoaded, chatHistoryLoaded, user, isViewOnly])

  // When a remote collaborator's generation ends, fire our queued prompt if any
  useEffect(() => {
    const prev = remoteGeneratingPrevRef.current
    remoteGeneratingPrevRef.current = remoteGenerating
    if (prev && !remoteGenerating && !agentRunning) {
      const pending = pendingRequestRef.current
      if (pending) {
        pendingRequestRef.current = null
        void handleAgentRequestRef.current?.(pending.prompt, pending.model, pending.thinkingLevel, { reuseInitialUser: true })
      }
    }
  }, [remoteGenerating, agentRunning])

  // Auto-start agent on fresh project (no persisted files)
  useEffect(() => {
    if (!filesLoaded || !chatHistoryLoaded || !user || isViewOnly || initialAgentStartedRef.current) return
    // Only auto-start if this is a brand-new project from the dashboard (has prompt, no persisted files)
    if (!hasInitialPrompt) return
    initialAgentStartedRef.current = true

    // Use refs to avoid stale closure issues
    const currentPrompt = promptRef.current
    const currentModel = selectedModelRef.current
    const currentThinkingLevel = thinkingLevelRef.current

    // Small delay to ensure all state is settled before invoking the agent
    const timer = setTimeout(() => {
      void handleAgentRequest(currentPrompt, currentModel ?? null, currentThinkingLevel, { reuseInitialUser: true, mode: 'create' })
    }, 100)

    return () => clearTimeout(timer)
    // Only fire once when files are loaded — intentionally exclude handleAgentRequest
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesLoaded, chatHistoryLoaded, user, isViewOnly, hasInitialPrompt])

  const fileTree = useMemo(() => buildFileTree(projectFiles), [projectFiles])

  const toggleFolder = useCallback((folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderPath)) {
        next.delete(folderPath)
      } else {
        next.add(folderPath)
      }
      return next
    })
  }, [])

  // Files now stream in turn by turn while the agent works, so half-built
  // projects routinely fail to compile mid-run. Present those failures as
  // "still building" — only a compile error that survives the run is real.
  const effectivePreviewStatus = previewStatus === 'error' && agentRunning ? 'building' : previewStatus

  if (loading) return null

  return (
    <>
      <div className={styles.root}>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <button className={styles.backBtn} type="button" onClick={() => navigate('/dashboard')} aria-label="Back to dashboard">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>

          <div className={styles.brandCluster}>
            <img src="/assets/logo.png" alt="OpenThorn" className={styles.logo} />
            <div>
              {titleEditing ? (
                <input
                  ref={titleInputRef}
                  className={styles.projectNameInput}
                  defaultValue={title}
                  onBlur={(e) => {
                    if (titleShouldSaveRef.current) handleTitleSave(e.currentTarget.value)
                    else setTitleEditing(false)
                    titleShouldSaveRef.current = true
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') {
                      titleShouldSaveRef.current = false
                      e.currentTarget.blur()
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={styles.projectNameBtn}
                  onClick={() => { if (!isViewOnly) setTitleEditing(true) }}
                  title={isViewOnly ? undefined : 'Click to rename'}
                >
                  {title || 'Untitled project'}
                </button>
              )}
              <div className={styles.projectMeta}>
                {firstRunComplete ? `${projectFiles.length} file${projectFiles.length !== 1 ? 's' : ''}` : 'New project'} · {accessLabel}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.topbarCenter}>
          <div className={styles.modeSwitch} aria-label="View mode">
            <button
              className={viewMode === 'preview' ? styles.modeActive : ''}
              type="button"
              onClick={() => setViewMode('preview')}
            >
              <GlobeIcon />
              Preview
            </button>
            <button
              className={viewMode === 'code' ? styles.modeActive : ''}
              type="button"
              onClick={() => setViewMode('code')}
            >
              <CodeIcon />
              Code
            </button>
          </div>
        </div>

        <div className={styles.topActions}>
          <button
            className={styles.iconBtn}
            type="button"
            aria-label="Download project as ZIP"
            onClick={handleDownloadZip}
            disabled={!firstRunComplete || agentRunning || remoteGenerating}
          >
            <DownloadIcon />
          </button>
          {onlineCollaborators.length > 0 && (
            <div className={styles.presenceAvatars} aria-label="Online collaborators">
              {onlineCollaborators.slice(0, 4).map((c) => (
                <button
                  key={c.userId}
                  type="button"
                  className={styles.presenceAvatar}
                  style={{ background: avatarColor(c.userId), '--avatar-color': avatarColor(c.userId) } as React.CSSProperties}
                  aria-label={`${c.name} — click for info`}
                  onClick={() => setActivePresenceUser((v) => v?.userId === c.userId ? null : c)}
                >
                  {c.initials}
                </button>
              ))}
              {activePresenceUser && (
                <div className={styles.presencePopover}>
                  <div className={styles.presencePopoverAvatar} style={{ background: avatarColor(activePresenceUser.userId) }}>{activePresenceUser.initials}</div>
                  <div className={styles.presencePopoverName}>{activePresenceUser.name}</div>
                  <div className={styles.presencePopoverEmail}>{activePresenceUser.email}</div>
                </div>
              )}
            </div>
          )}
          <button className={styles.shareBtn} type="button" onClick={() => setShareOpen(true)}>
            <ShareIcon />
            Share
          </button>
          <button
            className={styles.publishBtn}
            type="button"
            onClick={() => { setPublishDescription(''); setPublishError(''); setPublishModalOpen(true) }}
            disabled={!firstRunComplete}
            title={!firstRunComplete ? 'Build the project first before publishing' : 'Publish to Community'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Publish
          </button>
          <button
            className={styles.publishBtn}
            type="button"
            onClick={() => setBackendModalOpen(true)}
            title="Connect a Supabase backend (database + accounts)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M3 5v14a9 3 0 0 0 18 0V5"/>
              <path d="M3 12a9 3 0 0 0 18 0"/>
            </svg>
            Backend
          </button>
          <button
            className={`${styles.deployBtn} ${deployState === 'deployed' ? styles.deployBtnDeployed : ''}`}
            type="button"
            onClick={deployState === 'deployed' ? () => window.open(deployUrl, '_blank') : handleDeploy}
            disabled={deployState === 'deploying' || !firstRunComplete || agentRunning || remoteGenerating}
          >
            {deployState === 'deploying' ? (
              <><span className={styles.spinner} />Deploying…</>
            ) : deployState === 'deployed' ? (
              <>View site <ExternalIcon /></>
            ) : (
              <>Deploy</>
            )}
          </button>
        </div>
      </header>

      {shareOpen && (
        <div
          className={styles.shareOverlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShareOpen(false)
          }}
        >
          <section className={styles.shareDialog} role="dialog" aria-modal="true" aria-labelledby="share-dialog-title">
            <div className={styles.shareHeader}>
              <div>
                <h2 id="share-dialog-title">Share {title}</h2>
              </div>
              <button className={styles.closeBtn} type="button" aria-label="Close share dialog" onClick={() => setShareOpen(false)}>
                <CloseIcon />
              </button>
            </div>

            {canManageShare ? (
              <form className={styles.inviteForm} onSubmit={handleInviteCollaborator}>
                <label className={styles.inviteLabel} htmlFor="collaborator-email">Invite by email</label>
                <div className={styles.inviteRow}>
                  <div className={styles.emailInputWrap}>
                    <MailIcon />
                    <input
                      id="collaborator-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => {
                        setInviteEmail(event.target.value)
                        setInviteError('')
                        setInviteStatus('')
                      }}
                      placeholder="teammate@company.com"
                      autoComplete="email"
                    />
                  </div>

                  <div className={styles.permissionToggle} aria-label="Invite permission">
                    <button
                      className={invitePermission === 'view' ? styles.permissionActive : ''}
                      type="button"
                      onClick={() => setInvitePermission('view')}
                    >
                      View
                    </button>
                    <button
                      className={invitePermission === 'edit' ? styles.permissionActive : ''}
                      type="button"
                      onClick={() => setInvitePermission('edit')}
                    >
                      Edit
                    </button>
                  </div>

                  <button className={styles.inviteBtn} type="submit" disabled={!canInvite}>
                    {inviteLoading ? 'Checking' : 'Invite'}
                  </button>
                </div>

                <div className={styles.inviteFeedback} aria-live="polite">
                  {inviteError && <span className={styles.inviteError}>{inviteError}</span>}
                  {inviteStatus && <span className={styles.inviteSuccess}>{inviteStatus}</span>}
                </div>
              </form>
            ) : (
              <div className={styles.readOnlyShare}>
                You have {projectAccess === 'edit' ? 'edit' : 'view-only'} access. The project owner manages invitations and permissions.
              </div>
            )}

            <div className={styles.linkPanel}>
              <div className={styles.linkIcon}><LinkIcon /></div>
              <div className={styles.linkText}>
                <span>Invite link</span>
                <strong>{inviteLink}</strong>
              </div>
              <button className={styles.copyBtn} type="button" onClick={handleCopyLink}>
                {linkCopied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className={styles.peoplePanel}>
              <div className={styles.peopleHeader}>
                <h3>People with access</h3>
                <span>{collaborators.length + 1} total</span>
              </div>

              <div className={styles.personList}>
                <article className={styles.personItem}>
                  <div className={styles.personAvatar}>
                    {userAvatar ? <img src={userAvatar} alt="" /> : userInitial}
                  </div>
                  <div className={styles.personInfo}>
                    <strong>{ownerName}</strong>
                    <span>{ownerEmail}</span>
                  </div>
                  <span className={styles.ownerBadge}>Owner</span>
                </article>

                {collaborators.length === 0 ? (
                  <div className={styles.emptyInvites}>
                    Invite collaborators to keep feedback, edits, and handoff in one place.
                  </div>
                ) : (
                  collaborators.map((collaborator) => (
                    <article className={styles.personItem} key={collaborator.id}>
                      <div className={styles.personAvatar}>{collaborator.name.charAt(0).toUpperCase()}</div>
                      <div className={styles.personInfo}>
                        <strong>{collaborator.name}</strong>
                        <span>
                          {collaborator.email} - {collaborator.accountVerified ? 'OpenThorn account' : 'Pending'} - Invited {new Date(collaborator.invitedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      {canManageShare ? (
                        <>
                          <select
                            className={styles.permissionSelect}
                            value={collaborator.permission}
                            aria-label={`Permission for ${collaborator.email}`}
                            onChange={(event) => handlePermissionChange(collaborator.id, event.target.value as SharePermission)}
                          >
                            <option value="view">Can view</option>
                            <option value="edit">Can edit</option>
                          </select>
                          <button
                            className={styles.removeBtn}
                            type="button"
                            aria-label={`Remove ${collaborator.email}`}
                            onClick={() => handleRemoveCollaborator(collaborator.id)}
                          >
                            <TrashIcon />
                          </button>
                        </>
                      ) : (
                        <span className={styles.ownerBadge}>{collaborator.permission === 'edit' ? 'Can edit' : 'Can view'}</span>
                      )}
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {deployModalOpen && (
        <div
          className={styles.shareOverlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && deployState !== 'deploying') {
              setDeployModalOpen(false)
            }
          }}
        >
          <section className={styles.deployModal} role="dialog" aria-modal="true" aria-labelledby="deploy-modal-title">
            <div className={styles.shareHeader}>
              <div>
                <h2 id="deploy-modal-title">Deploy project</h2>
              </div>
              {deployState !== 'deploying' && (
                <button className={styles.closeBtn} type="button" aria-label="Close" onClick={() => setDeployModalOpen(false)}>
                  <CloseIcon />
                </button>
              )}
            </div>

            <div className={styles.deployBody}>
              {deployState === 'deploying' && (
                <div className={styles.deployStatus}>
                  <span className={styles.spinnerLarge} />
                  <p>Bundling and deploying your project…</p>
                </div>
              )}

              {deployState === 'deployed' && (
                <div className={styles.deployStatus}>
                  <div className={styles.deploySuccessIcon}>
                    <CheckIconLarge />
                  </div>
                  <p>Your site is live!</p>
                  <a href={deployUrl} target="_blank" rel="noopener noreferrer" className={styles.deployUrl}>
                    {deployUrl}
                  </a>
                  <button
                    className={styles.deployBtn}
                    type="button"
                    onClick={() => window.open(deployUrl, '_blank')}
                  >
                    View site <ExternalIcon />
                  </button>
                </div>
              )}

              {deployState === 'error' && (
                <div className={styles.deployStatus}>
                  <p className={styles.deployError}>{deployError}</p>
                  <button className={styles.deployBtn} type="button" onClick={handleDeploy}>
                    Retry
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {backendModalOpen && (
        <div
          className={styles.shareOverlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setBackendModalOpen(false)
          }}
        >
          <section className={styles.deployModal} role="dialog" aria-modal="true" aria-labelledby="backend-modal-title">
            <div className={styles.shareHeader}>
              <div>
                <h2 id="backend-modal-title">Backend</h2>
              </div>
              <button className={styles.closeBtn} type="button" aria-label="Close" onClick={() => setBackendModalOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            <div className={styles.deployBody}>
              {projectId && <ConnectBackend projectId={projectId} />}
            </div>
          </section>
        </div>
      )}


      <main className={styles.shell}>
        <aside className={styles.chatPanel}>
          <div className={styles.thread}>
            {messages.map((message) => (
              message.role === 'user' ? (
                <article className={styles.userMessage} key={message.id}>
                  <div className={styles.avatar}>
                    {userAvatar ? <img src={userAvatar} alt="" /> : userInitial}
                  </div>
                  <div className={styles.userBubble}>
                    <p>{message.content}</p>
                  </div>
                </article>
              ) : (
                <article
                  className={`${styles.assistantMessage} ${message.error && !message.errorInfo ? styles.assistantMessageError : ''}`}
                  key={message.id}
                >
                  <div className={styles.assistantTop}>
                    <img src="/assets/logo.png" alt="" />
                    <span>{message.title ?? 'OpenThorn'}</span>
                  </div>

                  {/* Chronological timeline: text, thinking, and tool calls in order */}
                  <div className={styles.timeline}>
                    {message.timeline.map((event) => {
                      if (event.type === 'text') {
                        return (
                          <div key={event.id} className={styles.timelineText}>
                            <MarkdownBlock markdown={event.text || ''} />
                          </div>
                        )
                      }

                      if (event.type === 'thinking') {
                        return (
                          <TimelineThinking
                            key={event.id}
                            thought={event.thought || ''}
                            collapsed={event.thinkingCollapsed !== false}
                            onToggle={() => {
                              setMessages((current) => current.map((m) => {
                                if (m.id !== message.id) return m
                                return {
                                  ...m,
                                  timeline: m.timeline.map((e) =>
                                    e.id === event.id ? { ...e, thinkingCollapsed: !e.thinkingCollapsed } : e
                                  ),
                                }
                              }))
                            }}
                          />
                        )
                      }

                      if (event.type === 'status') {
                        return (
                          <div
                            key={event.id}
                            className={`${styles.timelineStatus} ${event.statusTone === 'success' ? styles.timelineStatusSuccess : ''}`}
                          >
                            {event.text}
                          </div>
                        )
                      }

                      if (event.type === 'tool_call') {
                        return (
                          <div
                            key={event.id}
                            className={`${styles.toolCall} ${event.toolStatus === 'running' ? styles.toolCallRunning : ''} ${event.toolStatus === 'error' ? styles.toolCallError : ''}`}
                          >
                            <span className={styles.toolCallIcon}>
                              {event.toolStatus === 'done' ? (
                                <CheckIcon />
                              ) : event.toolStatus === 'error' ? (
                                <span className={styles.toolCallX}>×</span>
                              ) : (
                                <span className={styles.miniSpinner} />
                              )}
                            </span>
                            <span className={styles.toolCallLabel}>{event.toolLabel}</span>
                            {event.toolDetail && (
                              <span className={styles.toolCallDetail}>{event.toolDetail}</span>
                            )}
                          </div>
                        )
                      }

                      return null
                    })}
                  </div>

                  {/* Error card with reason and tip */}
                  {message.errorInfo && (
                    <div className={styles.errorCard}>
                      <div className={styles.errorCardHeader}>
                        <span className={styles.errorCardIcon} aria-hidden="true">!</span>
                        <span className={styles.errorCardTitle}>{message.errorInfo.title}</span>
                      </div>
                      {message.errorInfo.detail && (
                        <p className={styles.errorCardDetail}>{message.errorInfo.detail}</p>
                      )}
                      {message.errorInfo.tip && (
                        <p className={styles.errorCardTip}>
                          <span className={styles.errorCardTipLabel}>Tip</span>
                          {message.errorInfo.tip}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Summary at completion */}
                  {message.summary && (
                    <p className={styles.completionSummary}>{message.summary}</p>
                  )}

                  {/* Completion badge */}
                  {message.turns != null && message.turns > 0 && (
                    <div className={styles.completionBadge}>
                      Built in {message.turns} turn{message.turns === 1 ? '' : 's'}
                      {message.providerName && ` - ${message.providerName}`}
                      {message.modelName && ` / ${message.modelName}`}
                    </div>
                  )}
                </article>
              )
            ))}

            {(agentRunning || reconnecting || remoteGenerating) && (
              <div className={styles.generatingIndicator} role="status" aria-label="Generating">
                <span className={styles.generatingDot} aria-hidden="true" />
              </div>
            )}
          </div>

          <div className={styles.composer}>
            {isViewOnly ? (
              <div className={styles.viewOnlyNotice}>
                View-only access. Ask the owner for edit permission to make changes.
              </div>
            ) : (
              <PromptInput
                size="small"
                page="dashboard"
                disableTyping
                initialModel={activeModel}
                initialThinkingLevel={activeThinkingLevel}
                modelMenuPlacement="top"
                placeholder={
                  reconnecting
                    ? `Reconnecting to ${activeModel?.model_name ?? 'the model'} — resuming your work…`
                    : agentRunning
                      ? agentStatus || 'OpenThorn is working...'
                      : remoteGenerating
                        ? 'A collaborator is generating…'
                        : 'Ask OpenThorn for a change...'
                }
                onModelChange={(model) => {
                  setActiveModel(model)
                  if (projectId && model) {
                    void supabase.from('projects').update({ selected_model: model }).eq('id', projectId)
                  }
                }}
                isRunning={agentRunning}
                onCancel={handleCancelAgent}
                disabled={reconnecting || remoteGenerating}
                onSubmit={(nextPrompt, selectedModel, thinkingLevel) => { void handleAgentRequest(nextPrompt, selectedModel, thinkingLevel) }}
              />
            )}
          </div>
        </aside>

        <section className={`${styles.previewPane} ${fullscreen ? styles.previewPaneFullscreen : ''}`}>
          <div className={styles.previewToolbar}>
            <div className={styles.previewCenter}>
              <div className={styles.deviceSwitch} aria-label="Device preview">
                <button
                  className={deviceMode === 'desktop' ? styles.deviceBtnActive : styles.deviceBtn}
                  type="button"
                  aria-label="Desktop preview"
                  onClick={() => setDeviceMode('desktop')}
                >
                  <DesktopIcon />
                </button>
                <button
                  className={deviceMode === 'tablet' ? styles.deviceBtnActive : styles.deviceBtn}
                  type="button"
                  aria-label="Tablet preview"
                  onClick={() => setDeviceMode('tablet')}
                >
                  <TabletIcon />
                </button>
                <button
                  className={deviceMode === 'phone' ? styles.deviceBtnActive : styles.deviceBtn}
                  type="button"
                  aria-label="Phone preview"
                  onClick={() => setDeviceMode('phone')}
                >
                  <PhoneIcon />
                </button>
              </div>
              <div className={styles.addressBar}>
                {deployUrl ? (
                  <>
                    <RefreshIcon />
                    <span>{new URL(deployUrl).hostname}{new URL(deployUrl).pathname}</span>
                  </>
                ) : (
                  <>
                    <RefreshIcon />
                    <span>/</span>
                    <ChevronDownIcon />
                  </>
                )}
              </div>
            </div>

            <div className={styles.previewTools}>
              <button
                className={`${styles.iconBtn} ${editMode ? styles.editToggleActive : ''}`}
                type="button"
                aria-pressed={editMode}
                disabled={agentRunning || effectivePreviewStatus !== 'ready'}
                aria-label={editMode ? 'Exit edit mode' : 'Edit elements'}
                title={editMode ? 'Exit edit mode' : 'Click an element to edit it'}
                onClick={() => setEditMode((value) => !value)}
              >
                <EditCursorIcon />
              </button>
              <button
                className={styles.iconBtn}
                type="button"
                aria-label={fullscreen ? 'Exit fullscreen preview' : 'Fullscreen preview'}
                onClick={() => setFullscreen((value) => !value)}
              >
                {fullscreen ? <MinimizeIcon /> : <FullscreenIcon />}
              </button>
            </div>
          </div>

          {viewMode === 'preview' ? (
            <div className={styles.previewStage}>
              {editMode && (
                <div className={styles.editModeBadge} role="status">
                  <EditCursorIcon />
                  <span>{selection ? 'Editing element' : 'Click any element to edit'}</span>
                  <kbd>Esc</kbd>
                </div>
              )}
              <div className={`${styles.deviceFrame} ${styles[deviceMode]}`}>
                <div className={`${styles.previewCard} ${editMode ? styles.previewCardEditing : ''}`}>
                  <div className={styles.previewChrome}>
                    <div className={styles.previewChromeDots}>
                      <span />
                      <span />
                      <span />
                    </div>
                    <span className={styles.previewState}>
                      {!firstRunComplete ? (reconnecting ? 'Reconnecting…' : agentRunning ? 'Agent working' : 'Waiting for build') : effectivePreviewStatus === 'building' ? 'Building...' : effectivePreviewStatus === 'error' ? 'Build failed' : effectivePreviewStatus === 'ready' ? 'Live preview' : 'Waiting for build'}
                    </span>
                  </div>

                  {!firstRunComplete && (
                    <div className={`${styles.previewEmpty} ${styles.previewBlank}`}>
                      <div className={styles.previewMark}>
                        <img src="/assets/logo.png" alt="" />
                      </div>
                      <h2>{reconnecting ? `Reconnecting to ${activeModel?.model_name ?? 'the model'}…` : agentRunning ? 'OpenThorn is building...' : 'Ready when you are'}</h2>
                      <p>{prompt}</p>
                      {(agentRunning || reconnecting) && (
                        <div className={styles.previewChecklist}>
                          <span><CheckIcon /> Prompt captured</span>
                          <span><span className={styles.spinnerSmall} /> {reconnecting ? 'Resuming your last request…' : agentStatus || 'Generating project'}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {firstRunComplete && effectivePreviewStatus === 'building' && !lastReadyHtml && (
                    <div className={styles.previewEmpty}>
                      <div className={styles.previewMark}>
                        <img src="/assets/logo.png" alt="" />
                      </div>
                      <h2>Building preview...</h2>
                      <p>{prompt}</p>
                      <div className={styles.previewChecklist}>
                        <span><CheckIcon /> Files updated</span>
                        <span><span className={styles.spinnerSmall} /> Compiling...</span>
                      </div>
                    </div>
                  )}

                  {firstRunComplete && effectivePreviewStatus === 'error' && (
                    <div className={styles.previewEmpty}>
                      <div className={styles.previewMark}>
                        <img src="/assets/logo.png" alt="" />
                      </div>
                      <h2>Build error</h2>
                      <p>The preview could not be compiled. Check the code for syntax issues.</p>
                      <div className={styles.errorList}>
                        {previewErrors.map((err, i) => (
                          <pre key={i} className={styles.errorLine}>{escapeHtml(err)}</pre>
                        ))}
                      </div>
                    </div>
                  )}

                  {firstRunComplete && previewStatus === 'idle' && (
                    <div className={styles.previewEmpty}>
                      <div className={styles.previewMark}>
                        <img src="/assets/logo.png" alt="" />
                      </div>
                      <h2>Preview will appear here</h2>
                      <p>{prompt}</p>
                      <div className={styles.previewChecklist}>
                        <span><CheckIcon /> Layout shell</span>
                        <span><CheckIcon /> Prompt captured</span>
                        <span><ClockIcon /> Generation pipeline</span>
                      </div>
                    </div>
                  )}

                  {firstRunComplete && (effectivePreviewStatus === 'ready' || (effectivePreviewStatus === 'building' && lastReadyHtml)) && (
                    <div
                      className={styles.previewRebuild}
                      onPointerDown={(e) => {
                        // Touch taps must pass straight through to the iframe — stealing
                        // focus on a touch pointerdown swallows the tap on mobile. Keyboard
                        // routing only matters for physical keyboards (mouse/pen) anyway.
                        if (e.pointerType === 'touch') return
                        // Route keyboard input (space, arrow keys, etc.) into the game.
                        // Focus the iframe element itself — contentWindow.focus() alone is
                        // unreliable for a sandboxed (opaque-origin) iframe.
                        previewFrameRef.current?.focus()
                        previewFrameRef.current?.contentWindow?.focus()
                      }}
                      onPointerEnter={(e) => {
                        // Hover-to-play: let keys reach the game without an explicit click,
                        // but never yank focus away while the user is typing in the chat/inputs.
                        // Skip touch so it doesn't interfere with tapping the preview.
                        if (e.pointerType === 'touch') return
                        const el = document.activeElement
                        const tag = el?.tagName
                        if (tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement | null)?.isContentEditable) return
                        previewFrameRef.current?.focus()
                        previewFrameRef.current?.contentWindow?.focus()
                      }}
                    >
                      {effectivePreviewStatus === 'building' && <div className={styles.rebuildOverlay} />}
                      <iframe
                        ref={previewFrameRef}
                        className={styles.previewFrame}
                        srcDoc={previewStatus === 'ready' ? previewHtml : lastReadyHtml}
                        sandbox="allow-scripts"
                        title="Live preview"
                        onLoad={() => {
                          // A rebuild swaps srcDoc and resets focus to the document body.
                          // If the user was playing (focus was on the preview/body, not an
                          // input), restore focus so the game stays keyboard-controllable.
                          const el = document.activeElement
                          if (el === previewFrameRef.current || el === document.body || el === null) {
                            previewFrameRef.current?.focus()
                            previewFrameRef.current?.contentWindow?.focus()
                          }
                          // Re-sync select mode to the freshly loaded frame (avoids the
                          // race where the enable message is posted before the frame's
                          // listener is attached).
                          previewFrameRef.current?.contentWindow?.postMessage(
                            { __openthornEdit: selectActive ? 'enable' : 'disable' },
                            '*',
                          )
                        }}
                      />
                    </div>
                  )}

                  {editMode && selection && (
                    <PreviewEditPopover
                      selection={selection}
                      frameOffset={(() => {
                        const r = previewFrameRef.current?.getBoundingClientRect()
                        return { top: r?.top ?? 0, left: r?.left ?? 0 }
                      })()}
                      busy={agentRunning}
                      onClose={() => setSelection(null)}
                      onTextEdit={(sel, newText) => handleTextEdit(sel, newText)}
                      onSubmit={(instruction, sel) => {
                        setSelection(null)
                        setEditMode(false)
                        void handleAgentRequest(
                          composeEditInstruction(sel, instruction),
                          activeModel,
                          activeThinkingLevel,
                          { mode: 'refine', displayContent: formatEditLabel(sel, instruction) },
                        )
                      }}
                    />
                  )}

                  {firstRunComplete && previewStatus !== 'ready' && !lastReadyHtml && (
                    <div className={styles.previewSkeleton} aria-hidden="true">
                      <div className={styles.skeletonWide} />
                      <div />
                      <div />
                      <div />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.codeWorkspace}>
              <aside className={styles.codeSidebar}>
                <div className={styles.codeSidebarTitle}>Explorer</div>
                <div className={styles.fileTree}>
                  {fileTree.map((node) => (
                    <TreeNodeRenderer
                      key={node.path}
                      node={node}
                      depth={0}
                      activeFile={activeFile}
                      expandedFolders={expandedFolders}
                      onSelectFile={setActiveFile}
                      onToggleFolder={toggleFolder}
                    />
                  ))}
                </div>
              </aside>

              <div className={styles.editorPane}>
                <div className={styles.editorTabs}>
                  <div className={styles.editorTab}>
                    <span className={styles.tabIcon}>
                      <FileSvg />
                    </span>
                    {activeCodeFile.path.split('/').pop()}
                    <button className={styles.tabClose} type="button" aria-label="Close tab">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                </div>
                <div className={styles.editorBody}>
                  <div className={styles.editorGutter}>
                    {activeCodeFile.code.split('\n').map((_, i) => (
                      <span key={i}>{i + 1}</span>
                    ))}
                  </div>
                  <pre className={styles.codeBlock}><code dangerouslySetInnerHTML={{ __html: highlightCode(activeCodeFile.code, activeCodeFile.language) }} /></pre>
                </div>
                <div className={styles.editorStatusBar}>
                  <span>{activeCodeFile.language.toUpperCase()}</span>
                  <span>UTF-8</span>
                  <span>Ln {activeCodeFile.code.split('\n').length}</span>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

    </div>

    {/* Publish to Community modal — outside root to avoid stacking context issues */}
    {publishModalOpen && (
        <div className={styles.publishBackdrop} onClick={(e) => { if (e.target === e.currentTarget) { setPublishError(''); setPublishModalOpen(false) } }}>
          <div className={styles.publishModal}>
            <button className={styles.publishClose} type="button" onClick={() => { setPublishError(''); setPublishModalOpen(false) }} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <h2 className={styles.publishModalTitle}>Publish to Community</h2>
            <p className={styles.publishModalSubtitle}>
              Share <strong>{title || 'this project'}</strong> with the OpenThorn community.
            </p>
            <label className={styles.publishModalLabel}>
              Description <span className={styles.publishModalOptional}>(optional)</span>
            </label>
            <textarea
              className={styles.publishModalTextarea}
              placeholder="What did you build? Add a short description…"
              value={publishDescription}
              onChange={(e) => setPublishDescription(e.target.value)}
              rows={3}
              maxLength={280}
            />
            {publishError && <p className={styles.publishModalError}>{publishError}</p>}
            <button
              className={styles.publishModalBtn}
              type="button"
              onClick={handlePublishToCommunity}
              disabled={publishing}
            >
              {publishing ? 'Publishing…' : 'Publish →'}
            </button>
          </div>
        </div>
      )}

      {/* Success toast */}
      {publishSuccess && (
        <div className={styles.publishSuccessToast}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Published to Community
        </div>
      )}
    </>
  )
}

function ExternalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
    </svg>
  )
}

function CheckIconLarge() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function MarkdownBlock({ markdown }: { markdown: string }) {
  if (!markdown?.trim()) return null

  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Open links in new tab
          a: ({ href, children, ...props }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
              {children}
            </a>
          ),
          // Wrap tables for horizontal scroll on mobile
          table: ({ children, ...props }) => (
            <div className={styles.tableWrapper}>
              <table {...props}>{children}</table>
            </div>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}

/** A single thinking entry in the timeline. Collapsed by default. */
function TimelineThinking({
  thought,
  collapsed,
  onToggle,
}: {
  thought: string
  collapsed: boolean
  onToggle: () => void
}) {
  if (!thought) return null

  return (
    <div className={`${styles.thinkingBlock} ${collapsed ? styles.thinkingBlockCollapsed : ''}`}>
      <button
        type="button"
        className={styles.thinkingToggle}
        onClick={onToggle}
      >
        <span className={styles.thinkingIcon}>
          <ChevronSvg expanded={!collapsed} />
        </span>
        <span className={styles.thinkingLabel}>
          {collapsed ? 'Thinking — tap to expand' : 'Thinking'}
        </span>
      </button>
      {!collapsed && (
        <div className={styles.thinkingContent}>
          <div className={styles.thinkingThought}>
            {thought.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function GlobeIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20"/></svg>
}

function CodeIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></svg>
}

function DownloadIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z" />
      <path d="M12 11v5M9 14l3 3 3-3" />
    </svg>
  )
}

function ShareIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M16 6l-8 4.5M8 13.5l8 4.5"/><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/></svg>
}

function CloseIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
}

function MailIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z"/><path d="M22 6l-10 7L2 6"/></svg>
}

function LinkIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
}

function TrashIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
}


function DesktopIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>
}

function RefreshIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12a9 9 0 11-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
}

function ChevronDownIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
}

function CheckIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 6L9 17l-5-5"/></svg>
}

function ClockIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
}


function TabletIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M11 18h2"/></svg>
}

function PhoneIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>
}

function FullscreenIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5"/></svg>
}

function MinimizeIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 3v5H3M16 3v5h5M8 21v-5H3M21 16h-5v5"/></svg>
}

function EditCursorIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {/* pointer */}
      <path d="M5 3.5l6.4 15.3 2-6.1 6.1-2L5 3.5z" fill="currentColor" fillOpacity="0.14" />
      {/* sparkle — "smart" edit */}
      <path d="M18.5 3v3M17 4.5h3" />
    </svg>
  )
}

function FolderSvg({ open }: { open?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="0.9">
      {open ? (
        <path d="M12.5 12.5a1 1 0 001-1V5.5a1 1 0 00-1-1H7.7L6.5 3.5H3.5a1 1 0 00-1 1v8a1 1 0 001 1h9z"/>
      ) : (
        <path d="M12.5 12.5a1 1 0 001-1V5.5a1 1 0 00-1-1H7.7L6.5 3.5H3.5a1 1 0 00-1 1v8a1 1 0 001 1h9z"/>
      )}
    </svg>
  )
}

function FileSvg() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="0.9">
      <path d="M4.5 1.5h5.5l3.5 3.5v9.5a1 1 0 01-1 1h-8a1 1 0 01-1-1v-12a1 1 0 011-1z"/>
      <path d="M10 1.5v3.5h3.5"/>
    </svg>
  )
}

function ChevronSvg({ expanded }: { expanded?: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 10 10" fill="none"
      style={{ transform: expanded ? 'rotate(90deg)' : undefined, transition: 'transform 0.12s ease' }}
    >
      <path d="M3.5 2L6.5 5L3.5 8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

interface TreeNodeRendererProps {
  node: FileTreeNode
  depth: number
  activeFile: string
  expandedFolders: Set<string>
  onSelectFile: (path: string) => void
  onToggleFolder: (path: string) => void
}

function TreeNodeRenderer({ node, depth, activeFile, expandedFolders, onSelectFile, onToggleFolder }: TreeNodeRendererProps) {
  const isExpanded = expandedFolders.has(node.path)
  const indent = depth * 16

  if (node.type === 'folder') {
    return (
      <div>
        <button
          className={styles.treeNode}
          style={{ paddingLeft: 8 + indent }}
          type="button"
          onClick={() => onToggleFolder(node.path)}
        >
          <span className={styles.treeGuides}>
            {Array.from({ length: depth }, (_, i) => (
              <span key={i} className={styles.treeGuide} style={{ left: 8 + i * 16 + 5 }} />
            ))}
          </span>
          <span className={styles.treeChevron}>
            <ChevronSvg expanded={isExpanded} />
          </span>
          <span className={styles.treeIcon}><FolderSvg open={isExpanded} /></span>
          <span className={styles.treeName}>{node.name}</span>
        </button>
        {isExpanded && node.children.map((child) => (
          <TreeNodeRenderer
            key={child.path}
            node={child}
            depth={depth + 1}
            activeFile={activeFile}
            expandedFolders={expandedFolders}
            onSelectFile={onSelectFile}
            onToggleFolder={onToggleFolder}
          />
        ))}
      </div>
    )
  }

  return (
    <button
      className={`${styles.treeNode} ${styles.treeFile} ${node.path === activeFile ? styles.treeFileActive : ''}`}
      style={{ paddingLeft: 8 + indent }}
      type="button"
      onClick={() => onSelectFile(node.path)}
    >
      <span className={styles.treeGuides}>
        {Array.from({ length: depth }, (_, i) => (
          <span key={i} className={styles.treeGuide} style={{ left: 8 + i * 16 + 5 }} />
        ))}
      </span>
      <span className={styles.treeChevron} />
      <span className={styles.treeIcon}><FileSvg /></span>
      <span className={styles.treeName}>{node.name}</span>
    </button>
  )
}
