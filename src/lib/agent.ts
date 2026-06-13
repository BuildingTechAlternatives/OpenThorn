import {
  AGENT_SYSTEM_PROMPT,
  AGENT_TOOLS,
  TOOL_CATEGORIES,
  COMPACTION_PROMPT,
  SPEC_PHASE_PROMPT,
  buildThinkingLevelPrompt,
  resolveActiveSkills,
  getThinkingBudget,
  getReasoningParams,
  loopBreakPrompt,
  turnBudgetPrompt,
  type ToolDefinition,
} from './agent-prompt'
import { decryptApiKey, encryptApiKey } from './crypto'
import {
  AGENT_THINKING_PROFILES,
  normalizeThinkingLevel,
  type AgentThinkingLevel,
} from './agent-thinking'
import { buildPreview } from './preview-bundle'
import { captureResponsiveViews } from './preview-screenshot'
import {
  runtimeSmokeTest,
  interactiveSmokeTest,
  formatRuntimeReport,
} from './preview-runtime-check'
import {
  VISUAL_REVIEW_SYSTEM,
  buildVisualReviewPrompt,
  formatVisualFeedback,
  parseVisualReview,
  viewsToVisionImages,
} from './agent-vision'
import {
  PLAN_PATH,
  createPlan,
  extractRequirements,
  parsePlan,
  formatPlan,
  applyPlanUpdate,
  planToSystemReminder,
  unmetRequirements,
  type AgentPlan,
  type PlanUpdate,
} from './agent-plan'
import {
  loadUserMemory,
  rememberForUser,
  userMemoryToSystemReminder,
  inferPreferencesFromPrompt,
} from './user-memory'
import { supabase } from './supabase'
import {
  type LessonEntry,
  type ChangelogEntry,
  formatLessons,
  parseLessons,
  addLesson,
  lessonsToSystemReminder,
  formatChangelog,
  parseChangelog,
  changelogToSystemReminder,
  createChangelogEntry,
  generateSessionId,
} from './agent-memory'
import {
  DEFAULT_BASE_URLS,
  DEFAULT_PROVIDER_MODELS,
  PROVIDER_DEFS,
  parseProviderModels,
} from './providers'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AgentCodeFile {
  path: string
  language: string
  code: string
}

export interface SelectedAgentModel {
  provider_id: string
  provider_name: string
  model_name: string
  model_id: string
}

export interface AgentProgressEvent {
  type:
    | 'text'
    | 'tool_start'
    | 'tool_result'
    | 'files'
    | 'done'
    | 'status'
    | 'compaction'
    | 'title'
    | 'usage'
    | 'generating'
  text?: string
  toolName?: string
  toolInput?: Record<string, unknown>
  toolResult?: string
  toolError?: boolean
  files?: AgentCodeFile[]
  filesMutated?: boolean
  message?: string
  /** Cumulative token usage for the run (type 'usage'). */
  usage?: RunUsage
}

/** Token usage accumulated across a run — cache fields verify hit rates. */
export interface RunUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export interface AgentRunInput {
  userId: string
  prompt: string
  title: string
  files: AgentCodeFile[]
  selectedModel?: SelectedAgentModel | null
  thinkingLevel?: AgentThinkingLevel
  mode?: 'create' | 'refine'
  maxTurns?: number
  signal?: AbortSignal
  onProgress?: (event: AgentProgressEvent) => void
}

export interface AgentRunResult {
  files: AgentCodeFile[]
  turns: number
  providerName: string
  modelName: string
  usage: RunUsage
  filesMutated: boolean
}

// ─── Internal Types ─────────────────────────────────────────────────────────

interface ProviderKeyRow {
  id: string
  provider_id: string
  provider_name: string
  api_key: string
  base_url: string | null
  models: string | null
  enabled: boolean
  is_custom: boolean | null
}

interface ModelInfo {
  name: string
  id: string
}

interface ResolvedProvider {
  key: ProviderKeyRow
  baseUrl: string
  model: ModelInfo
  /** All models available on this provider (for phase-based routing). */
  models: ModelInfo[]
}

interface LlmMessage {
  role: 'user' | 'assistant'
  content: string | LlmContentBlock[]
  /** DeepSeek thinking mode — must be replayed verbatim on subsequent calls. */
  reasoningContent?: string
}

interface LlmContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'image' | 'thinking'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  thoughtSignature?: string
  tool_use_id?: string
  content?: string
  is_error?: boolean
  /** For type 'image': base64 PNG data (no data: prefix) + media type. */
  image?: { base64: string; mediaType: string }
  /** For type 'thinking' (Anthropic extended thinking — must be replayed). */
  thinking?: string
  signature?: string
}

interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  thoughtSignature?: string
}

interface StructuredError {
  code: string
  message: string
  suggestion: string
  retryable: boolean
  similarPaths?: string[]
}

interface ToolResult {
  content: string
  isError: boolean
  files?: AgentCodeFile[]
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ALLOWED_PROVIDER_HOSTS = new Set([
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  'api.deepseek.com',
  'api.mistral.ai',
  'api.groq.com',
  'api.together.xyz',
  'openrouter.ai',
  'api.openrouter.ai',
  'api.x.ai',
  'api.together.ai',
  'api.perplexity.ai',
  'api.fireworks.ai',
  'api.cerebras.ai',
  'api.cohere.com',
  'api.cohere.ai',
  'api.rodiumai.io',
  'api.github.com',
  'models.github.com',
  'localhost',
  '127.0.0.1',
  'bedrock-runtime.us-east-1.amazonaws.com',
])

const MAX_OUTPUT_TOKENS = 8192
// Headroom for build → fix → runtime-fix → verify loops on complex apps.
const MAX_TOOL_TURNS = 30

// ─── Compaction Settings ────────────────────────────────────────────────────

const COMPACTION_THRESHOLD = 5
const KEEP_RECENT_TURNS = 3
const SUMMARY_INTERVAL = 6
const READ_TRUNCATE_LINES = 500
const OBSERVATION_TOOLS = new Set([
  'list_files',
  'read_file',
  'search_files',
  'compile',
])

// ─── Result Truncation Limits ──────────────────────────────────────────────

/** Max lines to show from list_files result. */
const LIST_FILES_MAX = 40
/** Max matches to show from search_files (content mode). */
const SEARCH_MAX_MATCHES = 30
/** Max errors to show from compile. */
const COMPILE_MAX_ERRORS = 8

// ─── Circuit Breaker Settings ──────────────────────────────────────────────

/** Consecutive failures before the circuit opens. */
const CB_FAILURE_THRESHOLD = 3
/** How long the circuit stays open (ms). */
const CB_COOLDOWN_MS = 30_000
/** Base delay for exponential backoff (ms). */
const BACKOFF_BASE_MS = 1000
/** Maximum backoff delay (ms). */
const BACKOFF_MAX_MS = 30_000
/** Attempts per model call for transient failures (network, 429, 5xx). */
const MODEL_CALL_RETRIES = 3
/** Max mid-run provider switches before the run fails for real. */
const MAX_PROVIDER_FAILOVERS = 2

// ─── Anthropic Settings ─────────────────────────────────────────────────────

const ANTHROPIC_THINKING_BUDGET = 4000

function supportsManualAnthropicThinking(modelId: string): boolean {
  const id = modelId.toLowerCase()
  return !/(claude-fable|claude-mythos|claude-opus-4-[78])/.test(id)
}

function sanitizeGeminiToolSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeGeminiToolSchema)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'additionalProperties')
      .map(([key, nested]) => [key, sanitizeGeminiToolSchema(nested)]),
  )
}

// ─── Circuit Breaker ────────────────────────────────────────────────────────

class CircuitBreaker {
  private state = new Map<
    string,
    { failures: number; lastFail: number; openUntil: number }
  >()

  /** Check if the circuit is open (requests should be blocked). */
  isOpen(providerId: string): boolean {
    const entry = this.state.get(providerId)
    if (!entry) return false
    if (entry.openUntil > Date.now()) return true
    // Cooldown expired — allow a trial request (half-open state)
    if (entry.failures >= CB_FAILURE_THRESHOLD) {
      this.state.delete(providerId)
    }
    return false
  }

  /** Record a successful request — reset the circuit. */
  recordSuccess(providerId: string): void {
    this.state.delete(providerId)
  }

  /** Record a failure. Opens the circuit if threshold is reached. */
  recordFailure(providerId: string): void {
    const entry = this.state.get(providerId) || {
      failures: 0,
      lastFail: 0,
      openUntil: 0,
    }
    entry.failures++
    entry.lastFail = Date.now()

    if (entry.failures >= CB_FAILURE_THRESHOLD) {
      entry.openUntil = Date.now() + CB_COOLDOWN_MS
    }

    this.state.set(providerId, entry)
  }

  /** Get a human-readable status for debugging. */
  getStatus(providerId: string): string {
    const entry = this.state.get(providerId)
    if (!entry) return 'healthy'
    if (entry.openUntil > Date.now()) return 'open'
    return entry.failures > 0 ? 'degraded' : 'healthy'
  }
}

// Global circuit breaker instance (lives for the session)
const circuitBreaker = new CircuitBreaker()

// ─── Exponential Backoff ────────────────────────────────────────────────────

/**
 * Compute delay with exponential backoff and jitter.
 * Formula: min(max, base * 2^attempt) ± jitter
 */
function backoffDelay(attempt: number): number {
  const exponential = BACKOFF_BASE_MS * Math.pow(2, attempt)
  const capped = Math.min(exponential, BACKOFF_MAX_MS)
  // Jitter: ±20%
  const jitter = capped * 0.2 * (Math.random() * 2 - 1)
  return Math.round(capped + jitter)
}

/** Sleep for a given duration in ms. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * HTTP statuses worth retrying: timeout, rate limit, and server errors
 * (including Anthropic's 529 "overloaded"). Auth and validation errors are not.
 */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status < 600)
}

/** Parse a Retry-After header (delta-seconds or HTTP date) into ms, capped. */
export function parseRetryAfter(header: string | null): number | null {
  if (!header) return null
  const secs = Number(header)
  if (Number.isFinite(secs) && secs >= 0) {
    return Math.min(secs * 1000, BACKOFF_MAX_MS)
  }
  const date = Date.parse(header)
  if (!Number.isNaN(date)) {
    return Math.min(Math.max(date - Date.now(), 0), BACKOFF_MAX_MS)
  }
  return null
}

// ─── Run Usage Accounting ───────────────────────────────────────────────────

export function emptyUsage(): RunUsage {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
}

export function addUsage(total: RunUsage, delta?: RunUsage): RunUsage {
  if (!delta) return total
  return {
    inputTokens: total.inputTokens + delta.inputTokens,
    outputTokens: total.outputTokens + delta.outputTokens,
    cacheReadTokens: total.cacheReadTokens + delta.cacheReadTokens,
    cacheWriteTokens: total.cacheWriteTokens + delta.cacheWriteTokens,
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('The agent run was cancelled.', 'AbortError')
  }
}

function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/^\/+/, '')
}

function normalizeLanguage(language: string, path: string): string {
  const lower = language.toLowerCase().trim()
  if (['tsx', 'ts', 'jsx', 'js', 'css', 'json'].includes(lower)) return lower
  if (path.endsWith('.tsx')) return 'tsx'
  if (path.endsWith('.ts')) return 'ts'
  if (path.endsWith('.jsx')) return 'jsx'
  if (path.endsWith('.js')) return 'js'
  if (path.endsWith('.css')) return 'css'
  if (path.endsWith('.json')) return 'json'
  return 'tsx'
}

function normalizeFiles(files: AgentCodeFile[]): AgentCodeFile[] {
  const byPath = new Map<string, AgentCodeFile>()
  for (const file of files) {
    const path = normalizePath(file.path)
    if (!path) continue
    const language = normalizeLanguage(file.language, path)
    byPath.set(path, { path, language, code: file.code.replace(/\r\n/g, '\n') })
  }
  return [...byPath.values()].sort((a, b) => {
    if (a.path === 'src/App.tsx') return -1
    if (b.path === 'src/App.tsx') return 1
    if (a.path === 'src/styles/theme.css') return 1
    if (b.path === 'src/styles/theme.css') return -1
    return a.path.localeCompare(b.path)
  })
}

function upsertFile(files: AgentCodeFile[], file: AgentCodeFile): AgentCodeFile[] {
  const normalized = normalizeFiles([file])[0]
  if (!normalized) return files
  const existing = files.findIndex((f) => f.path === normalized.path)
  if (existing >= 0) {
    const updated = [...files]
    updated[existing] = normalized
    return updated
  }
  return [...files, normalized]
}

// ─── Levenshtein Distance ──────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = new Array<number>(n + 1)
  let curr = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    const tmp = prev; prev = curr; curr = tmp
  }
  return prev[n]
}

function findSimilarFiles(targetPath: string, files: AgentCodeFile[], maxDistance = 3): string[] {
  return files
    .map((f) => ({ path: f.path, dist: levenshtein(targetPath, f.path) }))
    .filter((e) => e.dist > 0 && e.dist <= maxDistance)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)
    .map((e) => e.path)
}

// ─── Glob Matching ──────────────────────────────────────────────────────────

function matchesGlob(filePath: string, globPattern: string): boolean {
  let regexStr = '^'
  let i = 0
  while (i < globPattern.length) {
    if (globPattern[i] === '*' && globPattern[i + 1] === '*') {
      regexStr += '.*'; i += 2
    } else if (globPattern[i] === '*') {
      regexStr += '[^/]*'; i += 1
    } else if (globPattern[i] === '?') {
      regexStr += '[^/]'; i += 1
    } else {
      const ch = globPattern[i]
      if ('.+^${}()|[]\\'.includes(ch)) { regexStr += '\\' + ch } else { regexStr += ch }
      i += 1
    }
  }
  regexStr += '$'
  try { return new RegExp(regexStr).test(filePath) } catch { return false }
}

// ─── Line-Trimmed Fuzzy Matching (edit_file fallback) ───────────────────────

/**
 * Find a block of lines in `code` that matches `target` ignoring leading and
 * trailing whitespace on each line. This rescues edits from weaker models that
 * can't reproduce exact indentation — the #1 cause of wasted edit_file turns.
 *
 * Returns the matching line range [start, end] (inclusive, 0-based) when there
 * is EXACTLY one match. Returns null when there are zero or multiple matches
 * (ambiguous edits must stay strict).
 */
