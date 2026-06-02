import { type FormEvent, useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/AuthContext'
import ModelSelector, { type SelectedModel } from '../ModelSelector/ModelSelector'
import styles from './PromptInput.module.css'

interface PromptInputProps {
  size?: 'default' | 'small'
  defaultValue?: string
  onSubmit?: (prompt: string) => void
  page?: 'landing' | 'dashboard'
  disableTyping?: boolean
  placeholder?: string
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
  onSubmit,
  page = 'landing',
  disableTyping = false,
  placeholder = '',
}: PromptInputProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [internalValue, setInternalValue] = useState(defaultValue ?? '')
  const [isFocused, setIsFocused] = useState(false)
  const [selectedModel, setSelectedModel] = useState<SelectedModel | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync when defaultValue changes (example chip click)
  useEffect(() => {
    if (defaultValue !== undefined) {
      setInternalValue(defaultValue)
    }
  }, [defaultValue])

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

  const showTyping = !disableTyping && !isFocused && internalValue.length === 0
  const activeTyping = useTypingAnimation(showTyping)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInternalValue(e.target.value)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const prompt = internalValue.trim() || activeTyping || undefined

    if (onSubmit && prompt) {
      onSubmit(prompt)
      return
    }

    if (!user) {
      window.dispatchEvent(new CustomEvent('bloom:require-auth'))
    } else {
      navigate('/dashboard')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
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
              {/* Send button */}
              <motion.button
                type="submit"
                className={styles.submitBtn}
                whileTap={{ scale: 0.95 }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key="send"
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -10, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.19, 1, 0.22, 1] }}
                  >
                    Send
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
