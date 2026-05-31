import { motion } from 'framer-motion'
import PromptInput from '../PromptInput/PromptInput'
import styles from './BottomCTA.module.css'

export default function BottomCTA() {
  return (
    <section className={styles.section}>
      <div className={styles.bgGlow} />
      <motion.div
        className={styles.content}
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
      >
        <h2 className={styles.title}>
          Ready to{' '}
          <span className={styles.titleAccent}>build</span>?
        </h2>
        <p className={styles.subtitle}>
          Start building now — no credit card, no subscription, no limits.
        </p>
        <div className={styles.inputWrapper}>
          <PromptInput size="small" />
        </div>
      </motion.div>
    </section>
  )
}