export function findLineTrimmedMatch(
  code: string,
  target: string,
): { start: number; end: number } | null {
  const codeLines = code.split('\n')
  let targetLines = target.split('\n')
  // Drop a single trailing empty line (old_string often ends with "\n").
  if (targetLines.length > 1 && targetLines[targetLines.length - 1] === '') {
    targetLines = targetLines.slice(0, -1)
  }
  if (targetLines.length === 0) return null

  const trimmedTarget = targetLines.map((l) => l.trim())
  // Refuse to fuzzy-match an all-whitespace block — it would match anywhere.
  if (trimmedTarget.every((l) => l === '')) return null

  const matches: { start: number; end: number }[] = []
  for (let i = 0; i + trimmedTarget.length <= codeLines.length; i++) {
    let ok = true
    for (let j = 0; j < trimmedTarget.length; j++) {
      if (codeLines[i + j].trim() !== trimmedTarget[j]) {
        ok = false
        break
      }
    }
    if (ok) {
      matches.push({ start: i, end: i + trimmedTarget.length - 1 })
      if (matches.length > 1) return null // ambiguous
    }
  }

  return matches.length === 1 ? matches[0] : null
}

type EditFailure =
  | 'EMPTY_OLD_STRING'
  | 'IDENTICAL_STRINGS'
  | 'MULTIPLE_MATCHES'
  | 'STRING_NOT_FOUND'

type EditOutcome =
  | { ok: true; code: string; fuzzy: boolean }
  | { ok: false; reason: EditFailure; count?: number }

/**
 * Apply a single exact-or-fuzzy string replacement to `code`. Shared by
 * edit_file and multi_edit so both behave identically.
 */
export function applySingleEdit(code: string, oldStr: string, newStr: string): EditOutcome {
  if (!oldStr) return { ok: false, reason: 'EMPTY_OLD_STRING' }
  if (oldStr === newStr) return { ok: false, reason: 'IDENTICAL_STRINGS' }

  const count = code.split(oldStr).length - 1
  if (count > 1) return { ok: false, reason: 'MULTIPLE_MATCHES', count }
  if (count === 1) return { ok: true, code: code.replace(oldStr, newStr), fuzzy: false }

  // Exact match failed — try whitespace-tolerant line matching.
  const range = findLineTrimmedMatch(code, oldStr)
  if (!range) return { ok: false, reason: 'STRING_NOT_FOUND' }
  const lines = code.split('\n')
  const rebuilt = [
    ...lines.slice(0, range.start),
    ...newStr.split('\n'),
    ...lines.slice(range.end + 1),
  ]
  return { ok: true, code: rebuilt.join('\n'), fuzzy: true }
}

/** Turn an edit failure into a structured, actionable error string. */
function describeEditFailure(
  reason: EditFailure,
  path: string,
  code: string,
  count?: number,
): string {
  switch (reason) {
    case 'EMPTY_OLD_STRING':
      return formatStructuredError({
        code: 'EMPTY_OLD_STRING', message: 'old_string must not be empty.',
        suggestion: 'Provide the exact text to replace, copied from the file.',
        retryable: true,
      })
    case 'IDENTICAL_STRINGS':
      return formatStructuredError({
        code: 'IDENTICAL_STRINGS', message: 'old_string and new_string are identical.',
        suggestion: 'The replacement must differ from the original.',
        retryable: true,
      })
    case 'MULTIPLE_MATCHES':
      return formatStructuredError({
        code: 'MULTIPLE_MATCHES',
        message: `old_string appears ${count ?? 'multiple'} times in ${path}. It must be unique.`,
        suggestion: 'Include more surrounding context lines to make it unique.',
        retryable: true,
      })
    case 'STRING_NOT_FOUND': {
      const firstLines = code.split('\n').slice(0, 5).join('\n')
      return formatStructuredError({
        code: 'STRING_NOT_FOUND',
        message: `old_string not found in ${path} (tried exact and whitespace-tolerant matching).`,
        suggestion: `Read the file again to copy the current text exactly. The file starts with:\n${firstLines}\n\nIf the section is large, use write_file to replace the whole file instead.`,
        retryable: true,
      })
    }
  }
}

// ─── Structured Error Formatting ────────────────────────────────────────────

function formatStructuredError(err: StructuredError): string {
  const parts: string[] = [`Error [${err.code}]: ${err.message}`]
  if (err.suggestion) parts.push(`Suggestion: ${err.suggestion}`)
  if (err.similarPaths && err.similarPaths.length > 0) {
    parts.push(`Similar files: ${err.similarPaths.join(', ')}`)
  }
  return parts.join('\n')
}

const BUILD_VERB_RE =
  /\b(add|build|change|create|delete|design|develop|fix|implement|improve|make|move|remove|replace|redesign|refactor|rename|update)\b/i

const CONTINUATION_RE =
  /^(continue|keep going|go on|resume|carry on|proceed|finish|finish it|finish this|keep working)$/

export function isContinuationRequest(prompt: string): boolean {
  return CONTINUATION_RE.test(
    prompt
      .toLowerCase()
      .replace(/[.!?]+/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

export function isLikelyBuildRequest(prompt: string): boolean {
  const cleaned = prompt.trim()
  if (!cleaned) return false
  if (isContinuationRequest(cleaned)) return true
  const lower = cleaned.toLowerCase()
  if (/^(what|who|where|when|why|how)\b/.test(lower)) return false
  if (/^(can|could|would)\s+you\s+(explain|tell|show|describe)\b/.test(lower)) return false
  return BUILD_VERB_RE.test(cleaned)
}

function normalizeRequirementForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(a|an|the|please|can|could|you|to|do|does|with|and)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function requirementExists(plan: AgentPlan, requirement: string): boolean {
  const target = normalizeRequirementForCompare(requirement)
  if (!target) return true
  return plan.items.some((item) => {
    const existing = normalizeRequirementForCompare(item.text)
    return existing === target || existing.includes(target) || target.includes(existing)
  })
}

export function mergePromptRequirementsIntoPlan(
  plan: AgentPlan,
  prompt: string,
  mode: 'create' | 'refine',
): AgentPlan {
  if (mode !== 'refine' || !isLikelyBuildRequest(prompt) || isContinuationRequest(prompt)) {
    return plan
  }

  const additions = extractRequirements(prompt).filter(
    (requirement) => !requirementExists(plan, requirement),
  )
  if (additions.length === 0) return plan

  return applyPlanUpdate(plan, { addRequirements: additions })
}

export function isSmallRefineRequest(prompt: string): boolean {
  const lower = prompt.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!lower || lower.length > 220) return false
  if (/\b(rebuild|redesign|rewrite|replace everything|from scratch|entire app|whole file)\b/.test(lower)) {
    return false
  }
  return /\b(add|change|fix|improve|move|remove|replace|update)\b/.test(lower)
}

export function shouldRejectWholeFileRewrite(params: {
  mode: 'create' | 'refine'
  prompt: string
  existingCode: string
  newCode: string
  alreadyRejected: boolean
}): boolean {
  if (params.mode !== 'refine' || params.alreadyRejected) return false
  if (!isSmallRefineRequest(params.prompt)) return false

  const existingLines = params.existingCode.split('\n').length
  const newLines = params.newCode.split('\n').length
  if (existingLines < 160 || newLines < 120) return false

  return newLines >= existingLines * 0.65
}

// ─── Context Compaction ─────────────────────────────────────────────────────

function compactMessages(
  messages: LlmMessage[],
  turnCount: number,
): { messages: LlmMessage[]; compacted: boolean } {
  if (turnCount <= COMPACTION_THRESHOLD) {
    return { messages, compacted: false }
  }

  const assistantIndices: number[] = []
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'assistant') assistantIndices.push(i)
  }

  const totalTurns = assistantIndices.length
  if (totalTurns <= KEEP_RECENT_TURNS + 1) {
    return { messages, compacted: false }
  }

  const compactUpTo = totalTurns - KEEP_RECENT_TURNS
  let compacted = false

  for (let t = 0; t < compactUpTo; t++) {
    const asstIdx = assistantIndices[t]
    const toolResultIdx = asstIdx + 1

    if (
      toolResultIdx < messages.length &&
      messages[toolResultIdx].role === 'user' &&
      Array.isArray(messages[toolResultIdx].content)
    ) {
      const blocks = messages[toolResultIdx].content as LlmContentBlock[]
      const newBlocks = blocks.map((block) => {
        if (block.type !== 'tool_result') return block
        let toolName = ''
        if (Array.isArray(messages[asstIdx].content)) {
          const matching = (messages[asstIdx].content as LlmContentBlock[]).find(
            (b) => b.type === 'tool_use' && b.id === block.tool_use_id,
          )
          if (matching) toolName = matching.name ?? ''
        }
        if (OBSERVATION_TOOLS.has(toolName)) {
          compacted = true
          return {
            ...block,
            content: '[tool output truncated — current file state is tracked in the workspace]',
          }
        }
        return block
      })
      messages[toolResultIdx] = { role: 'user', content: newBlocks }
    }
  }

  return { messages, compacted }
}

function generateProgressSummary(
  messages: LlmMessage[],
  currentFiles: AgentCodeFile[],
  turnCount: number,
): string {
  const fileCreations: string[] = []
  const fileEdits: string[] = []

  for (const msg of messages) {
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'tool_use') {
          if (block.name === 'write_file' && block.input?.path) {
            fileCreations.push(String(block.input.path))
          } else if (block.name === 'edit_file' && block.input?.path) {
            fileEdits.push(String(block.input.path))
          }
        }
      }
    }
  }

  const dedupe = (arr: string[]) => [...new Set(arr)]
  const parts: string[] = [
    COMPACTION_PROMPT,
    '',
    '## Progress Summary',
    `- **Turns executed:** ${turnCount}`,
    `- **Files in project:** ${currentFiles.length}`,
  ]

  const created = dedupe(fileCreations)
  if (created.length > 0) parts.push(`- **Files created:** ${created.join(', ')}`)
  const edited = dedupe(fileEdits)
  if (edited.length > 0) parts.push(`- **Files edited:** ${edited.join(', ')}`)

  parts.push('', 'Continue from where you left off. Current file state is accurate.')
  return parts.join('\n')
}

// ─── Loop / Stuck Detection (#9) ────────────────────────────────────────────

/**
 * Detects when the agent is repeating the same action or hitting the same
 * error turn after turn, so the loop can inject a corrective nudge instead of
 * burning turns. Conservative: only fires on genuine repetition.
 */
class LoopDetector {
  private actions: string[] = []
  private errors: string[] = []
  private lastNudgeTurn = 0

  /** Fingerprint of a tool call: name + a hash of its key inputs. */
  private fingerprint(name: string, input: Record<string, unknown>): string {
    // read_file: track by path only — different offset/limit is still the same file
    if (name === 'read_file') return `${name}:${String(input.path ?? '')}`
    const key = name === 'edit_file' || name === 'multi_edit' || name === 'write_file'
      ? String(input.path ?? '') + '|' + String(input.old_string ?? '').slice(0, 80)
      : JSON.stringify(input).slice(0, 120)
    return `${name}:${key}`
  }

  /**
   * Record this turn's tool calls and error results. Returns a nudge string if
   * the agent appears stuck, else null. `turn` guards against nudging twice in
   * quick succession.
   *
   * Only FAILING calls count toward the repeated-action check: a healthy
   * edit → compile → edit → compile rhythm repeats `compile` (whose input is
   * always `{}`) many times legitimately, and that must never read as a loop.
   */
  record(
    turn: number,
    calls: { name: string; input: Record<string, unknown>; isError: boolean }[],
    errorMessages: string[],
  ): string | null {
    for (const c of calls) {
      if (c.isError) this.actions.push(this.fingerprint(c.name, c.input))
    }
    for (const e of errorMessages) this.errors.push(e.slice(0, 120))
    this.actions = this.actions.slice(-8)
    this.errors = this.errors.slice(-6)

    if (turn - this.lastNudgeTurn < 2) return null

    // Same exact action 3+ times in the recent window.
    const counts = new Map<string, number>()
    for (const a of this.actions) counts.set(a, (counts.get(a) ?? 0) + 1)
    const repeatedAction = [...counts.entries()].find(([, n]) => n >= 3)
    if (repeatedAction) {
      this.lastNudgeTurn = turn
      return `You have repeated the same failing action (${repeatedAction[0].split(':')[0]}) ${repeatedAction[1]} times without progress.`
    }

    // Same error message 3+ times.
    const errCounts = new Map<string, number>()
    for (const e of this.errors) errCounts.set(e, (errCounts.get(e) ?? 0) + 1)
    const repeatedError = [...errCounts.entries()].find(([, n]) => n >= 3)
    if (repeatedError) {
      this.lastNudgeTurn = turn
      return `The same error keeps occurring: "${repeatedError[0]}".`
    }

    return null
  }
}

// ─── Main Agent Loop ────────────────────────────────────────────────────────

