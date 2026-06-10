import { motion } from 'framer-motion'
import PromptInput from '../PromptInput/PromptInput'
import BtaMark from '../BtaMark/BtaMark'
import FloatingParticles from '../FloatingParticles/FloatingParticles'
import styles from './HeroSection.module.css'

const valueProps = [
  { icon: 'key', label: 'Own your keys', detail: 'any provider' },
  { icon: 'meter', label: 'No platform markup', detail: 'usage pricing only' },
  { icon: 'code', label: 'Export real code', detail: 'your repo, your infra' },
]

export default function HeroSection() {
  return (
    <section className={styles.section}>
      <FloatingParticles
        particleCount={42}
        particleSize={2.5}
        particleOpacity={0.38}
        particleColor="#A78BFA"
        glowIntensity={14}
        movementSpeed={0.35}
        mouseInfluence={140}
        mouseGravity="attract"
        gravityStrength={32}
        glowAnimation="ease"
      />

      <div className={styles.content}>
        {/* Ornament */}
        <motion.div
          className={styles.ornament}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1], delay: 0.05 }}
        >
          <span className={styles.ornamentLine} />
          <span className={styles.ornamentDot} />
          <span className={styles.ornamentLine} />
        </motion.div>

        {/* Headline — single line, white, Roboto */}
        <motion.h1
          className={styles.headline}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.19, 1, 0.22, 1], delay: 0.15 }}
        >
          Build with OpenThorn
          <span className={styles.byline}>
            by
            <BtaMark className={styles.bylineMark} />
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className={styles.subtitle}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1], delay: 0.4 }}
        >
          Just describe what you want and OpenThorn generates the code —
          ready to customize and deploy anywhere.
        </motion.p>

        {/* Big input */}
        <motion.div
          className={styles.inputWrapper}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1], delay: 0.55 }}
        >
          <PromptInput page="landing" />
        </motion.div>

        {/* Value props */}
        <motion.div
          className={styles.valueProps}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.65 }}
        >
          {valueProps.map((prop) => (
            <span key={prop.label} className={styles.valueItem}>
              <span className={styles.valueIcon} aria-hidden="true">
                <ValueIcon name={prop.icon} />
              </span>
              <span className={styles.valueDetail}>{prop.detail}</span>
              <span className={styles.valueLabel}>{prop.label}</span>
            </span>
          ))}
        </motion.div>
      </div>

      {/* Scroll hint */}
      <motion.div
        className={styles.scrollHint}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.5 }}
        aria-hidden="true"
      >
        <div className={styles.scrollHintLine} />
      </motion.div>
    </section>
  )
}

function ValueIcon({ name }: { name: string }) {
  if (name === 'key') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7.5" cy="14.5" r="4.5" />
        <path d="M11 11l8-8 2 2-2 2 2 2-2 2-2-2-4 4" />
      </svg>
    )
  }

  if (name === 'meter') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19a8 8 0 1116 0" />
        <path d="M12 19l4-7" />
        <path d="M12 5v2M6.8 7.8l1.4 1.4M18.2 7.8l-1.4 1.4" />
      </svg>
    )
  }

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 18l6-6-6-6" />
      <path d="M8 6l-6 6 6 6" />
      <path d="M14 4l-4 16" />
    </svg>
  )
}
