import { type FormEvent, useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/AuthContext'
import styles from './PromptInput.module.css'

interface PromptInputProps {
  size?: 'default' | 'small'
  defaultValue?: string
  onSubmit?: (prompt: string) => void
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

export default function PromptInput({ size = 'default', defaultValue, onSubmit }: PromptInputProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [internalValue, setInternalValue] = useState(defaultValue ?? '')
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  const showTyping = !isFocused && internalValue.length === 0
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

  const handlePlusClick = () => {
    textareaRef.current?.focus()
  }

  return (
    <form
      className={`${styles.wrapper} ${size === 'small' ? styles.small : ''}`}
      onSubmit={handleSubmit}
    >
      <div className={`${styles.card} ${isFocused ? styles.cardFocused : ''}`}>
        {/* Input area */}
        <div className={styles.inputArea}>
          {/* + button */}
          <button
            type="button"
            className={styles.plusBtn}
            onClick={handlePlusClick}
            aria-label="Focus input"
            tabIndex={-1}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M8 1v14M1 8h14" />
            </svg>
          </button>

          {/* Textarea with typing placeholder */}
          <div className={styles.textareaWrapper}>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              value={internalValue}
              onChange={handleChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder=""
              rows={1}
              aria-label="Describe your website idea"
            />
            {!internalValue && !isFocused && (
              <span className={styles.typingPlaceholder} aria-hidden="true">
                {activeTyping}
                <span className={styles.cursor} />
              </span>
            )}
          </div>

          {/* Generate button */}
          <motion.button
            type="submit"
            className={styles.submitBtn}
            whileTap={{ scale: 0.95 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key="generate"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.19, 1, 0.22, 1] }}
              >
                Generate
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </form>
  )
}