export async function runOpenThornAgent(input: AgentRunInput): Promise<AgentRunResult> {
  const sessionId = generateSessionId()

  // ── Resolve provider with fallback ────────────────────────────
  let provider = await resolveProviderWithFallback(
    input.userId,
    input.selectedModel ?? null,
  )
  let providerName =
    provider.key.provider_name ||
    input.selectedModel?.provider_name ||
    provider.key.provider_id
  let modelName =
    input.selectedModel?.model_name || provider.model.name || provider.model.id

  input.onProgress?.({
    type: 'status',
    message: `Connected to ${providerName} / ${modelName}`,
  })

  // ── Load memory (lessons + changelog) ─────────────────────────
  const memoryContext = await loadMemoryContext(input.userId, input.files)
  if (memoryContext) {
    input.onProgress?.({ type: 'status', message: 'Loaded agent memory.' })
  }

  // ── Cross-project user memory (#8) ────────────────────────────
  // Reinforce durable preferences inferred from this prompt, then load the
  // user's accumulated memory for injection.
  for (const fact of inferPreferencesFromPrompt(input.prompt)) {
    rememberForUser(input.userId, 'preference', fact)
  }
  const userMemoryReminder = userMemoryToSystemReminder(loadUserMemory(input.userId))

  // ── Custom instructions (user knowledge) ─────────────────────
  const { data: profileData } = await supabase
    .from('profiles')
    .select('custom_instructions')
    .eq('id', input.userId)
    .single()
  const customInstructions = (profileData as { custom_instructions: string | null } | null)?.custom_instructions?.trim() ?? ''

  // ── Resolve active skills from prompt ────────────────────────
  const activeSkills = resolveActiveSkills(input.prompt)
  if (activeSkills.length > 0) {
    input.onProgress?.({
      type: 'status',
      message: `Activated skills: ${activeSkills.map((s) => s.id).join(', ')}`,
    })
  }

  const isNewProject =
    input.files.length === 0 || input.files[0].path === 'No files yet'
  const mode = input.mode ?? 'create'
  const buildIntent = isLikelyBuildRequest(input.prompt)
  const thinkingLevel = normalizeThinkingLevel(input.thinkingLevel)
  const thinkingProfile = AGENT_THINKING_PROFILES[thinkingLevel]

  // ── Build initial messages ────────────────────────────────────
  const messages: LlmMessage[] = []

  // Inject skill blocks (preserves cache)
  for (const skill of activeSkills) {
    messages.push({ role: 'user', content: skill.body })
  }

  // Inject memory context (lessons + failed approaches)
  if (memoryContext) {
    messages.push({ role: 'user', content: memoryContext })
  }

  // Inject cross-project user memory (preferences / known fixes)
  if (userMemoryReminder) {
    messages.push({ role: 'user', content: userMemoryReminder })
  }

  // Inject user's custom knowledge/instructions
  if (customInstructions) {
    messages.push({
      role: 'user',
      content: `<user-knowledge>\nThe user has set the following custom instructions that apply to every project. Follow them unless they conflict with explicit instructions in the current request:\n\n${customInstructions}\n</user-knowledge>`,
    })
  }

  messages.push({ role: 'user', content: buildThinkingLevelPrompt(thinkingLevel) })

  // SPEC PHASE: for new projects, inject spec guidance
  if (isNewProject || mode === 'create') {
    messages.push({ role: 'user', content: SPEC_PHASE_PROMPT })
  }

  let currentFiles = normalizeFiles(input.files)

  // ── Plan + requirements checklist (#5) ────────────────────────
  // Seed PLAN.md from the request so the agent's plan survives compaction and
  // the done gate can verify requirement coverage. PLAN.md is the source of
  // truth; the update_plan tool mutates it.
  const existingPlanFile = currentFiles.find((f) => f.path === PLAN_PATH)
  const parsedPlan: AgentPlan = existingPlanFile
    ? parsePlan(existingPlanFile.code)
    : createPlan(input.prompt)
  const basePlan = parsedPlan.items.length > 0 ? parsedPlan : createPlan(input.prompt)
  const initialPlan = mergePromptRequirementsIntoPlan(basePlan, input.prompt, mode)
  const initialPlanCode = formatPlan(initialPlan)
  if (!existingPlanFile || existingPlanFile.code !== initialPlanCode) {
    currentFiles = upsertFile(currentFiles, {
      path: PLAN_PATH,
      language: 'md',
      code: initialPlanCode,
    })
  }
  const planReminder = planToSystemReminder(initialPlan)
  if (planReminder) {
    messages.push({ role: 'user', content: planReminder })
  }

  // Main user prompt
  messages.push({
    role: 'user',
    content: buildUserPrompt(
      input.prompt,
      input.title,
      input.files,
      mode,
      isNewProject,
    ),
  })

  let turnCount = 0
  let lastSummaryTurn = 0
  let totalUsage = emptyUsage()
  // Mid-run failover state: providers that already failed this run are never
  // retried, and the run only switches providers a bounded number of times.
  const failedProviderIds = new Set<string>()
  let failovers = 0
  let consecutiveEmptyTurns = 0

  const loopDetector = new LoopDetector()
  // Per-run state for tool execution: tracks reads (to short-circuit redundant
  // re-reads of unchanged files) and the mode (to ignore set_title on refine).
  const runCtx: RunContext = {
    mode,
    goal: input.prompt,
    turn: 0,
    reads: new Map(),
    mutatedPaths: new Set(),
    rewriteGuardedPaths: new Set(),
    // done requires at least one passing compile per run, even on refine runs
    // where the agent makes no file changes — verification before completion.
    dirtySinceCompile: true,
    lastCompileOk: false,
    doneRejections: 0,
  }

  // Track session details for changelog
  const sessionFilesCreated: string[] = []
  const sessionFilesEdited: string[] = []
  // Whether any file-mutating tool ran this run. Gates the text-only early
  // return: a conversational run may end without done, a build may not.
  let filesMutatedThisRun = false

  // Tool execution loop
  while (turnCount < (input.maxTurns ?? thinkingProfile.maxTurns ?? MAX_TOOL_TURNS)) {
    throwIfAborted(input.signal)
    turnCount++

    // ── Compaction ──────────────────────────────────────────────
    const compactResult = compactMessages(messages, turnCount)
    if (compactResult.compacted) {
      if (turnCount - lastSummaryTurn >= SUMMARY_INTERVAL) {
        const summary = generateProgressSummary(messages, currentFiles, turnCount)
        messages.push({ role: 'user', content: summary })
        lastSummaryTurn = turnCount
      }
      input.onProgress?.({ type: 'compaction', message: 'Context compacted to save tokens.' })
    }

    // ── Adaptive thinking budget ────────────────────────────────
    const thinkingBudget = getThinkingBudget({ mode, turnCount, thinkingLevel })

    // ── Call the model (with mid-run provider failover) ─────────
    // Each call already retries transient failures internally. If a provider
    // still fails, switch to the next healthy one instead of killing the run.
    let modelResult: ModelCallResult
    try {
      // The model is now generating — without this the UI would keep showing
      // the previous (long-finished) tool as the current step for the entire
      // stream, e.g. "Reading X" while a large write_file is being generated.
      input.onProgress?.({ type: 'generating' })
      modelResult = await callModelWithTools({
        providerId: provider.key.provider_id,
        baseUrl: provider.baseUrl,
        apiKey: provider.key.api_key,
        modelId: provider.model.id,
        system: AGENT_SYSTEM_PROMPT,
        tools: AGENT_TOOLS,
        messages,
        signal: input.signal,
        onText: (chunk) => {
          input.onProgress?.({ type: 'text', text: chunk })
        },
        onToolStream: createToolStreamProgressEmitter(input.onProgress),
        thinkingBudget,
      })
      circuitBreaker.recordSuccess(provider.key.provider_id)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      circuitBreaker.recordFailure(provider.key.provider_id)
      failedProviderIds.add(provider.key.provider_id)
      if (failovers >= MAX_PROVIDER_FAILOVERS) throw err
      let next: ResolvedProvider
      try {
        next = await resolveProviderWithFallback(input.userId, null, failedProviderIds)
      } catch {
        throw err // no fallback available — surface the original failure
      }
      failovers++
      provider = next
      providerName = next.key.provider_name || next.key.provider_id
      modelName = next.model.name || next.model.id
      const errMsg = err instanceof Error ? err.message : String(err)
      input.onProgress?.({
        type: 'status',
        message: `Provider failed (${errMsg}) — switched to ${providerName} / ${modelName}.`,
      })
      turnCount-- // the failed call did not consume a turn
      continue
    }
    const { text, toolCalls, thinkingBlocks, usage, invalidCalls } = modelResult

    if (usage) {
      totalUsage = addUsage(totalUsage, usage)
      input.onProgress?.({ type: 'usage', usage: totalUsage })
    }

    // ── Build assistant message ─────────────────────────────────
    const assistantBlocks: LlmContentBlock[] = []
    // Anthropic thinking blocks must lead and be replayed verbatim next turn.
    for (const tb of thinkingBlocks ?? []) {
      assistantBlocks.push({ type: 'thinking', thinking: tb.thinking, signature: tb.signature })
    }
    if (text) assistantBlocks.push({ type: 'text', text })
    for (const tc of toolCalls) {
      assistantBlocks.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.name,
        input: tc.input,
        thoughtSignature: tc.thoughtSignature,
      })
    }

    // Malformed tool calls still need their tool_use block in the transcript
    // so the error result we push below has something to reference.
    for (const inv of invalidCalls ?? []) {
      assistantBlocks.push({ type: 'tool_use', id: inv.id, name: inv.name, input: {} })
    }

    if (assistantBlocks.length > 0) {
      const assistantMsg: LlmMessage = { role: 'assistant', content: assistantBlocks }
      if (modelResult.reasoningContent) assistantMsg.reasoningContent = modelResult.reasoningContent
      messages.push(assistantMsg)
      consecutiveEmptyTurns = 0
    } else {
      // Empty response — nudge once (providers hiccup), stop on a repeat.
      consecutiveEmptyTurns++
      if (consecutiveEmptyTurns >= 2) break
      messages.push({
        role: 'user',
        content:
          'Your last response was empty — no text and no tool calls. Continue the task with the next tool call, or call done if the project is compiled, verified, and complete.',
      })
      continue
    }

    // ── Conversational reply (text only, no tool calls) ─────────
    // Greetings and questions ("hey", "what is this app?") are answered in
    // plain text per the system prompt — ending the response without tool
    // calls ends the run. But if files were already modified this run, the
    // agent must still land a verified done, so nudge it onward instead.
    if (toolCalls.length === 0 && (invalidCalls?.length ?? 0) === 0 && text) {
      if (!filesMutatedThisRun && !buildIntent) {
        circuitBreaker.recordSuccess(provider.key.provider_id)
        input.onProgress?.({ type: 'done', files: currentFiles, filesMutated: false })
        return { files: currentFiles, turns: turnCount, providerName, modelName, usage: totalUsage, filesMutated: false }
      }
      messages.push({
        role: 'user',
        content: filesMutatedThisRun
          ? 'You modified files this run but ended your response without any tool call. Continue: compile to verify the current files, finish any remaining plan items, then call done.'
          : 'This is a build/refine request, but you stopped after reading or planning. Continue with the next concrete tool action now: use edit_file or multi_edit for the requested change, then compile and call done.',
      })
      continue
    }

    // ── Execute tools with parallelism ──────────────────────────
    runCtx.turn = turnCount
    const toolResults = await executeToolsParallel(
      toolCalls,
      currentFiles,
      input.signal,
      input.onProgress,
      provider,
      runCtx,
    )

    // Track file operations for changelog
    let filesMutatedThisTurn = false
    for (let i = 0; i < toolCalls.length; i++) {
      const tc = toolCalls[i]
      if (tc.name === 'write_file' && tc.input?.path) {
        const path = String(tc.input.path)
        if (!sessionFilesCreated.includes(path)) sessionFilesCreated.push(path)
      }
      if (tc.name === 'edit_file' && tc.input?.path) {
        const path = String(tc.input.path)
        if (!sessionFilesEdited.includes(path)) sessionFilesEdited.push(path)
      }
      if (
        ['write_file', 'edit_file', 'multi_edit', 'delete_file'].includes(tc.name) &&
        !toolResults[i]?.isError
      ) {
        filesMutatedThisRun = true
        filesMutatedThisTurn = true
      }
    }

    // ── Push tool results ───────────────────────────────────────
    let hasDone = false
    let doneResult: ToolResult | null = null
    let doneCallId: string | null = null
    for (let i = 0; i < toolResults.length; i++) {
      const tc = toolCalls[i]
      const result = toolResults[i]
      if (result.files) currentFiles = result.files

      // done only finishes the run when it passed the verification gate.
      // A rejected done (isError) falls through and is pushed as a normal
      // tool result so the agent sees the rejection reason and keeps working.
      if (tc.name === 'done' && !result.isError) {
        hasDone = true
        doneResult = result
        doneCallId = tc.id
        continue
      }
      if (tc.name === 'done' && result.isError) {
        input.onProgress?.({
          type: 'status',
          message: 'Verification gate rejected done — continuing until the app is verified.',
        })
      }

      messages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: tc.id,
            content: result.content,
            is_error: result.isError,
          },
        ],
      })
    }

    // Surface mutated files to the UI every turn — not only at done — so
    // partial progress is persisted and a page reload can resume from it
    // instead of restarting the build from the pre-run snapshot. Skipped when
    // this turn lands done: the 'done' event below carries the same files.
    if (filesMutatedThisTurn && !hasDone) {
      input.onProgress?.({ type: 'files', files: currentFiles, filesMutated: true })
    }

    // Malformed tool calls get an explicit error result so the model re-issues
    // them with valid JSON instead of wondering why nothing happened.
    for (const inv of invalidCalls ?? []) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: inv.id,
            content: formatStructuredError({
              code: 'MALFORMED_TOOL_ARGS',
              message: `The arguments for your ${inv.name} call were not valid JSON and could not be parsed.`,
              suggestion: `Re-issue the ${inv.name} call with well-formed JSON arguments. The raw arguments started with: ${inv.raw.slice(0, 200)}`,
              retryable: true,
            }),
            is_error: true,
          },
        ],
      })
    }

    // ── Plan re-injection (#5) ──────────────────────────────────
    // If the agent updated the plan this turn, surface the fresh checklist so
    // it stays salient even after compaction.
    if (toolCalls.some((tc) => tc.name === 'update_plan')) {
      const planFile = currentFiles.find((f) => f.path === PLAN_PATH)
      if (planFile) {
        const reminder = planToSystemReminder(parsePlan(planFile.code))
        if (reminder) messages.push({ role: 'user', content: reminder })
      }
    }

    // ── Loop / stuck detection (#9) ─────────────────────────────
    const turnErrors = toolResults.filter((r) => r.isError).map((r) => r.content)
    const nudge = loopDetector.record(
      turnCount,
      toolCalls.map((tc, i) => ({
        name: tc.name,
        input: tc.input,
        isError: toolResults[i]?.isError ?? false,
      })),
      turnErrors,
    )
    if (nudge) {
      input.onProgress?.({ type: 'status', message: 'Detected a stuck loop — nudging a new approach.' })
      messages.push({ role: 'user', content: loopBreakPrompt(nudge) })
    }

    // ── Turn-budget warning ─────────────────────────────────────
    // Warn as the cap approaches so the agent lands the build (compile + done)
    // instead of dying mid-task when turns run out.
    const turnsLeft =
      (input.maxTurns ?? thinkingProfile.maxTurns ?? MAX_TOOL_TURNS) - turnCount
    if (!hasDone && (turnsLeft === 6 || turnsLeft === 3)) {
      messages.push({ role: 'user', content: turnBudgetPrompt(turnsLeft) })
    }

    if (hasDone && doneResult) {
      // Push the final done result
      messages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: doneCallId ?? 'done',
            content: doneResult.content,
            is_error: false,
          },
        ],
      })

      // ── Write changelog entry ──────────────────────────────────
      // Into currentFiles — input.files is the pre-run snapshot and is
      // discarded by the caller, which persists the returned files.
      await saveSessionChangelog(input.userId, currentFiles, {
        sessionId,
        prompt: input.prompt,
        filesCreated: sessionFilesCreated,
        filesEdited: sessionFilesEdited,
        approaches: [],
        lessons: [],
      })

      // Persist a durable cross-project fact about what was built (#8).
      if (mode === 'create') {
        rememberForUser(input.userId, 'fact', `Built: ${input.title || input.prompt.slice(0, 60)}`)
      }

      // Record success on the circuit breaker
      circuitBreaker.recordSuccess(provider.key.provider_id)
      input.onProgress?.({ type: 'done', files: currentFiles, filesMutated: filesMutatedThisRun })
      return { files: currentFiles, turns: turnCount, providerName, modelName, usage: totalUsage, filesMutated: filesMutatedThisRun }
    }
  }

  // ── Max turns reached — write changelog anyway ─────────────────
  await saveSessionChangelog(input.userId, currentFiles, {
    sessionId,
    prompt: input.prompt,
    filesCreated: sessionFilesCreated,
    filesEdited: sessionFilesEdited,
    approaches: [],
    lessons: [],
  })

  circuitBreaker.recordSuccess(provider.key.provider_id)
  input.onProgress?.({ type: 'done', files: currentFiles, filesMutated: filesMutatedThisRun })
  return { files: currentFiles, turns: turnCount, providerName, modelName, usage: totalUsage, filesMutated: filesMutatedThisRun }
}

