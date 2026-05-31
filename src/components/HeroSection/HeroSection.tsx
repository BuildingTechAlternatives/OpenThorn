import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import PromptInput from '../PromptInput/PromptInput'
import styles from './HeroSection.module.css'

const trustItems = [
  'Configure your own API keys',
  'No hidden costs, no ads',
  'Full control, full privacy',
]

export default function HeroSection() {
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })
  const glowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      if (!glowRef.current) return
      const rect = glowRef.current.getBoundingClientRect()
      setMousePos({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      })
    }
    window.addEventListener('mousemove', handleMouse, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouse)
  }, [])

  return (
    <section className={styles.section}>
      {/* Background */}
      <div className={styles.bgGrid} />
      <div
        ref={glowRef}
        className={styles.bgGlow}
        style={{
          transform: `translate(${(mousePos.x - 0.5) * 30}px, ${(mousePos.y - 0.5) * 30}px)`,
          transition: 'transform 1.5s cubic-bezier(0.17, 0.55, 0.55, 1)',
        }}
      />

      <div className={styles.content}>
        {/* Kicker */}
        <motion.div
          className={styles.kicker}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1], delay: 0.1 }}
        >
          <span className={styles.kickerLine} />
          BYOK AI Website Builder
        </motion.div>

        {/* Headline — clip-path reveal instead of fade */}
        <motion.h1
          className={styles.headline}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <span style={{ display: 'block', overflow: 'hidden' }}>
            <motion.span
              style={{ display: 'block' }}
              initial={{ y: '105%' }}
              animate={{ y: '0%' }}
              transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1], delay: 0.2 }}
            >
              <span className={styles.headlineBold}>Build</span>{' '}
              <span className={styles.headlineItalic}>with</span>
            </motion.span>
          </span>
          <span style={{ display: 'block', overflow: 'hidden' }}>
            <motion.span
              style={{ display: 'block' }}
              initial={{ y: '105%' }}
              animate={{ y: '0%' }}
              transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1], delay: 0.3 }}
            >
              <span className={styles.headlineAccent}>Bloom</span>
            </motion.span>
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className={styles.subtitle}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1], delay: 0.5 }}
        >
          Create beautiful websites just by talking to AI. Describe what you want
          and watch it come to life — no coding required.
        </motion.p>

        {/* Input — springs in from below */}
        <motion.div
          className={styles.inputWrapper}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1], delay: 0.6 }}
        >
          <PromptInput />
        </motion.div>

        {/* Trust — subtle rule with text, no pills */}
        <motion.div
          className={styles.trust}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.9 }}
        >
          {trustItems.map((item) => (
            <span key={item} className={styles.trustItem}>
              <span className={styles.trustDot} />
              {item}
            </span>
          ))}
        </motion.div>
      </div>

      {/* Scroll hint — right edge */}
      <motion.div
        className={styles.scrollHint}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
      >
        <span className={styles.scrollHintText}>Scroll</span>
        <div className={styles.scrollHintLine} />
      </motion.div>
    </section>
  )
}
