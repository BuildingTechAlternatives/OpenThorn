import type { ReactNode, MouseEvent } from 'react'
import styles from './NeumorphButton.module.css'

interface NeumorphButtonProps {
  children: ReactNode
  href?: string
  onClick?: (e: MouseEvent) => void
}

export default function NeumorphButton({ children, href, onClick }: NeumorphButtonProps) {
  if (href) {
    return (
      <a href={href} className={styles.btn}>
        {children}
      </a>
    )
  }

  return (
    <button onClick={onClick} className={styles.btn}>
      {children}
    </button>
  )
}