// ─── Memory Management ──────────────────────────────────────────────────────

/**
 * Load lessons and changelog from the virtual project files.
 * Returns a combined <system-reminder> string or empty string.
 */
async function loadMemoryContext(
  userId: string,
  files: AgentCodeFile[],
): Promise<string> {
  const parts: string[] = []

  // Load lessons
  const lessonsFile = files.find((f) => f.path === 'src/lib/lessons.md')
  if (lessonsFile) {
    const entries = parseLessons(lessonsFile.code)
    const reminder = lessonsToSystemReminder(entries)
    if (reminder) parts.push(reminder)
  }

  // Load changelog (failed approaches only)
  const changelogFile = files.find((f) => f.path === 'src/lib/CHANGELOG.md')
  if (changelogFile) {
    const entries = parseChangelog(changelogFile.code)
    const reminder = changelogToSystemReminder(entries)
    if (reminder) parts.push(reminder)
  }

  void userId // Keep for future use (per-user memory storage)

  return parts.join('\n\n')
}

/**
 * Save a session changelog entry to the virtual project.
 */
async function saveSessionChangelog(
  _userId: string,
  files: AgentCodeFile[],
  params: {
    sessionId: string
    prompt: string
    filesCreated: string[]
    filesEdited: string[]
    approaches: ChangelogEntry['approaches']
    lessons: string[]
  },
): Promise<void> {
  // Load existing changelog
  const changelogFile = files.find((f) => f.path === 'src/lib/CHANGELOG.md')
  const existing = changelogFile
    ? parseChangelog(changelogFile.code)
    : []

  const entry = createChangelogEntry(params)
  existing.push(entry)

  // Keep only last 20 entries to prevent bloat
  const trimmed = existing.slice(-20)
  const formatted = formatChangelog(trimmed)

  // Update or create the changelog file
  if (changelogFile) {
    changelogFile.code = formatted
  } else {
    files.push({
      path: 'src/lib/CHANGELOG.md',
      language: 'md',
      code: formatted,
    })
  }
}

// ─── Public Memory API (called from UI after user corrections) ──────────────

/**
 * Record a lesson learned. Call this after the user corrects the agent.
 */
export function recordLesson(
  files: AgentCodeFile[],
  type: LessonEntry['type'],
  content: string,
): AgentCodeFile[] {
  const lessonsFile = files.find((f) => f.path === 'src/lib/lessons.md')
  const existing = lessonsFile ? parseLessons(lessonsFile.code) : []
  const updated = addLesson(existing, type, content)
  const formatted = formatLessons(updated)

  if (lessonsFile) {
    return files.map((f) =>
      f.path === 'src/lib/lessons.md' ? { ...f, code: formatted } : f,
    )
  }

  return [
    ...files,
    { path: 'src/lib/lessons.md', language: 'md', code: formatted },
  ]
}

// ─── Parallel Tool Execution ────────────────────────────────────────────────

/** Per-run state shared with executeTool across the whole agent run. */
interface RunContext {
  mode: 'create' | 'refine'
  /** Original user request for this run; used by verification/review gates. */
  goal: string
  /** The current turn number (updated each loop iteration). */
  turn: number
  /** path|offset|limit → snapshot + turn it was last served, to skip re-reads. */
  reads: Map<string, { snap: string; turn: number }>
  /** Project files changed during this run, excluding PLAN.md bookkeeping. */
  mutatedPaths: Set<string>
  /** Long existing files where write_file was already rejected once this run. */
  rewriteGuardedPaths: Set<string>
  /** True when project files changed since the last passing compile. */
  dirtySinceCompile: boolean
  /** Whether any compile this run passed build + runtime. */
  lastCompileOk: boolean
  /** How many times the done verification gate has rejected done this run. */
  doneRejections: number
  /** File fingerprint for the latest passing visual review. */
  visualReviewHash?: string
}

async function executeToolsParallel(
  toolCalls: ToolCall[],
  currentFiles: AgentCodeFile[],
  signal: AbortSignal | undefined,
  onProgress: ((event: AgentProgressEvent) => void) | undefined,
  provider: ResolvedProvider,
  runCtx: RunContext,
): Promise<ToolResult[]> {
  if (toolCalls.length === 0) return []

  const reads: { index: number; call: ToolCall }[] = []
  const writes: { index: number; call: ToolCall }[] = []
  // Arrays, not single slots: if the model issues duplicate compile/done calls
  // in one turn, every call must still produce a result. Dropping one would
  // misalign results with toolCalls and leave a tool_use without a tool_result.
  const compileCalls: { index: number; call: ToolCall }[] = []
  const doneCalls: { index: number; call: ToolCall }[] = []

  for (let i = 0; i < toolCalls.length; i++) {
    const tc = toolCalls[i]
    const category = TOOL_CATEGORIES[tc.name] ?? 'read'
    switch (category) {
      case 'read': reads.push({ index: i, call: tc }); break
      case 'write': writes.push({ index: i, call: tc }); break
      case 'compile': compileCalls.push({ index: i, call: tc }); break
      case 'done': doneCalls.push({ index: i, call: tc }); break
    }
  }

  const results: (ToolResult | null)[] = new Array(toolCalls.length).fill(null)

  // Phase 1: Execute reads in parallel
  const parallelTasks = [...reads]
  if (parallelTasks.length > 0) {
    const parallelResults = await Promise.all(
      parallelTasks.map(({ index, call }) => {
        onProgress?.({ type: 'tool_start', toolName: call.name, toolInput: call.input })
        return executeTool(call, currentFiles, signal, provider, onProgress, runCtx).then((result) => {
          onProgress?.({ type: 'tool_result', toolName: call.name, toolInput: call.input, toolResult: result.content, toolError: result.isError, files: result.files })
          return { index, result }
        })
      }),
    )
    for (const { index, result } of parallelResults) {
      results[index] = result
      if (result.files) currentFiles = result.files
    }
  }

  // Phase 2: Writes sequentially
  for (const { index, call } of writes) {
    onProgress?.({ type: 'tool_start', toolName: call.name, toolInput: call.input })
    const result = await executeTool(call, currentFiles, signal, provider, onProgress, runCtx)
    onProgress?.({ type: 'tool_result', toolName: call.name, toolInput: call.input, toolResult: result.content, toolError: result.isError, files: result.files })
    results[index] = result
    if (result.files) {
      currentFiles = result.files
      // Source changed → the last compile no longer vouches for the project.
      // PLAN.md updates don't affect the build, so they don't dirty it.
      if (!result.isError && call.name !== 'update_plan') {
        runCtx.dirtySinceCompile = true
        if (call.input?.path) runCtx.mutatedPaths.add(normalizePath(String(call.input.path)))
      }
    }
  }

  // Phase 3: Compile, Phase 4: Done — sequentially, in call order
  for (const { index, call } of [...compileCalls, ...doneCalls]) {
    onProgress?.({ type: 'tool_start', toolName: call.name, toolInput: call.input })
    const result = await executeTool(call, currentFiles, signal, provider, onProgress, runCtx)
    onProgress?.({ type: 'tool_result', toolName: call.name, toolInput: call.input, toolResult: result.content, toolError: result.isError, files: result.files })
    results[index] = result
    if (result.files) currentFiles = result.files
  }

  return results.filter((r): r is ToolResult => r !== null)
}

// ─── Tool Execution ─────────────────────────────────────────────────────────

