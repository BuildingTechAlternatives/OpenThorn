import { type FormEvent, useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import styles from './PromptInput.module.css'

interface PromptInputProps {
  size?: 'default' | 'small'
  onSubmit?: (prompt: string) => void
}

const prompts = [
  'Ask Bloom to build a landing page for my SaaS...',
  'Create a modern portfolio with a dark theme...',
  'Build an e-commerce store for my brand...',
  'Make a blog with a clean, minimal design...',
  'Design a dashboard with charts and analytics...',
  'Create a waitlist page for my startup...',
]

function useTypingAnimation(isFocused: boolean) {
  const [displayText, setDisplayText] = useState('')
  const [promptIndex, setPromptIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tick = useCallback(() => {
    const currentPrompt = prompts[promptIndex]

    if (!isDeleting) {
      // Typing forward
      if (displayText.length < currentPrompt.length) {
        const speed = 40 + Math.random() * 30 // 40-70ms per char, feels natural
        timeoutRef.current = setTimeout(() => {
          setDisplayText(currentPrompt.slice(0, displayText.length + 1))
        }, speed)
      } else {
        // Pause at end, then start deleting
        timeoutRef.current = setTimeout(() => {
          setIsDeleting(true)
        }, 2000)
      }
    } else {
      // Deleting
      if (displayText.length > 0) {
        const speed = 20 + Math.random() * 15 // faster delete, 20-35ms
        timeoutRef.current = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1))
        }, speed)
      } else {
        // Move to next prompt
        setIsDeleting(false)
        setPromptIndex((prev) => (prev + 1) % prompts.length)
      }
    }
  }, [displayText, isDeleting, promptIndex])

  useEffect(() => {
    if (isFocused) return // pause when user is typing
    timeoutRef.current = setTimeout(tick, isDeleting ? 200 : 400)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [tick, isFocused, isDeleting])

  // Reset when focus changes
  useEffect(() => {
    if (isFocused) {
      setDisplayText('')
      setIsDeleting(false)
    }
  }, [isFocused])

  return displayText
}

export default function PromptInput({ size = 'default', onSubmit }: PromptInputProps) {
  const [value, setValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const showTyping = !isFocused && value.length === 0
  const activeTyping = useTypingAnimation(showTyping)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (value.trim() && onSubmit) {
      onSubmit(value.trim())
    }
  }

  // Focus input when clicking the + button
  const handlePlusClick = () => {
    inputRef.current?.focus()
  }

  return (
    <form
      className={`${styles.wrapper} ${size === 'small' ? styles.small : ''}`}
      onSubmit={handleSubmit}
    >
      <div className={styles.card}>
        {/* + icon on the left */}
        <button
          type="button"
          className={styles.plusIcon}
          onClick={handlePlusClick}
          aria-label="Add attachment or focus input"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 1v12M1 7h12" />
          </svg>
        </button>

        {/* Input with typing animation overlay */}
        <div className={styles.inputWrapper}>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder=""
            aria-label="Describe your website idea"
          />
          {!value && !isFocused && (
            <span className={styles.typingPlaceholder} aria-hidden="true">
              {activeTyping}
              <span className={styles.cursor} />
            </span>
          )}
        </div>

        {/* Build button with animated text */}
        <motion.button
          type="submit"
          className={styles.submitBtn}
          whileTap={{ scale: 0.96 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key="build"
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.19, 1, 0.22, 1] }}
            >
              Build
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>
    </form>
  )
}
