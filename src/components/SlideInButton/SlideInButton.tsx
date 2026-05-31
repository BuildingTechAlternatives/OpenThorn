import type { ReactNode, MouseEvent } from 'react'
import styles from './SlideInButton.module.css'

interface SlideInButtonProps {
  children: ReactNode
  href?: string
  onClick?: (e: MouseEvent) => void
}

export default function SlideInButton({ children, href, onClick }: SlideInButtonProps) {
  const isLink = !!href

  if (isLink) {
    return (
      <a href={href} className={styles.btn}>
        <span className={styles.fill} />
        <span className={styles.text}>{children}</span>
        <span className={styles.icon}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </span>
      </a>
    )
  }

  return (
    <button onClick={onClick} className={styles.btn}>
      <span className={styles.fill} />
      <span className={styles.text}>{children}</span>
      <span className={styles.icon}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </span>
    </button>
  )
}