async function executeTool(
  toolCall: ToolCall,
  currentFiles: AgentCodeFile[],
  signal: AbortSignal | undefined,
  provider: ResolvedProvider,
  onProgress?: (event: AgentProgressEvent) => void,
  runCtx?: RunContext,
): Promise<ToolResult> {
  throwIfAborted(signal)

  switch (toolCall.name) {
    // ── think ──────────────────────────────────────────────────
    case 'think': {
      return { content: String(toolCall.input.thought ?? ''), isError: false }
    }

    // ── update_plan ─────────────────────────────────────────────
    case 'update_plan': {
      const planFile = currentFiles.find((f) => f.path === PLAN_PATH)
      const plan = planFile ? parsePlan(planFile.code) : { goal: '', items: [], notes: '' }

      const asStringArray = (v: unknown): string[] | undefined =>
        Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined
      const asNumberArray = (v: unknown): number[] | undefined =>
        Array.isArray(v) ? v.map(Number).filter((n) => Number.isFinite(n)) : undefined

      const update: PlanUpdate = {
        goal: typeof toolCall.input.goal === 'string' ? toolCall.input.goal : undefined,
        setRequirements: asStringArray(toolCall.input.set_requirements),
        addRequirements: asStringArray(toolCall.input.add_requirements),
        check: asNumberArray(toolCall.input.check),
        uncheck: asNumberArray(toolCall.input.uncheck),
        notes: typeof toolCall.input.notes === 'string' ? toolCall.input.notes : undefined,
      }

      const nextPlan = applyPlanUpdate(plan, update)
      const newFiles = upsertFile(currentFiles, {
        path: PLAN_PATH,
        language: 'md',
        code: formatPlan(nextPlan),
      })
      const remaining = unmetRequirements(nextPlan).length
      const emptyHint =
        nextPlan.items.length === 0
          ? '\nThe checklist is EMPTY. Call update_plan again with set_requirements listing the concrete, checkable features you are building — done is verified against this list.'
          : ''
      return {
        content:
          `Plan updated. ${nextPlan.items.length} requirement(s), ${remaining} still unchecked.${emptyHint}\n` +
          nextPlan.items
            .map((it) => `  [${it.done ? 'x' : ' '}] ${it.id}. ${it.text}`)
            .join('\n'),
        isError: false,
        files: newFiles,
      }
    }

    // ── list_files ──────────────────────────────────────────────
    case 'list_files': {
      if (currentFiles.length === 0) {
        return { content: 'No files in the project yet.', isError: false }
      }
      const sorted = [...currentFiles].sort((a, b) => a.path.localeCompare(b.path))
      const truncated = sorted.length > LIST_FILES_MAX
      const shown = truncated ? sorted.slice(0, LIST_FILES_MAX) : sorted
      const listing = shown
        .map((f) => `  ${f.path}  (${f.language}, ${f.code.split('\n').length} lines)`)
        .join('\n')
      return {
        content: `${currentFiles.length} files${truncated ? ` (showing first ${LIST_FILES_MAX})` : ''}:\n${listing}${truncated ? `\n... and ${currentFiles.length - LIST_FILES_MAX} more. Use search_files or read specific paths.` : ''}`,
        isError: false,
      }
    }

    // ── read_file ───────────────────────────────────────────────
    case 'read_file': {
      const path = normalizePath(String(toolCall.input.path ?? ''))
      const offset = Math.max(1, Number(toolCall.input.offset) || 1)
      const limit = Number(toolCall.input.limit) || READ_TRUNCATE_LINES
      const file = currentFiles.find((f) => f.path === path)
      if (!file) {
        const similar = findSimilarFiles(path, currentFiles)
        return {
          content: formatStructuredError({
            code: 'FILE_NOT_FOUND',
            message: `File not found: ${path}`,
            suggestion: 'Use list_files to see all project files. Check the path spelling.',
            retryable: true,
            similarPaths: similar.length > 0 ? similar : undefined,
          }),
          isError: true,
        }
      }
      // Short-circuit a redundant re-read: same path+range, unchanged content,
      // read within the last couple of turns (so the earlier output is still in
      // context, not yet compacted away). Saves tokens and breaks read loops.
      const snap = `${file.code.length}:${file.code.slice(0, 80)}`
      if (runCtx) {
        const key = `${path}|${offset}|${limit}`
        const prev = runCtx.reads.get(key)
        if (prev && prev.snap === snap && runCtx.turn - prev.turn <= 2) {
          return {
            content:
              `You already read ${path} a moment ago and it has not changed since. ` +
              `Its content is still shown above — do not read it again. Make your edit now ` +
              `(or use search_files to jump to a specific section).`,
            isError: false,
          }
        }
        runCtx.reads.set(key, { snap, turn: runCtx.turn })
      }

      const allLines = file.code.split('\n')
      const startIdx = offset - 1
      const endIdx = Math.min(startIdx + limit, allLines.length)
      const selected = allLines.slice(startIdx, endIdx)
      const numbered = selected
        .map((line, i) => `${String(startIdx + i + 1).padStart(4, ' ')}  ${line}`)
        .join('\n')

      let result = `File: ${path} (${allLines.length} lines total)`
      if (startIdx > 0 || endIdx < allLines.length) {
        result += `, showing lines ${startIdx + 1}-${endIdx}`
      }
      if (startIdx > 0) result += `\n[... ${startIdx} lines before ...]`
      result += `\n${numbered}`
      if (endIdx < allLines.length) {
        result += `\n[... ${allLines.length - endIdx} lines after ...]`
        result += `\n[Tip: Use offset=${endIdx + 1} to read the next ${limit} lines]`
      }
      return { content: result, isError: false }
    }

    // ── search_files ────────────────────────────────────────────
    case 'search_files': {
      const pattern = String(toolCall.input.pattern ?? '')
      const glob = toolCall.input.glob ? String(toolCall.input.glob) : undefined
      const outputMode = (toolCall.input.output_mode as string) || 'content'
      const contextLines = Math.max(0, Number(toolCall.input.context_lines) || 0)

      if (!pattern.trim()) {
        return {
          content: formatStructuredError({
            code: 'INVALID_PATTERN',
            message: 'Search pattern must not be empty.',
            suggestion: 'Provide a regex pattern to search for, e.g. "import.*from"',
            retryable: true,
          }),
          isError: true,
        }
      }

      let regex: RegExp
      try { regex = new RegExp(pattern, 'gi') } catch {
        return {
          content: formatStructuredError({
            code: 'INVALID_REGEX',
            message: `Invalid regex pattern: ${pattern}`,
            suggestion: 'Check your regex syntax. Escape special characters like ( [ { . * + ? ^ $ | \\\\.',
            retryable: true,
          }),
          isError: true,
        }
      }

      const filesToSearch = glob
        ? currentFiles.filter((f) => matchesGlob(f.path, glob))
        : currentFiles

      if (filesToSearch.length === 0) {
        return {
          content: glob
            ? `No files matched the glob pattern "${glob}".`
            : 'No files in the project.',
          isError: false,
        }
      }

      // Count mode
      if (outputMode === 'count') {
        const counts: string[] = []
        let totalMatches = 0
        for (const file of filesToSearch) {
          let matchCount = 0
          for (const line of file.code.split('\n')) {
            const matches = line.match(regex)
            if (matches) matchCount += matches.length
          }
          if (matchCount > 0) {
            counts.push(`  ${file.path}: ${matchCount} match(es)`)
            totalMatches += matchCount
          }
        }
        return {
          content: counts.length > 0
            ? `${totalMatches} total match(es) across ${counts.length} file(s):\n${counts.join('\n')}`
            : `No matches for "${pattern}" in ${filesToSearch.length} file(s).`,
          isError: false,
        }
      }

      // Files-with-matches mode
      if (outputMode === 'files_with_matches') {
        const matched: string[] = []
        for (const file of filesToSearch) {
          if (regex.test(file.code)) {
            matched.push(`  ${file.path}`)
            regex.lastIndex = 0
          }
        }
        return {
          content: matched.length > 0
            ? `${matched.length} file(s) matched:\n${matched.join('\n')}`
            : `No files matched "${pattern}" in ${filesToSearch.length} file(s).`,
          isError: false,
        }
      }

      // Content mode with truncation
      const results: string[] = []
      let totalMatches = 0

      for (const file of filesToSearch) {
        const fileLines = file.code.split('\n')
        const fileMatches: { lineNum: number; line: string }[] = []

        for (let i = 0; i < fileLines.length; i++) {
          if (regex.test(fileLines[i])) {
            fileMatches.push({ lineNum: i + 1, line: fileLines[i] })
            regex.lastIndex = 0
            totalMatches++
            if (totalMatches >= SEARCH_MAX_MATCHES) break
          }
        }

        if (fileMatches.length > 0) {
          results.push(`── ${file.path} (${fileMatches.length} match(es)) ──`)
          const shownContext = new Set<number>()

          for (const match of fileMatches) {
            const ctxStart = Math.max(1, match.lineNum - contextLines)
            const ctxEnd = Math.min(fileLines.length, match.lineNum + contextLines)

            if (contextLines > 0 && ctxStart < match.lineNum) {
              for (let cl = ctxStart; cl < match.lineNum; cl++) {
                if (!shownContext.has(cl)) {
                  results.push(`  ${String(cl).padStart(4, ' ')}  ${fileLines[cl - 1]}`)
                  shownContext.add(cl)
                }
              }
            }

            results.push(` ▶${String(match.lineNum).padStart(4, ' ')}  ${match.line}`)
            shownContext.add(match.lineNum)

            if (contextLines > 0 && ctxEnd > match.lineNum) {
              for (let cl = match.lineNum + 1; cl <= ctxEnd; cl++) {
                if (!shownContext.has(cl)) {
                  results.push(`  ${String(cl).padStart(4, ' ')}  ${fileLines[cl - 1]}`)
                  shownContext.add(cl)
                }
              }
            }
          }
        }

        if (totalMatches >= SEARCH_MAX_MATCHES) break
      }

      if (results.length === 0) {
        return {
          content: `No matches for "${pattern}" in ${filesToSearch.length} file(s).`,
          isError: false,
        }
      }

      let header = `Found ${totalMatches} match(es) for "${pattern}"`
      if (totalMatches >= SEARCH_MAX_MATCHES)
        header += ` (truncated at ${SEARCH_MAX_MATCHES} — narrow your pattern or use glob to filter)`
      return { content: `${header}:\n\n${results.join('\n')}`, isError: false }
    }

    // ── write_file ──────────────────────────────────────────────
    case 'write_file': {
      const path = normalizePath(String(toolCall.input.path ?? ''))
      const language = String(toolCall.input.language ?? 'tsx')
      const code = String(toolCall.input.code ?? '')

      if (!code.trim()) {
        return {
          content: formatStructuredError({
            code: 'EMPTY_FILE', message: 'File code must not be empty.',
            suggestion: 'Provide complete, valid code for the file. Use edit_file for small changes.',
            retryable: true,
          }), isError: true,
        }
      }
      if (!path.startsWith('src/')) {
        return {
          content: formatStructuredError({
            code: 'INVALID_PATH', message: `File path must be under src/. Got: ${path}`,
            suggestion: 'All project files must be under the src/ directory.',
            retryable: true,
          }), isError: true,
        }
      }
      if (path.includes('..')) {
        return {
          content: formatStructuredError({
            code: 'PATH_TRAVERSAL', message: `Path traversal not allowed: ${path}`,
            suggestion: 'Use a path under src/ without .. segments.',
            retryable: false,
          }), isError: true,
        }
      }

      const existingFile = currentFiles.find((f) => f.path === path)
      if (
        runCtx &&
        existingFile &&
        shouldRejectWholeFileRewrite({
          mode: runCtx.mode,
          prompt: runCtx.goal,
          existingCode: existingFile.code,
          newCode: code,
          alreadyRejected: runCtx.rewriteGuardedPaths.has(path),
        })
      ) {
        runCtx.rewriteGuardedPaths.add(path)
        return {
          content: formatStructuredError({
            code: 'WHOLE_FILE_REWRITE_REJECTED',
            message: `write_file would overwrite the long existing file ${path} for a small refine request.`,
            suggestion:
              'Use edit_file or multi_edit to patch only the specific imports, state, handlers, draw/update logic, and reset paths needed. If targeted edits fail after reading the relevant section, you may try write_file again.',
            retryable: true,
          }),
          isError: true,
        }
      }

      const isNew = !existingFile
      const newFiles = upsertFile(currentFiles, { path, language, code })
      return {
        content: `${isNew ? 'Created' : 'Overwrote'} ${path} (${code.split('\n').length} lines, ${code.length} chars).`,
        isError: false,
        files: newFiles,
      }
    }

    // ── edit_file ───────────────────────────────────────────────
    case 'edit_file': {
      const path = normalizePath(String(toolCall.input.path ?? ''))
      const oldStr = String(toolCall.input.old_string ?? '')
      const newStr = String(toolCall.input.new_string ?? '')
      const file = currentFiles.find((f) => f.path === path)

      if (!file) {
        const similar = findSimilarFiles(path, currentFiles)
        return {
          content: formatStructuredError({
            code: 'FILE_NOT_FOUND', message: `File not found: ${path}`,
            suggestion: 'Use list_files to see what exists. Check the path spelling.',
            retryable: true,
            similarPaths: similar.length > 0 ? similar : undefined,
          }), isError: true,
        }
      }
      const outcome = applySingleEdit(file.code, oldStr, newStr)
      if (!outcome.ok) {
        return {
          content: describeEditFailure(outcome.reason, path, file.code, outcome.count),
          isError: true,
        }
      }

      const newFiles = currentFiles.map((f) =>
        f.path === path ? { ...f, code: outcome.code } : f,
      )
      return {
        content: `Edited ${path}: replaced ${oldStr.length} chars with ${newStr.length} chars${outcome.fuzzy ? ' (matched ignoring whitespace)' : ''}.\nPreview: ${newStr.slice(0, 200)}${newStr.length > 200 ? '...' : ''}`,
        isError: false,
        files: newFiles,
      }
    }

    // ── multi_edit ──────────────────────────────────────────────
    case 'multi_edit': {
      const path = normalizePath(String(toolCall.input.path ?? ''))
      const rawEdits = Array.isArray(toolCall.input.edits) ? toolCall.input.edits : []
      const file = currentFiles.find((f) => f.path === path)

      if (!file) {
        const similar = findSimilarFiles(path, currentFiles)
        return {
          content: formatStructuredError({
            code: 'FILE_NOT_FOUND', message: `File not found: ${path}`,
            suggestion: 'Use list_files to see what exists. Check the path spelling.',
            retryable: true,
            similarPaths: similar.length > 0 ? similar : undefined,
          }), isError: true,
        }
      }
      if (rawEdits.length === 0) {
        return {
          content: formatStructuredError({
            code: 'NO_EDITS', message: 'multi_edit requires a non-empty edits array.',
            suggestion: 'Provide at least one {old_string, new_string} edit, or use edit_file.',
            retryable: true,
          }), isError: true,
        }
      }

      // Apply edits sequentially to a working copy — all-or-nothing.
      let working = file.code
      let fuzzyCount = 0
      for (let e = 0; e < rawEdits.length; e++) {
        const edit = rawEdits[e] as Record<string, unknown>
        const oldStr = String(edit?.old_string ?? '')
        const newStr = String(edit?.new_string ?? '')
        const outcome = applySingleEdit(working, oldStr, newStr)
        if (!outcome.ok) {
          return {
            content:
              `multi_edit failed on edit ${e + 1} of ${rawEdits.length} — no changes were applied to ${path}.\n` +
              describeEditFailure(outcome.reason, path, working, outcome.count),
            isError: true,
          }
        }
        working = outcome.code
        if (outcome.fuzzy) fuzzyCount++
      }

      const newFiles = currentFiles.map((f) =>
        f.path === path ? { ...f, code: working } : f,
      )
      return {
        content: `Applied ${rawEdits.length} edit(s) to ${path}${fuzzyCount > 0 ? ` (${fuzzyCount} matched ignoring whitespace)` : ''}. File is now ${working.split('\n').length} lines.`,
        isError: false,
        files: newFiles,
      }
    }

    // ── delete_file ─────────────────────────────────────────────
    case 'delete_file': {
      const path = normalizePath(String(toolCall.input.path ?? ''))
      const file = currentFiles.find((f) => f.path === path)

      if (!file) {
        const similar = findSimilarFiles(path, currentFiles)
        return {
          content: formatStructuredError({
            code: 'FILE_NOT_FOUND', message: `File not found: ${path}`,
            suggestion: 'Use list_files to see what exists. It may already be deleted.',
            retryable: false,
            similarPaths: similar.length > 0 ? similar : undefined,
          }), isError: true,
        }
      }
      if (path === 'src/App.tsx') {
        return {
          content: formatStructuredError({
            code: 'PROTECTED_FILE',
            message: 'src/App.tsx is the entry point and cannot be deleted.',
            suggestion: 'Overwrite it with write_file instead if you need to change it.',
            retryable: false,
          }), isError: true,
        }
      }

      const newFiles = currentFiles.filter((f) => f.path !== path)
      return {
        content: `Deleted ${path}. ${newFiles.length} file(s) remain. Compile to confirm nothing still imports it.`,
        isError: false,
        files: newFiles,
      }
    }

    // ── compile ─────────────────────────────────────────────────
    case 'compile': {
      if (currentFiles.length === 0) {
        return { content: 'No files to compile. Create some files first.', isError: false }
      }

      try {
        const preview = await buildPreview(
          currentFiles.map((f) => ({ path: f.path, content: f.code })),
        )
        if (preview.errors.length === 0) {
          // esbuild only transpiles — it never runs the code. Actually execute
          // the bundle in a hidden iframe to catch runtime errors (undefined
          // variables, broken hooks, render crashes) that "compile" would miss.
          const runtime = await runtimeSmokeTest(preview.html)
          const report = formatRuntimeReport(runtime)
          if (!runtime.ok) {
            if (runCtx) runCtx.lastCompileOk = false
            return {
              content: `Build succeeded, but the app crashes at runtime.\n\n${report}`,
              isError: true,
            }
          }
          if (runCtx) {
            runCtx.lastCompileOk = true
            runCtx.dirtySinceCompile = false
          }
          if (report) {
            // Non-fatal console warnings — surface but don't block.
            return {
              content: `Compilation + runtime check passed (with warnings).\n\n${report}`,
              isError: false,
            }
          }
          return {
            content: 'Compilation + runtime check passed. The app builds and renders with no errors.',
            isError: false,
          }
        }
        if (runCtx) runCtx.lastCompileOk = false

        const uniqueErrors = [...new Set(preview.errors)]
        const shown = uniqueErrors.slice(0, COMPILE_MAX_ERRORS)
        const truncated =
          uniqueErrors.length > COMPILE_MAX_ERRORS
            ? `\n  ... and ${uniqueErrors.length - COMPILE_MAX_ERRORS} more error(s). Fix the first ones first.`
            : ''

        return {
          content: `Compilation failed: ${uniqueErrors.length} error(s).\n${shown.map((e, i) => `  ${i + 1}. ${e}`).join('\n')}${truncated}\n\nRead the affected files and fix each error with edit_file. Recompile after fixing.`,
          isError: true,
        }
      } catch (err) {
        if (runCtx) runCtx.lastCompileOk = false
        return {
          content: formatStructuredError({
            code: 'COMPILE_CRASH',
            message: err instanceof Error ? err.message : String(err),
            suggestion: 'This might be a config issue or syntax error. Check recent changes.',
            retryable: true,
          }), isError: true,
        }
      }
    }

    // ── set_title ────────────────────────────────────────────────
    case 'set_title': {
      const titleValue = typeof toolCall.input.title === 'string' ? toolCall.input.title.trim() : ''
      // set_title is for new projects only. On a refine run the project already
      // has a name, so ignore it instead of re-naming an existing project.
      if (runCtx && runCtx.mode === 'refine') {
        return {
          content: JSON.stringify({
            ok: false,
            skipped: 'set_title is only for new projects; the existing title was kept.',
          }),
          isError: false,
        }
      }
      if (titleValue) {
        onProgress?.({ type: 'title', text: titleValue })
      }
      return { content: JSON.stringify({ ok: true, title: titleValue }), isError: false }
    }

    // ── done ────────────────────────────────────────────────────
    case 'done': {
      // Verification gate (Claude Code: evidence before completion claims).
      // Deterministic checks first, then an interactive smoke test that
      // actually clicks buttons and types into inputs. Capped at 3 rejections
      // so a flaky check can never deadlock a run.
      if (runCtx && runCtx.doneRejections < 3) {
        const rejection = await runDoneVerificationGate(
          runCtx,
          currentFiles,
          provider,
          signal,
          onProgress,
        )
        if (rejection) {
          runCtx.doneRejections++
          return { content: rejection, isError: true }
        }
      }
      const summary = String(toolCall.input.summary ?? 'Project complete.')
      // Only carry a title for new projects — refine runs keep the existing name.
      const title =
        runCtx?.mode === 'refine'
          ? ''
          : typeof toolCall.input.title === 'string'
            ? toolCall.input.title.trim()
            : ''
      return {
        content: JSON.stringify({ summary, title }),
        isError: false,
        files: currentFiles,
      }
    }

    default:
      return {
        content: formatStructuredError({
          code: 'UNKNOWN_TOOL',
          message: `Unknown tool: ${toolCall.name}`,
          suggestion: `Available tools: ${AGENT_TOOLS.map((t) => t.name).join(', ')}`,
          retryable: false,
        }), isError: true,
      }
  }
}

