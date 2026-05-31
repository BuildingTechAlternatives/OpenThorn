import { motion } from 'framer-motion'
import PromptInput from '../PromptInput/PromptInput'
import styles from './HeroSection.module.css'

const trustItems = [
  'Configure your own API keys',
  'No hidden costs, no ads',
  'Full control, full privacy',
]

export default function HeroSection() {
  return (
    <section className={styles.section}>
      <div className={styles.bgGrid} />
      <div className={styles.bgGlow} />

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

        {/* Headline */}
        <h1 className={styles.headline}>
          <span style={{ display: 'block', overflow: 'hidden', marginBottom: '-0.04em' }}>
            <motion.span
              style={{ display: 'block' }}
              initial={{ y: '105%' }}
              animate={{ y: '0%' }}
              transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1], delay: 0.15 }}
            >
              Build with{' '}
            </motion.span>
          </span>
          <span style={{ display: 'block', overflow: 'hidden' }}>
            <motion.span
              style={{ display: 'block' }}
              initial={{ y: '105%' }}
              animate={{ y: '0%' }}
              transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1], delay: 0.25 }}
            >
              <span className={styles.headlineAccent}>Bloom</span>
            </motion.span>
          </span>
        </h1>

        {/* Subtitle */}
        <motion.p
          className={styles.subtitle}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1], delay: 0.5 }}
        >
          Create beautiful websites by talking to AI. Describe your idea —
          Bloom builds it, and you ship it.
        </motion.p>

        {/* Big input */}
        <motion.div
          className={styles.inputWrapper}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1], delay: 0.6 }}
        >
          <PromptInput />
        </motion.div>

        {/* Trust */}
        <motion.div
          className={styles.trust}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.9 }}
        >
          {trustItems.map((item) => (
            <span key={item} className={styles.trustItem}>
              <span className={styles.trustDot} />
              {item}
            </span>
          ))}
        </motion.div>
      </div>

      {/* Scroll hint */}
      <motion.div
        className={styles.scrollHint}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3, duration: 0.5 }}
        aria-hidden="true"
      >
        <div className={styles.scrollHintLine} />
      </motion.div>
    </section>
  )
}
