import { type FormEvent, useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/AuthContext'
import {
  AGENT_THINKING_PROFILES,
  DEFAULT_THINKING_LEVEL,
  type AgentThinkingLevel,
} from '../../lib/agent-thinking'
import ModelSelector, { type SelectedModel } from '../ModelSelector/ModelSelector'
import styles from './PromptInput.module.css'

interface PromptInputProps {
  size?: 'default' | 'small'
  defaultValue?: string
  initialModel?: SelectedModel | null
  initialThinkingLevel?: AgentThinkingLevel
  onSubmit?: (
    prompt: string,
    selectedModel: SelectedModel | null,
    thinkingLevel: AgentThinkingLevel,
  ) => void | boolean | Promise<void | boolean>
  onModelChange?: (model: SelectedModel | null) => void
  page?: 'landing' | 'dashboard'
  disableTyping?: boolean
  placeholder?: string
  disabled?: boolean
  modelMenuPlacement?: 'bottom' | 'top'
  isRunning?: boolean
  onCancel?: () => void
}

const typingPrompts = [
  'Design a portfolio with a dark, cinematic feel...',
  'Build a waitlist landing page for my SaaS idea...',
  'Create a custom dashboard for tracking team metrics...',
  'Make a marketplace with search, filters, and checkout...',
  'Build a blog that feels like a magazine...',
  'Create a booking page for a local service business...',
]

function useTypingAnimation(active: boolean) {
  const [displayText, setDisplayText] = useState('')
  const stateRef = useRef({
    promptIndex: 0,
    charIndex: 0,
    isDeleting: false,
    active: false,
  })

  stateRef.current.active = active

  useEffect(() => {
    if (!active) {
      setDisplayText('')
      return
    }

    let timeout: ReturnType<typeof setTimeout>

    const tick = () => {
      if (!stateRef.current.active) return

      const s = stateRef.current
      const currentPrompt = typingPrompts[s.promptIndex]

      if (!s.isDeleting) {
        if (s.charIndex < currentPrompt.length) {
          s.charIndex++
          setDisplayText(currentPrompt.slice(0, s.charIndex))
          timeout = setTimeout(tick, 40 + Math.random() * 30)
        } else {
          timeout = setTimeout(() => {
            if (!stateRef.current.active) return
            stateRef.current.isDeleting = true
            tick()
          }, 2200)
        }
      } else {
        if (s.charIndex > 0) {
          s.charIndex--
          setDisplayText(currentPrompt.slice(0, s.charIndex))
          timeout = setTimeout(tick, 20 + Math.random() * 15)
        } else {
          stateRef.current.isDeleting = false
          stateRef.current.promptIndex = (s.promptIndex + 1) % typingPrompts.length
          stateRef.current.charIndex = 0
          timeout = setTimeout(tick, 300)
        }
      }
    }

    timeout = setTimeout(tick, 300)
    return () => clearTimeout(timeout)
  }, [active])

  return displayText
}

export default function PromptInput({
  size = 'default',
  defaultValue,
  initialModel,
  initialThinkingLevel = DEFAULT_THINKING_LEVEL,
  onSubmit,
  onModelChange,
  page = 'landing',
  disableTyping = false,
  placeholder = '',
  disabled = false,
  modelMenuPlacement = 'bottom',
  isRunning = false,
  onCancel,
}: PromptInputProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [internalValue, setInternalValue] = useState(defaultValue ?? '')
  const [isFocused, setIsFocused] = useState(false)
  const [selectedModel, setSelectedModel] = useState<SelectedModel | null>(initialModel ?? null)
  const [thinkingLevel, setThinkingLevel] = useState<AgentThinkingLevel>(initialThinkingLevel)
  const [thinkingOpen, setThinkingOpen] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const thinkingRef = useRef<HTMLDivElement>(null)

  // Sync when defaultValue changes (example chip click)
  useEffect(() => {
    if (defaultValue !== undefined) {
      setInternalValue(defaultValue)
    }
  }, [defaultValue])

  // Sync when initialModel changes (e.g. loaded async from DB after mount)
  useEffect(() => {
    if (initialModel !== undefined) {
      setSelectedModel(initialModel ?? null)
    }
  }, [initialModel])

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useEffect(() => {
    autoResize()
  }, [internalValue, autoResize])

  useEffect(() => {
    if (!thinkingOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (thinkingRef.current && !thinkingRef.current.contains(event.target as Node)) {
        setThinkingOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [thinkingOpen])

  const showTyping = !disableTyping && !isFocused && internalValue.length === 0
  const activeTyping = useTypingAnimation(showTyping)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInternalValue(e.target.value)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (isRunning) {
      onCancel?.()
      return
    }
    if (disabled) return

    const prompt = internalValue.trim() || activeTyping || undefined

    if (onSubmit && prompt) {
      const result = await Promise.resolve(onSubmit(prompt, selectedModel, thinkingLevel))
      if (result !== false) {
        setInternalValue('')
      }
      return
    }

    if (!user) {
      window.dispatchEvent(new CustomEvent('openthorn:require-auth'))
    } else {
      navigate('/dashboard')
    }
  }

  const handleCancelClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    onCancel?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isRunning) return
      handleSubmit(e)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadedFiles((prev) => [...prev, ...Array.from(e.target.files!)])
      // Reset so the same file can be re-selected
      e.target.value = ''
    }
  }

  const handleModelSelect = (model: SelectedModel) => {
    setSelectedModel(model)
    onModelChange?.(model)
  }

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className={styles.root}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={handleFileChange}
        accept="image/*,.pdf,.txt,.md,.csv,.json,.js,.ts,.jsx,.tsx,.py,.html,.css,.zip"
      />

      {/* Uploaded files list */}
      <AnimatePresence>
        {uploadedFiles.length > 0 && (
          <motion.div
            className={styles.fileList}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.19, 1, 0.22, 1] }}
          >
            {uploadedFiles.map((file, i) => (
              <div key={`${file.name}-${i}`} className={styles.fileChip}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                  <polyline points="13 2 13 9 20 9"/>
                </svg>
                <span className={styles.fileChipName}>{file.name}</span>
                <button
                  type="button"
                  className={styles.fileChipRemove}
                  onClick={() => removeFile(i)}
                  aria-label={`Remove ${file.name}`}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card */}
      <form
        className={`${styles.wrapper} ${size === 'small' ? styles.small : ''}`}
        onSubmit={handleSubmit}
      >
        <div className={`${styles.card} ${isFocused ? styles.cardFocused : ''}`}>
          {/* Text area — typing animation at top */}
          <div className={styles.inputArea}>
            <div className={styles.textareaWrapper}>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                value={internalValue}
                onChange={handleChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={1}
                aria-label="Describe your website idea"
                disabled={disabled || isRunning}
              />
              {showTyping && (
                <span className={styles.typingPlaceholder} aria-hidden="true">
                  {activeTyping}
                  <span className={styles.cursor} />
                </span>
              )}
            </div>
          </div>

          {/* Bottom action bar */}
          <div className={styles.actionBar}>
            <div className={styles.actionLeft}>
              {/* Upload button */}
              <button
                type="button"
                className={styles.uploadBtn}
                onClick={handleUploadClick}
                aria-label="Upload files"
                disabled={disabled || isRunning}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M8 1v14M1 8h14" />
                </svg>
              </button>

              {/* Model selector */}
              <ModelSelector
                page={page}
                selectedModel={selectedModel}
                onModelSelect={handleModelSelect}
                placement={modelMenuPlacement}
              />

              {/* Uploaded file count badge */}
              {uploadedFiles.length > 0 && (
                <motion.span
                  className={styles.fileBadge}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                    <polyline points="13 2 13 9 20 9"/>
                  </svg>
                  {uploadedFiles.length}
                </motion.span>
              )}
            </div>

            <div className={styles.actionRight}>
              <div ref={thinkingRef} className={styles.thinkingMenuWrap}>
                <button
                  type="button"
                  className={styles.thinkingTrigger}
                  onClick={() => setThinkingOpen((open) => !open)}
                  aria-haspopup="listbox"
                  aria-expanded={thinkingOpen}
                  aria-label="Agent thinking level"
                  title={AGENT_THINKING_PROFILES[thinkingLevel].description}
                  disabled={disabled || isRunning}
                >
                  <span>{AGENT_THINKING_PROFILES[thinkingLevel].label}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                <AnimatePresence>
                  {thinkingOpen && (
                    <motion.div
                      className={`${styles.thinkingMenu} ${modelMenuPlacement === 'top' ? styles.thinkingMenuTop : ''}`}
                      role="listbox"
                      aria-label="Agent thinking level"
                      initial={{ opacity: 0, y: modelMenuPlacement === 'top' ? 6 : -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: modelMenuPlacement === 'top' ? 6 : -6, scale: 0.97 }}
                      transition={{ duration: 0.16, ease: [0.19, 1, 0.22, 1] }}
                    >
                      {(Object.keys(AGENT_THINKING_PROFILES) as AgentThinkingLevel[]).map((level) => {
                        const isSelected = level === thinkingLevel
                        return (
                          <button
                            key={level}
                            type="button"
                            className={`${styles.thinkingOption} ${isSelected ? styles.thinkingOptionSelected : ''}`}
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              setThinkingLevel(level)
                              setThinkingOpen(false)
                            }}
                          >
                            {AGENT_THINKING_PROFILES[level].label}
                          </button>
                        )
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Send button */}
              <motion.button
                type={isRunning ? 'button' : 'submit'}
                className={`${styles.submitBtn} ${isRunning ? styles.cancelBtn : ''}`}
                whileTap={{ scale: 0.95 }}
                disabled={disabled}
                onClick={isRunning ? handleCancelClick : undefined}
                aria-label={isRunning ? 'Cancel message' : 'Send message'}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={isRunning ? 'cancel' : 'send'}
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -10, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.19, 1, 0.22, 1] }}
                  >
                    {isRunning ? 'Stop' : 'Send'}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