// ─── Done Verification Gate ─────────────────────────────────────────────────

/**
 * Returns a rejection message when the project is not verifiably finished,
 * or null to accept done. Checks, cheapest first:
 *
 * 1. Files changed since the last passing compile (or no passing compile yet).
 * 2. PLAN.md has unchecked requirements (create mode, fires at most once —
 *    the seeded checklist is heuristic and may contain noise).
 * 3. Interactive smoke test: build the app and actually exercise its buttons,
 *    inputs, and hash links; reject when a handler throws.
 */
async function runDoneVerificationGate(
  runCtx: RunContext,
  currentFiles: AgentCodeFile[],
  provider: ResolvedProvider,
  signal: AbortSignal | undefined,
  onProgress: ((event: AgentProgressEvent) => void) | undefined,
): Promise<string | null> {
  // 1. Stale-compile gate
  if (runCtx.dirtySinceCompile || !runCtx.lastCompileOk) {
    return formatStructuredError({
      code: 'DONE_REJECTED',
      message: runCtx.lastCompileOk
        ? 'Files changed since the last passing compile — the current code is unverified.'
        : 'No compile has passed (build + runtime) in this run yet.',
      suggestion: 'Run compile now. When it passes for the current files, call done again.',
      retryable: true,
    })
  }

  // 2. Plan-coverage gate. The run-level rejection cap prevents deadlocks if a
  // heuristic checklist is noisy, but the model must first see the concrete gap.
  const planFile = currentFiles.find((f) => f.path === PLAN_PATH)
  if (planFile) {
    const unmet = unmetRequirements(parsePlan(planFile.code))
    if (unmet.length > 0) {
      return formatStructuredError({
        code: 'DONE_REJECTED',
        message: `PLAN.md still has ${unmet.length} unchecked requirement(s): ${unmet
          .map((i) => `${i.id}. ${i.text}`)
          .join('; ')}`,
        suggestion:
            'Either finish these requirements, or — if one is already done or no longer applies — update the checklist with update_plan (check it off or rewrite the list), then call done again.',
        retryable: true,
      })
    }
  }

  // 3. Interactive smoke test — the buttons must actually work.
  try {
    const preview = await buildPreview(
      currentFiles.map((f) => ({ path: f.path, content: f.code })),
    )
    if (preview.errors.length === 0) {
      const runtime = await interactiveSmokeTest(preview.html)
      if (runtime.ran && !runtime.ok) {
        const report = formatRuntimeReport(runtime)
        return formatStructuredError({
          code: 'DONE_REJECTED',
          message: `The app breaks when its UI is actually used.\n${report ?? ''}`,
          suggestion:
            'Fix the failing handler(s), compile, then call done again.',
          retryable: true,
        })
      }

      const visualRejection = await runVisualReviewGate({
        runCtx,
        currentFiles,
        html: preview.html,
        provider,
        signal,
        onProgress,
      })
      if (visualRejection) return visualRejection
    }
  } catch {
    // Inconclusive (no DOM / bundler hiccup) — never block done on a flaky check.
  }

  return null
}

// ─── Model Calling ──────────────────────────────────────────────────────────

function hashString(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function projectFingerprint(files: AgentCodeFile[]): string {
  return files
    .map((f) => `${f.path}:${f.code.length}:${hashString(f.code)}`)
    .sort()
    .join('|')
}

const VISUAL_REVIEW_PROMPT_RE =
  /\b(visual|design|layout|style|css|theme|dark|light|button|icon|canvas|game|animation|sprite|particle|shake|responsive|mobile|overlap|clip|contrast|color|polish|ui)\b/i

export function supportsVisualReview(providerId: string, modelId: string): boolean {
  const provider = providerId.toLowerCase()
  const model = modelId.toLowerCase()

  if (provider === 'anthropic' || provider === 'google') return true
  if (provider === 'openai' || provider === 'azure') {
    return /\b(gpt-4o|gpt-4\.1|gpt-5|o3|o4|vision)\b/.test(model)
  }
  if (provider === 'openrouter') {
    return /(claude|gemini|gpt-4o|gpt-4\.1|gpt-5|o3|o4|pixtral|qwen.*vl|llava|vision)/.test(model)
  }
  if (provider === 'mistral') return /pixtral|vision/.test(model)

  return false
}

export function shouldRunVisualReviewForRun(params: {
  goal: string
  mode: 'create' | 'refine'
  mutatedPaths: string[]
  providerId: string
  modelId: string
}): boolean {
  if (!supportsVisualReview(params.providerId, params.modelId)) return false
  if (params.mode === 'create') return true
  if (VISUAL_REVIEW_PROMPT_RE.test(params.goal)) return true
  return params.mutatedPaths.some((path) => path.endsWith('.css'))
}

async function runVisualReviewGate({
  runCtx,
  currentFiles,
  html,
  provider,
  signal,
  onProgress,
}: {
  runCtx: RunContext
  currentFiles: AgentCodeFile[]
  html: string
  provider: ResolvedProvider
  signal: AbortSignal | undefined
  onProgress: ((event: AgentProgressEvent) => void) | undefined
}): Promise<string | null> {
  const fingerprint = projectFingerprint(currentFiles)
  if (runCtx.visualReviewHash === fingerprint) return null

  if (!shouldRunVisualReviewForRun({
    goal: runCtx.goal,
    mode: runCtx.mode,
    mutatedPaths: [...runCtx.mutatedPaths],
    providerId: provider.key.provider_id,
    modelId: provider.model.id,
  })) {
    return null
  }

  const views = await captureResponsiveViews(html)
  if (views.length === 0) return null

  onProgress?.({
    type: 'status',
    message: `Running visual review (${views.map((v) => v.label).join(', ')}).`,
  })

  try {
    const prompt = buildVisualReviewPrompt(runCtx.goal, views)
    const images = viewsToVisionImages(views)
    let streamedText = ''
    const result = await callModelWithTools({
      providerId: provider.key.provider_id,
      baseUrl: provider.baseUrl,
      apiKey: provider.key.api_key,
      modelId: provider.model.id,
      system: VISUAL_REVIEW_SYSTEM,
      tools: [],
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...images.map((image) => ({
              type: 'image' as const,
              image: { base64: image.base64, mediaType: image.mediaType },
            })),
          ],
        },
      ],
      signal,
      onText: (chunk) => {
        streamedText += chunk
      },
      thinkingBudget: 0,
    })

    const verdict = parseVisualReview(result.text || streamedText)
    if (verdict.verdict === 'revise' && verdict.issues.length > 0) {
      return formatStructuredError({
        code: 'DONE_REJECTED',
        message: formatVisualFeedback(verdict),
        suggestion:
          'Fix the visible issues from the screenshot review, compile, then call done again.',
        retryable: true,
      })
    }

    runCtx.visualReviewHash = fingerprint
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    onProgress?.({
      type: 'status',
      message: `Visual review skipped (${message.slice(0, 160)}).`,
    })
  }

  return null
}

interface ModelCallResult {
  text: string
  toolCalls: ToolCall[]
  /** Anthropic thinking blocks from this turn — replayed on the next turn. */
  thinkingBlocks?: { thinking: string; signature: string }[]
  /** DeepSeek reasoning_content from this turn — replayed on the next turn. */
  reasoningContent?: string
  /** Token usage for this single call, when the provider reports it. */
  usage?: RunUsage
  /** Tool calls whose arguments were not valid JSON — surfaced as errors. */
  invalidCalls?: InvalidToolCall[]
}

interface InvalidToolCall {
  id: string
  name: string
  raw: string
}

/**
 * Builds an onToolStream callback that surfaces the tool call currently being
 * generated by the model as 'generating' progress events. Without this the UI
 * keeps showing the previous (already finished) step for the whole time the
 * model streams a large tool call, e.g. a write_file with a full file body.
 * Emits once when the tool name appears and once more when the `path` arg can
 * be sniffed from the partial JSON; the path sits at the front of the args, so
 * sniffing stops after a match (or a 4 KB cap) to avoid rescanning huge bodies.
 */
export function createToolStreamProgressEmitter(
  onProgress: ((event: AgentProgressEvent) => void) | undefined,
): (toolName: string, argsFragment: string) => void {
  let currentTool: string | null = null
  let args = ''
  let pathFound = false
  return (toolName, argsFragment) => {
    if (toolName !== currentTool) {
      currentTool = toolName
      args = ''
      pathFound = false
      onProgress?.({ type: 'generating', toolName })
    }
    if (pathFound || args.length > 4096) return
    args += argsFragment
    const match = args.match(/"path"\s*:\s*"((?:[^"\\]|\\.)*)"/)
    if (match) {
      pathFound = true
      onProgress?.({ type: 'generating', toolName, toolInput: { path: match[1] } })
    }
  }
}

async function callModelWithTools({
  providerId, baseUrl, apiKey, modelId, system, tools, messages, signal, onText, onToolStream, thinkingBudget,
}: {
  providerId: string; baseUrl: string; apiKey: string; modelId: string
  system: string; tools: ToolDefinition[]; messages: LlmMessage[]
  signal?: AbortSignal; onText: (chunk: string) => void
  onToolStream?: (toolName: string, argsFragment: string) => void
  thinkingBudget?: number
}): Promise<ModelCallResult> {
  const providerDef = PROVIDER_DEFS[providerId]
  if (providerDef?.apiFormat === 'bedrock') {
    throw new Error('Amazon Bedrock requires a server-side Bedrock Converse adapter and is not available through the browser agent yet.')
  }
  if (providerDef?.apiFormat === 'anthropic' || providerId === 'anthropic') {
    return callAnthropicWithTools({ baseUrl, apiKey, modelId, system, tools, messages, signal, onText, onToolStream, thinkingBudget })
  }
  if (providerDef?.apiFormat === 'gemini' || providerId === 'google') {
    return callGeminiWithTools({ baseUrl, apiKey, modelId, system, tools, messages, signal, onText, onToolStream, thinkingBudget })
  }
  return callOpenAIWithTools({ providerId, baseUrl, apiKey, modelId, system, tools, messages, signal, onText, onToolStream, thinkingBudget })
}

// ─── OpenAI-compatible ──────────────────────────────────────────────────────

function toolsToOpenAIFormat(tools: ToolDefinition[]) {
  return tools.map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.input_schema } }))
}

function toolsToAnthropicFormat(tools: ToolDefinition[]) {
  return tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }))
}

async function callOpenAIWithTools({
  providerId, baseUrl, apiKey, modelId, system, tools, messages, signal, onText, onToolStream, thinkingBudget,
}: {
  providerId?: string; baseUrl: string; apiKey: string; modelId: string; system: string
  tools: ToolDefinition[]; messages: LlmMessage[]
  signal?: AbortSignal; onText: (chunk: string) => void
  onToolStream?: (toolName: string, argsFragment: string) => void
  thinkingBudget?: number
}): Promise<ModelCallResult> {
  const url = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (providerId === 'azure') {
    headers['api-key'] = apiKey
  } else {
    headers.Authorization = `Bearer ${apiKey}`
  }
  if (providerId === 'openrouter') {
    headers['HTTP-Referer'] = window.location.origin
    headers['X-OpenRouter-Title'] = 'OpenThorn'
  }

  const openaiMessages = [
    { role: 'system', content: system },
    ...messages.flatMap(convertToOpenAIMessages),
  ]
  const openaiTools = toolsToOpenAIFormat(tools)
  const reasoning = getReasoningParams(providerId ?? 'openai', modelId, thinkingBudget ?? 0)

  // When no tools are provided (e.g. visual/self review), make a plain
  // text completion — don't send an empty tools array some APIs reject.
  const attempts: Array<Record<string, unknown>> =
    tools.length === 0
      ? [{ stream: true, ...reasoning }, { stream: false, ...reasoning }]
      : [
          { tools: openaiTools, stream: true, ...reasoning },
          { tools: openaiTools, stream: true, tool_choice: 'auto', ...reasoning },
          { tools: openaiTools, stream: false, ...reasoning },
          { stream: true },
        ]

  let lastError = ''

  // Outer loop walks the request-shape ladder (tools/stream variants for
  // strict OpenAI-compatible providers). The inner loop retries the SAME shape
  // on transient failures (429/5xx/network) with exponential backoff.
  outer: for (let attemptIdx = 0; attemptIdx < attempts.length; attemptIdx++) {
    const attempt = attempts[attemptIdx]
    for (let retry = 0; retry < MODEL_CALL_RETRIES; retry++) {
      throwIfAborted(signal)
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 60_000)
        const combinedSignal = signal ? anyAbort(signal, controller.signal) : controller.signal

        const response = await fetch(url, {
          method: 'POST', redirect: 'manual',
          headers,
          body: JSON.stringify({
            model: modelId, messages: openaiMessages,
            temperature: 0.22, max_tokens: MAX_OUTPUT_TOKENS, ...attempt,
          }),
          signal: combinedSignal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text().catch(() => '')
          let errorPayload: unknown = ''
          try { errorPayload = JSON.parse(errorText) } catch { errorPayload = errorText }
          const providerMessage = extractProviderErrorMessage(errorPayload)
          const fallbackMessage = typeof errorPayload === 'string' ? errorPayload : JSON.stringify(errorPayload)
          lastError = `${response.status}: ${(providerMessage || fallbackMessage).slice(0, 300)}`

          if (response.status === 401 || response.status === 403) break outer
          if (isRetryableStatus(response.status)) {
            await sleep(parseRetryAfter(response.headers.get('retry-after')) ?? backoffDelay(retry))
            continue // retry the same request shape
          }
          if (response.status === 400 || response.status === 422) continue outer // try the next shape
          break outer
        }

        const result = attempt.stream === true
          ? await parseOpenAIToolStream(response, onText, onToolStream)
          : await parseOpenAINonStream(response, onText)
        if (result) return result
        continue outer // unparseable response — try the next shape
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          if (signal?.aborted) throw err
          lastError = 'Request timed out after 60s.'
        } else {
          lastError = err instanceof Error ? err.message : String(err)
        }
        // Network error or timeout — transient, retry with backoff.
        await sleep(backoffDelay(retry))
      }
    }
  }

  throw new Error(lastError || 'Provider request failed.')
}

function extractProviderErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const record = payload as Record<string, unknown>
  const error = record.error
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message
    if (typeof message === 'string') return message
  }
  const message = record.message
  return typeof message === 'string' ? message : ''
}

function anyAbort(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  a.addEventListener('abort', onAbort, { once: true })
  b.addEventListener('abort', onAbort, { once: true })
  if (a.aborted || b.aborted) controller.abort()
  return controller.signal
}

async function parseOpenAINonStream(response: Response, onText: (chunk: string) => void): Promise<ModelCallResult | null> {
  const payload = await response.json().catch(() => null)
  if (!payload) return null
  const choice = payload?.choices?.[0]
  const message = choice?.message
  if (!message) return null
  const text = typeof message.content === 'string' ? message.content : ''
  if (text) onText(text)
  const reasoningContent = typeof message.reasoning_content === 'string' ? message.reasoning_content : undefined
  const toolCalls: ToolCall[] = []
  const invalidCalls: InvalidToolCall[] = []
  if (Array.isArray(message.tool_calls)) {
    for (const tc of message.tool_calls) {
      if (tc.type === 'function' && tc.function) {
        try {
          toolCalls.push({
            id: tc.id || `call_${toolCalls.length}`,
            name: tc.function.name,
            input: typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : (tc.function.arguments ?? {}),
          })
        } catch {
          invalidCalls.push({
            id: tc.id || `call_${toolCalls.length + invalidCalls.length}`,
            name: tc.function.name ?? 'unknown',
            raw: typeof tc.function.arguments === 'string' ? tc.function.arguments : '',
          })
        }
      }
    }
  }
  return { text, toolCalls, invalidCalls, usage: parseOpenAIUsage(payload?.usage), reasoningContent }
}

/** Best-effort usage extraction from an OpenAI-compatible usage object. */
function parseOpenAIUsage(u: unknown): RunUsage | undefined {
  if (!u || typeof u !== 'object') return undefined
  const usage = u as Record<string, unknown>
  const details = (usage.prompt_tokens_details ?? {}) as Record<string, unknown>
  return {
    inputTokens: Number(usage.prompt_tokens) || 0,
    outputTokens: Number(usage.completion_tokens) || 0,
    cacheReadTokens: Number(details.cached_tokens) || 0,
    cacheWriteTokens: 0,
  }
}

async function parseOpenAIToolStream(
  response: Response,
  onText: (chunk: string) => void,
  onToolStream?: (toolName: string, argsFragment: string) => void,
): Promise<ModelCallResult | null> {
  const reader = response.body?.getReader()
  if (!reader) return null
  const decoder = new TextDecoder()
  let buffer = '', fullText = '', fullReasoning = ''
  let usage: RunUsage | undefined
  const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          if (parsed?.usage) usage = parseOpenAIUsage(parsed.usage) ?? usage
          const delta = parsed?.choices?.[0]?.delta
          if (delta?.reasoning_content) fullReasoning += delta.reasoning_content
          if (delta?.content) { fullText += delta.content; onText(delta.content) }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0
              if (!toolCalls.has(idx)) toolCalls.set(idx, { id: tc.id ?? `call_${idx}`, name: tc.function?.name ?? '', arguments: '' })
              const existing = toolCalls.get(idx)!
              if (tc.id) existing.id = tc.id
              if (tc.function?.name) existing.name = tc.function.name
              if (tc.function?.arguments) existing.arguments += tc.function.arguments
              if (existing.name) onToolStream?.(existing.name, tc.function?.arguments ?? '')
            }
          }
        } catch { /* skip */ }
      }
    }
  } finally { reader.releaseLock() }

  const parsedToolCalls: ToolCall[] = []
  const invalidCalls: InvalidToolCall[] = []
  for (const tc of toolCalls.values()) {
    if (tc.name) {
      try { parsedToolCalls.push({ id: tc.id, name: tc.name, input: JSON.parse(tc.arguments || '{}') }) } catch {
        invalidCalls.push({ id: tc.id, name: tc.name, raw: tc.arguments })
      }
    }
  }
  return { text: fullText, toolCalls: parsedToolCalls, invalidCalls, usage, reasoningContent: fullReasoning || undefined }
}

// ─── Anthropic (with caching + thinking) ────────────────────────────────────

async function callAnthropicWithTools({
  baseUrl, apiKey, modelId, system, tools, messages, signal, onText, onToolStream, thinkingBudget,
}: {
  baseUrl: string; apiKey: string; modelId: string; system: string
  tools: ToolDefinition[]; messages: LlmMessage[]
  signal?: AbortSignal; onText: (chunk: string) => void
  onToolStream?: (toolName: string, argsFragment: string) => void
  thinkingBudget?: number
}): Promise<ModelCallResult> {
  const anthropicMessages = messages.map(convertToAnthropicMessage)

  // Cache the conversation prefix, not just the system prompt ("prompt caching
  // is everything"): a marker on the final message's last block lets each turn
  // reuse the previous turn's cached prefix — tools + system + all prior
  // messages — instead of re-billing the whole conversation at full price.
  // convertToAnthropicMessage returns fresh objects, so this never leaks
  // cache_control back into the loop's message state (markers must not
  // accumulate across turns — the API allows at most 4 breakpoints).
  const lastMsg = anthropicMessages[anthropicMessages.length - 1]
  if (lastMsg) {
    if (typeof lastMsg.content === 'string' && lastMsg.content.length > 0) {
      lastMsg.content = [
        { type: 'text', text: lastMsg.content, cache_control: { type: 'ephemeral' } },
      ]
    } else if (Array.isArray(lastMsg.content) && lastMsg.content.length > 0) {
      const blocks = lastMsg.content as Record<string, unknown>[]
      const lastBlock = blocks[blocks.length - 1]
      const t = lastBlock?.type
      if (t === 'text' || t === 'tool_result' || t === 'image' || t === 'tool_use') {
        blocks[blocks.length - 1] = { ...lastBlock, cache_control: { type: 'ephemeral' } }
      }
    }
  }

  const body: Record<string, unknown> = {
    model: modelId, max_tokens: MAX_OUTPUT_TOKENS,
    messages: anthropicMessages, stream: true,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
  }

  if (tools.length > 0) {
    body.tools = toolsToAnthropicFormat(tools)
  }

  const budget = thinkingBudget ?? ANTHROPIC_THINKING_BUDGET
  // Extended thinking requires temperature:1, and max_tokens must exceed the
  // thinking budget (the visible output is the remainder) — size it so the
  // model still has room for tool calls after reasoning.
  if (budget > 0 && tools.length > 0 && supportsManualAnthropicThinking(modelId)) {
    body.thinking = { type: 'enabled', budget_tokens: budget }
    body.temperature = 1
    body.max_tokens = budget + MAX_OUTPUT_TOKENS
  }

  // Retry transient failures (429, 5xx incl. 529 overloaded, network errors,
  // timeouts) with backoff — a single hiccup must not kill a 20-turn run.
  for (let attempt = 0; ; attempt++) {
    throwIfAborted(signal)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120_000)
    const combinedSignal = signal ? anyAbort(signal, controller.signal) : controller.signal

    let response: Response
    try {
      response = await fetch(`${baseUrl}/messages`, {
        method: 'POST', redirect: 'manual',
        headers: {
          'Content-Type': 'application/json', 'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(body), signal: combinedSignal,
      })
    } catch (err) {
      clearTimeout(timeoutId)
      if (signal?.aborted) throw err // user cancelled — never retry
      if (attempt >= MODEL_CALL_RETRIES - 1) throw err
      await sleep(backoffDelay(attempt)) // network failure or timeout
      continue
    }
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      let ep: unknown = ''
      try { ep = JSON.parse(errorText) } catch { ep = errorText }
      const message = `Anthropic ${response.status}: ${typeof ep === 'string' ? ep.slice(0, 400) : JSON.stringify(ep).slice(0, 400)}`
      if (isRetryableStatus(response.status) && attempt < MODEL_CALL_RETRIES - 1) {
        await sleep(parseRetryAfter(response.headers.get('retry-after')) ?? backoffDelay(attempt))
        continue
      }
      throw new Error(message)
    }

    return parseAnthropicToolStream(response, onText, onToolStream)
  }
}

async function parseAnthropicToolStream(
  response: Response,
  onText: (chunk: string) => void,
  onToolStream?: (toolName: string, argsFragment: string) => void,
): Promise<ModelCallResult> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body not readable')
  const decoder = new TextDecoder()
  let buffer = '', fullText = ''
  const usage = emptyUsage()
  const toolCalls: Map<number, { id: string; name: string; input: string }> = new Map()
  const thinking: Map<number, { thinking: string; signature: string }> = new Map()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        try {
          const parsed = JSON.parse(trimmed.slice(5).trim())
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            fullText += parsed.delta.text; onText(parsed.delta.text)
          }
          // Usage accounting — message_start carries input + cache counters,
          // message_delta carries the running output total.
          if (parsed.type === 'message_start' && parsed.message?.usage) {
            const u = parsed.message.usage
            usage.inputTokens = u.input_tokens ?? 0
            usage.cacheReadTokens = u.cache_read_input_tokens ?? 0
            usage.cacheWriteTokens = u.cache_creation_input_tokens ?? 0
          }
          if (parsed.type === 'message_delta' && parsed.usage?.output_tokens != null) {
            usage.outputTokens = parsed.usage.output_tokens
          }
          // Extended thinking blocks — captured so they can be replayed on the
          // next turn (Anthropic 400s if a thinking turn's blocks are dropped
          // before tool_result).
          if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'thinking') {
            thinking.set(parsed.index, {
              thinking: parsed.content_block.thinking ?? '',
              signature: parsed.content_block.signature ?? '',
            })
          }
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'thinking_delta') {
            const t = thinking.get(parsed.index)
            if (t) t.thinking += parsed.delta.thinking ?? ''
          }
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'signature_delta') {
            const t = thinking.get(parsed.index)
            if (t) t.signature += parsed.delta.signature ?? ''
          }
          if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'tool_use') {
            toolCalls.set(parsed.index, { id: parsed.content_block.id, name: parsed.content_block.name, input: '' })
            onToolStream?.(parsed.content_block.name, '')
          }
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'input_json_delta') {
            const existing = toolCalls.get(parsed.index)
            if (existing) {
              existing.input += parsed.delta.partial_json
              onToolStream?.(existing.name, parsed.delta.partial_json ?? '')
            }
          }
        } catch { /* skip */ }
      }
    }
  } finally { reader.releaseLock() }

  const parsedToolCalls: ToolCall[] = []
  const invalidCalls: InvalidToolCall[] = []
  for (const tc of toolCalls.values()) {
    try { parsedToolCalls.push({ id: tc.id, name: tc.name, input: tc.input ? JSON.parse(tc.input) : {} }) } catch {
      invalidCalls.push({ id: tc.id, name: tc.name, raw: tc.input })
    }
  }
  const thinkingBlocks = [...thinking.values()].filter((t) => t.signature)
  return { text: fullText, toolCalls: parsedToolCalls, thinkingBlocks, invalidCalls, usage }
}

// ─── Gemini ─────────────────────────────────────────────────────────────────

// Documented validator bypass for functionCall parts that legitimately have no
// signature (history from a failed-over provider, malformed-call placeholders,
// or turns where Gemini omitted one): https://ai.google.dev/gemini-api/docs/thought-signatures
export const GEMINI_SKIP_SIGNATURE = 'skip_thought_signature_validator'

// The REST API expects thoughtSignature (camelCase) as a sibling of functionCall
// on the Part — not snake_case inside functionCall (that's the OpenAI-compat format).
export function convertToGeminiContents(messages: LlmMessage[]): Array<{ role: string; parts: Array<Record<string, unknown>> }> {
  return messages.map((msg) => {
    const role = msg.role === 'assistant' ? 'model' : 'user'
    if (typeof msg.content === 'string') return { role, parts: [{ text: msg.content }] }
    const parts: Array<Record<string, unknown>> = []
    for (const block of msg.content) {
      if (block.type === 'text' && block.text) {
        parts.push({ text: block.text })
      } else if (block.type === 'image' && block.image) {
        parts.push({ inlineData: { mimeType: block.image.mediaType, data: block.image.base64 } })
      } else if (block.type === 'tool_use') {
        parts.push({
          functionCall: { name: block.name, args: block.input ?? {} },
          thoughtSignature: block.thoughtSignature ?? GEMINI_SKIP_SIGNATURE,
        })
      } else if (block.type === 'tool_result') {
        const toolUseBlock = findMatchingToolUse(messages, block.tool_use_id)
        parts.push({
          functionResponse: {
            name: toolUseBlock?.name ?? 'unknown',
            response: { content: block.content, is_error: block.is_error },
          },
        })
      }
    }
    return { role, parts: parts.length > 0 ? parts : [{ text: '' }] }
  })
}

async function callGeminiWithTools({
  baseUrl, apiKey, modelId, system, tools, messages, signal, onText, onToolStream, thinkingBudget,
}: {
  baseUrl: string; apiKey: string; modelId: string; system: string
  tools: ToolDefinition[]; messages: LlmMessage[]
  signal?: AbortSignal; onText: (chunk: string) => void
  onToolStream?: (toolName: string, argsFragment: string) => void
  thinkingBudget?: number
}): Promise<ModelCallResult> {
  const cleanModel = modelId.replace(/^models\//, '')
  const url = `${baseUrl}/models/${encodeURIComponent(cleanModel)}:streamGenerateContent?alt=sse`

  const functionDeclarations = tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: sanitizeGeminiToolSchema(t.input_schema),
  }))
  const systemParts = system ? [{ text: system }] : []

  const contents = convertToGeminiContents(messages)

  const requestBody = JSON.stringify({
    systemInstruction: systemParts.length > 0 ? { parts: systemParts } : undefined,
    contents,
    tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined,
    generationConfig: {
      temperature: 0.22,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      ...getReasoningParams('google', modelId, thinkingBudget ?? 0),
    },
  })

  // Retry transient failures (429/5xx/network/timeout) with backoff.
  for (let attempt = 0; ; attempt++) {
    throwIfAborted(signal)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60_000)
    const combinedSignal = signal ? anyAbort(signal, controller.signal) : controller.signal

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST', redirect: 'manual',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: requestBody,
        signal: combinedSignal,
      })
    } catch (err) {
      clearTimeout(timeoutId)
      if (signal?.aborted) throw err // user cancelled — never retry
      if (attempt >= MODEL_CALL_RETRIES - 1) throw err
      await sleep(backoffDelay(attempt)) // network failure or timeout
      continue
    }
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      if (isRetryableStatus(response.status) && attempt < MODEL_CALL_RETRIES - 1) {
        await sleep(parseRetryAfter(response.headers.get('retry-after')) ?? backoffDelay(attempt))
        continue
      }
      throw new Error(`Gemini ${response.status}: ${errorText.slice(0, 400)}`)
    }

    return parseGeminiToolStream(response, onText, onToolStream)
  }
}

