import { type FormEvent, useState } from 'react'
import styles from './PromptInput.module.css'

interface PromptInputProps {
  size?: 'default' | 'small'
  onSubmit?: (prompt: string) => void
}

export default function PromptInput({ size = 'default', onSubmit }: PromptInputProps) {
  const [value, setValue] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (value.trim() && onSubmit) {
      onSubmit(value.trim())
    }
  }

  return (
    <form
      className={`${styles.wrapper} ${size === 'small' ? styles.small : ''}`}
      onSubmit={handleSubmit}
    >
      <div className={styles.card}>
        <span className={styles.leftIcon} aria-hidden="true">
          <SparkleIcon />
        </span>
        <input
          className={styles.input}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Describe the app or website you want to create..."
          aria-label="Describe your website idea"
        />
        <span className={styles.rightIcon} aria-label="Attach file" role="button" tabIndex={0}>
          <PaperclipIcon />
        </span>
        <button type="submit" className={styles.submitBtn}>
          <span>Build</span>
        </button>
      </div>
    </form>
  )
}

function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 0L12.5 7.5L20 10L12.5 12.5L10 20L7.5 12.5L0 10L7.5 7.5L10 0Z" fill="currentColor" opacity="0.8" />
    </svg>
  )
}

function PaperclipIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
  )
}
