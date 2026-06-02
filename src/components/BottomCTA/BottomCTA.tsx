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
        <div className={styles.copy}>
          <div className={styles.kicker}>Build before the idea cools</div>
          <h2 className={styles.title}>
            Turn the next rough prompt into a working app.
          </h2>
          <p className={styles.subtitle}>
            Skip the platform tax and keep momentum: bring your model keys, generate real code, and ship from your own repo.
          </p>
          <div className={styles.proofRow} aria-label="Bloom advantages">
            <span>BYOK pricing</span>
            <span>GitHub export</span>
            <span>No subscription wall</span>
          </div>
        </div>

        <div className={styles.actionPanel}>
          <div className={styles.panelTopline}>Start with one sentence</div>
          <div className={styles.inputWrapper}>
            <PromptInput size="small" />
          </div>
        </div>
      </motion.div>
    </section>
  )
}
