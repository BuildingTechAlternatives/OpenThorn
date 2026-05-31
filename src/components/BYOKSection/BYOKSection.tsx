import { motion } from 'framer-motion'
import styles from './BYOKSection.module.css'

const features = [
  {
    title: 'Bring your own keys',
    description:
      'Connect OpenAI, Anthropic, Google, or any provider. Use the models you already pay for.',
    icon: KeyCardIcon,
  },
  {
    title: 'Zero platform markup',
    description:
      'Unlike Lovable or Base44, Bloom charges no subscription or hidden fees. Pay only what the provider charges.',
    icon: ZeroIcon,
  },
  {
    title: 'Full data privacy',
    description:
      'Everything runs in your browser. Your keys, your data, your code — full sovereignty.',
    icon: PrivacyIcon,
  },
]

export default function BYOKSection() {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
        >
          <div className={styles.kicker}>Why Bloom</div>
          <h2 className={styles.title}>
            Your keys,{' '}
            <span className={styles.titleItalic}>your control</span>
          </h2>
          <p className={styles.bodyText}>
            Most AI website builders lock you into expensive subscriptions.
            <span className={styles.bodyHighlight}> Bloom is different.</span> It's BYOK —
            bring your own keys, pay only for what you use, and keep full ownership of your stack.
          </p>
        </motion.div>

        <motion.div
          className={styles.grid}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1], delay: 0.1 }}
        >
          {features.map((feature) => (
            <div key={feature.title} className={styles.card}>
              <div className={styles.cardIcon}>
                <feature.icon />
              </div>
              <h3 className={styles.cardTitle}>{feature.title}</h3>
              <p className={styles.cardDesc}>{feature.description}</p>
            </div>
          ))}
        </motion.div>

        <motion.p
          className={styles.footnote}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          The only AI website builder that puts you in control of your stack.
        </motion.p>
      </div>
    </section>
  )
}

function KeyCardIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  )
}

function ZeroIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01M15 9h.01" />
    </svg>
  )
}

function PrivacyIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}