export async function parseGeminiToolStream(
  response: Response,
  onText: (chunk: string) => void,
  onToolStream?: (toolName: string, argsFragment: string) => void,
): Promise<ModelCallResult> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body not readable')
  const decoder = new TextDecoder()
  let buffer = '', fullText = ''
  const usage = emptyUsage()
  const toolCalls: ToolCall[] = []
  let toolIdCounter = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        try {
          const parsed = JSON.parse(trimmed.slice(5).trim())
          // usageMetadata is cumulative across the stream — assign, don't add.
          if (parsed?.usageMetadata) {
            usage.inputTokens = parsed.usageMetadata.promptTokenCount ?? usage.inputTokens
            usage.outputTokens = parsed.usageMetadata.candidatesTokenCount ?? usage.outputTokens
            usage.cacheReadTokens = parsed.usageMetadata.cachedContentTokenCount ?? usage.cacheReadTokens
          }
          const parts = parsed?.candidates?.[0]?.content?.parts
          if (parts) {
            // Gemini 3.x uses cumulative SSE snapshots: the same functionCall
            // may arrive in multiple chunks with increasingly complete args, but
            // thought_signature only appears in the first chunk. Track position
            // within each chunk so repeated calls update-in-place rather than
            // creating duplicate entries (which would end up in the history
            // without a signature and trigger the 400 error on the next turn).
            let chunkFcIdx = 0
            for (const part of parts) {
              if (part.text) { fullText += part.text; onText(part.text) }
              if (part.functionCall) {
                // The REST API puts the signature on the Part, next to functionCall.
                const signature = part.thoughtSignature ?? part.functionCall.thoughtSignature
                if (chunkFcIdx < toolCalls.length) {
                  // Update existing entry from a previous chunk (cumulative stream).
                  // Refresh args but never overwrite a captured signature.
                  const existing = toolCalls[chunkFcIdx]
                  existing.input = part.functionCall.args ?? existing.input
                  if (signature) existing.thoughtSignature = signature
                  onToolStream?.(existing.name, JSON.stringify(existing.input ?? {}))
                } else {
                  toolIdCounter++
                  toolCalls.push({
                    id: `call_${toolIdCounter}`,
                    name: part.functionCall.name,
                    input: part.functionCall.args ?? {},
                    thoughtSignature: signature,
                  })
                  onToolStream?.(part.functionCall.name, JSON.stringify(part.functionCall.args ?? {}))
                }
                chunkFcIdx++
              }
            }
          }
        } catch { /* skip */ }
      }
    }
  } finally { reader.releaseLock() }

  // Gemini only attaches thought_signature to the first function call in a
  // parallel-call response. Propagate it to all calls so the conversation
  // history passes validation on every subsequent turn.
  const sharedSig = toolCalls.find(tc => tc.thoughtSignature)?.thoughtSignature
  if (sharedSig) {
    for (const tc of toolCalls) {
      if (!tc.thoughtSignature) tc.thoughtSignature = sharedSig
    }
  }

  return { text: fullText, toolCalls, usage }
}

// ─── Message Conversion ─────────────────────────────────────────────────────

function convertToOpenAIMessages(msg: LlmMessage): Record<string, unknown>[] {
  if (typeof msg.content === 'string') {
    return [{ role: msg.role, content: msg.content }]
  }

  const toolResults = msg.content.filter((b) => b.type === 'tool_result')
  if (toolResults.length > 0 && msg.role === 'user') {
    return toolResults.map((tr) => ({
      role: 'tool',
      tool_call_id: tr.tool_use_id,
      content: tr.content ?? '',
    }))
  }

  const openaiContent: Record<string, unknown>[] = []
  const toolCalls: Record<string, unknown>[] = []

  for (const block of msg.content) {
    if (block.type === 'text' && block.text) {
      openaiContent.push({ type: 'text', text: block.text })
    } else if (block.type === 'image' && block.image) {
      openaiContent.push({
        type: 'image_url',
        image_url: { url: `data:${block.image.mediaType};base64,${block.image.base64}` },
      })
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id, type: 'function',
        function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
      })
    }
  }

  if (toolCalls.length > 0 && msg.role === 'assistant') {
    const out: Record<string, unknown> = { role: 'assistant', content: openaiContent.length > 0 ? openaiContent : null, tool_calls: toolCalls }
    if (msg.reasoningContent) out.reasoning_content = msg.reasoningContent
    return [out]
  }
  // Any role with structured content (text and/or images) — preserve the array
  // so multimodal user messages (visual review) keep their image blocks.
  if (openaiContent.length > 0) {
    const out: Record<string, unknown> = { role: msg.role, content: openaiContent }
    if (msg.role === 'assistant' && msg.reasoningContent) out.reasoning_content = msg.reasoningContent
    return [out]
  }
  return [{ role: msg.role, content: msg.content.map((b) => b.content ?? b.text ?? '').join('\n') }]
}

function convertToAnthropicMessage(msg: LlmMessage): Record<string, unknown> {
  if (typeof msg.content === 'string') return { role: msg.role, content: msg.content }
  const content: Record<string, unknown>[] = []
  // Thinking blocks must lead the assistant content, before text/tool_use.
  for (const block of msg.content) {
    if (block.type === 'thinking' && block.signature) {
      content.push({ type: 'thinking', thinking: block.thinking ?? '', signature: block.signature })
    }
  }
  for (const block of msg.content) {
    if (block.type === 'thinking') continue
    if (block.type === 'text' && block.text) content.push({ type: 'text', text: block.text })
    else if (block.type === 'image' && block.image) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: block.image.mediaType, data: block.image.base64 },
      })
    }
    else if (block.type === 'tool_use') content.push({ type: 'tool_use', id: block.id, name: block.name, input: block.input ?? {} })
    else if (block.type === 'tool_result') content.push({ type: 'tool_result', tool_use_id: block.tool_use_id, content: block.content, is_error: block.is_error })
  }
  return { role: msg.role, content }
}

function findMatchingToolUse(messages: LlmMessage[], toolUseId: string | undefined): LlmContentBlock | null {
  if (!toolUseId) return null
  for (const msg of messages) {
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'tool_use' && block.id === toolUseId) return block
      }
    }
  }
  return null
}

// ─── User Prompt Builder ────────────────────────────────────────────────────

function buildUserPrompt(
  prompt: string, title: string, files: AgentCodeFile[],
  mode: 'create' | 'refine', isNew: boolean,
): string {
  const leftoverFiles = files
    .filter((f) => f.path !== 'No files yet')
    .map((f) => `- ${f.path}`)
    .join('\n')
  const planFile = files.find((f) => f.path === PLAN_PATH)
  const plan = planFile ? parsePlan(planFile.code) : null
  const uncheckedPlanItems = plan ? unmetRequirements(plan) : []
  const continuationContext =
    isContinuationRequest(prompt) && uncheckedPlanItems.length > 0
      ? `\n\nThe user is asking you to continue the unfinished work. Continue with the unchecked PLAN.md requirement(s):\n${uncheckedPlanItems
          .map((item) => `- ${item.id}. ${item.text}`)
          .join('\n')}\nDo not just summarize the project; take the next concrete tool action toward those items.`
      : ''

  if (isNew || mode === 'create') {
    let p = `The user's message: ${prompt}\n\nProject title: ${title}\n\nIf this is a request to build something, create a web app for it: think about the design and file plan first, then create files in order: theme.css → App.tsx → pages → components. Write complete files and compile after every few to catch build AND runtime errors early.\n\nIf it is NOT a build request (a greeting, casual remark, or question), do not build anything — reply in plain text with no tool calls.`
    if (leftoverFiles) {
      p += `\n\nNOTE: the workspace still contains files from a previous, unrelated project:\n${leftoverFiles}\nThese do not belong to what the user asked for. Overwrite the ones you reuse (App.tsx, theme.css) and delete_file the rest so the project only contains files for THIS app.`
    }
    return p + continuationContext
  }
  return `The user's message about the existing project: ${prompt}\n\nProject title: ${title}\n\nCurrent files:\n${leftoverFiles || '(none)'}${continuationContext}\n\nIf this requests a change, update the project: read files before editing them, use search_files to find patterns, multi_edit for several changes to one file, and delete_file to remove anything this change makes obsolete. Make focused changes and compile (build + runtime) after edits to verify.\n\nIf it is a question or remark rather than a change request, answer it in plain text (use read-only tools to look things up if needed) and do not modify any files or call done.`
}

// ─── Provider Resolution with Fallback ──────────────────────────────────────

function parseModels(raw: string | null | undefined): ModelInfo[] {
  return parseProviderModels(raw)
}

function validateProviderUrl(raw: string): string {
  const clean = raw.replace(/\/+$/, '')
  let hostname: string
  try { hostname = new URL(clean).hostname.toLowerCase() } catch {
    throw new Error(`Invalid base URL: ${clean.slice(0, 100)}`)
  }
  const isAllowedHost =
    ALLOWED_PROVIDER_HOSTS.has(hostname) ||
    hostname.endsWith('.openai.azure.com') ||
    hostname.endsWith('.services.ai.azure.com') ||
    /^bedrock-runtime\.[a-z0-9-]+\.amazonaws\.com$/.test(hostname)
  if (!isAllowedHost) {
    throw new Error(
      `Provider URL host "${hostname}" is not in the allowed list. ` +
      `Use one of: ${[...ALLOWED_PROVIDER_HOSTS].sort().join(', ')}`,
    )
  }
  return clean
}

function mergeModels(defaults: ModelInfo[], custom: ModelInfo[]): ModelInfo[] {
  const seen = new Set<string>()
  const merged: ModelInfo[] = []
  for (const model of [...defaults, ...custom]) {
    if (seen.has(model.id)) continue
    seen.add(model.id)
    merged.push(model)
  }
  return merged
}

function getRecordString(value: unknown, key: string): string {
  const record = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const result = record[key]
  return typeof result === 'string' ? result : ''
}

/**
 * Resolve a provider with fallback support.
 *
 * 1. Try the selected model's provider first.
 * 2. If it fails (circuit open, auth error, etc.), try other enabled providers.
 * 3. Uses circuit breaker to skip degraded providers.
 */
async function resolveProviderWithFallback(
  userId: string,
  selectedModel: SelectedAgentModel | null,
  exclude?: Set<string>,
): Promise<ResolvedProvider> {
  // Load all enabled provider keys
  const { data: allKeys, error } = await supabase
    .from('provider_keys')
    .select('id, provider_id, provider_name, api_key, base_url, models, enabled, is_custom')
    .eq('user_id', userId)
    .eq('enabled', true)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Could not load providers: ${error.message}`)
  if (!allKeys || allKeys.length === 0) {
    throw new Error('No enabled provider found. Add a provider key to get started.')
  }

  const keys = await Promise.all(
    (allKeys as ProviderKeyRow[]).map(async (k) => ({
      ...k,
      api_key: await decryptApiKey(k.api_key, userId),
    }))
  )

  // Lazily migrate enc: keys to senc: in the background
  for (const k of allKeys as ProviderKeyRow[]) {
    if (k.api_key.startsWith('enc:')) {
      const plaintext = keys.find((d) => d.id === k.id)?.api_key
      if (plaintext) {
        encryptApiKey(plaintext, userId)
          .then(async (sencKey) => {
            if (sencKey.startsWith('senc:')) {
              await supabase.from('provider_keys').update({ api_key: sencKey }).eq('id', k.id).eq('user_id', userId)
            }
          })
          .catch(() => {})
      }
    }
  }

  // Sort: preferred provider first, then by creation date
  const sortedKeys = [...keys]
  if (selectedModel) {
    const prefIdx = sortedKeys.findIndex(
      (k) => k.provider_id === selectedModel.provider_id,
    )
    if (prefIdx > 0) {
      const [pref] = sortedKeys.splice(prefIdx, 1)
      sortedKeys.unshift(pref)
    }
  }

  // Filter out providers with open circuits or that already failed this run
  const healthyKeys = sortedKeys.filter(
    (k) => !circuitBreaker.isOpen(k.provider_id) && !exclude?.has(k.provider_id),
  )

  if (healthyKeys.length === 0) {
    throw new Error(
      'All providers are temporarily unavailable (circuit breaker open). Please wait a moment and try again.',
    )
  }

  // Try each healthy provider in order
  const errors: string[] = []

  for (let i = 0; i < healthyKeys.length; i++) {
    const key = healthyKeys[i]

    try {
      const { data: defaultRow } = await supabase
        .from('default_models')
        .select('provider_id, models')
        .eq('provider_id', key.provider_id)
        .maybeSingle()

      const configuredDefaults = parseModels(getRecordString(defaultRow, 'models'))
      const defaultModels = configuredDefaults.length > 0
        ? configuredDefaults
        : DEFAULT_PROVIDER_MODELS[key.provider_id] ?? []
      const customModels = parseModels(key.models)
      const merged = mergeModels(defaultModels, customModels)

      const selected =
        selectedModel && selectedModel.provider_id === key.provider_id
          ? { name: selectedModel.model_name, id: selectedModel.model_id }
          : merged[0]

      if (!selected?.id) {
        errors.push(`${key.provider_name || key.provider_id}: No model configured`)
        continue
      }

      const rawBaseUrl = (
        key.base_url?.trim() || DEFAULT_BASE_URLS[key.provider_id] || ''
      ).replace(/\/+$/, '')

      if (!rawBaseUrl) {
        errors.push(`${key.provider_name || key.provider_id}: No base URL configured`)
        continue
      }

      const baseUrl = validateProviderUrl(rawBaseUrl)

      return { key, baseUrl, model: selected, models: merged }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${key.provider_name || key.provider_id}: ${msg}`)

      // Record failure for circuit breaker
      circuitBreaker.recordFailure(key.provider_id)

      // If this was the preferred provider and there are fallbacks, try them
      if (i < healthyKeys.length - 1) {
        continue
      }
    }
  }

  throw new Error(
    `Could not connect to any provider:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
  )
}
