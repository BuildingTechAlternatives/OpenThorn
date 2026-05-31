import { motion } from 'framer-motion'
import styles from './MeetBloomSection.module.css'

const steps = [
  {
    num: '1',
    title: 'Start with an idea',
    description:
      'Describe the app or website you want to create, or drop in screenshots and docs. Bloom understands your vision.',
  },
  {
    num: '2',
    title: 'Watch it come to life',
    description:
      'See your vision transform into a working prototype in real-time. Every component built by AI, visible as it happens.',
  },
  {
    num: '3',
    title: 'Refine and ship',
    description:
      'Iterate with simple feedback and deploy to the world with one click. No DevOps, no friction.',
  },
]

export default function MeetBloomSection() {
  return (
    <section className={styles.section}>
      <div className={styles.kicker}>Meet Bloom</div>
      <h2 className={styles.title}>
        From <span className={styles.titleItalic}>idea</span> to{' '}
        <span className={styles.titleItalic}>live</span> in minutes
      </h2>

      <div className={styles.steps}>
        {steps.map((step, i) => (
          <motion.div
            key={step.num}
            className={styles.stepCard}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{
              duration: 0.5,
              delay: i * 0.13,
              ease: [0.19, 1, 0.22, 1],
            }}
          >
            <div className={styles.stepNum}>
              <span className={styles.stepIcon}>
                {i === 0 && <BulbIcon />}
                {i === 1 && <EyeIcon />}
                {i === 2 && <RocketIcon />}
              </span>
            </div>
            <h3 className={styles.stepTitle}>{step.title}</h3>
            <p className={styles.stepDesc}>{step.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

function BulbIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function RocketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 012.81-4.81l.17-.19a22 22 0 013.84 3.84L12 15z" />
      <path d="M13.5 4.5A22 22 0 0019 2s-1.5 4-3 6.5M9 17.5V21l3-3M15 10.5V5l-3 3" />
    </svg>
  )
}
