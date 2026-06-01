import { type FormEvent, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/AuthContext'
import styles from './PromptInput.module.css'

interface PromptInputProps {
  size?: 'default' | 'small'
  defaultValue?: string
  onSubmit?: (prompt: string) => void
}

const prompts = [
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
      const currentPrompt = prompts[s.promptIndex]

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
          stateRef.current.promptIndex = (s.promptIndex + 1) % prompts.length
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
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync internal value when defaultValue changes (e.g. example chip click)
  useEffect(() => {
    if (defaultValue !== undefined) {
      setInternalValue(defaultValue)
    }
  }, [defaultValue])

  const showTyping = !isFocused && internalValue.length === 0
  const activeTyping = useTypingAnimation(showTyping)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const prompt = internalValue.trim() || activeTyping || undefined

    if (onSubmit && prompt) {
      onSubmit(prompt)
      return
    }

    // Auth gate: if not logged in, open sign-in modal; otherwise go to dashboard
    if (!user) {
      window.dispatchEvent(new CustomEvent('bloom:require-auth'))
    } else {
      navigate('/dashboard')
    }
  }

  const handlePlusClick = () => {
    inputRef.current?.focus()
  }

  return (
    <form
      className={`${styles.wrapper} ${size === 'small' ? styles.small : ''}`}
      onSubmit={handleSubmit}
    >
      <div className={styles.card}>
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

        <div className={styles.inputWrapper}>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            value={internalValue}
            onChange={(e) => setInternalValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder=""
            aria-label="Describe your website idea"
          />
          {!internalValue && !isFocused && (
            <span className={styles.typingPlaceholder} aria-hidden="true">
              {activeTyping}
              <span className={styles.cursor} />
            </span>
          )}
        </div>

        <motion.button
          type="submit"
          className={styles.submitBtn}
          whileTap={{ scale: 0.96 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key="generate"
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.19, 1, 0.22, 1] }}
            >
              Generate
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>
    </form>
  )
}
