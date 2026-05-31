import { useRef } from 'react'
import { motion, useScroll, useSpring } from 'framer-motion'
import styles from './MeetBloomSection.module.css'

const steps = [
  {
    num: '01',
    title: 'Start with an idea',
    description:
      'Describe the app or website you want to create, or drop in screenshots and docs. Bloom understands your vision and plans the architecture.',
    icon: BulbIcon,
  },
  {
    num: '02',
    title: 'Watch it come to life',
    description:
      'See your vision transform into a working prototype in real-time. Every component, every style — built by AI, visible as it happens.',
    icon: EyeIcon,
  },
  {
    num: '03',
    title: 'Refine and ship',
    description:
      'Iterate with simple natural-language feedback. When it\'s ready, deploy to the world with one click. No DevOps, no friction.',
    icon: RocketIcon,
  },
]

export default function MeetBloomSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start 70%', 'end 100%'],
  })
  const lineScale = useSpring(scrollYProgress, { stiffness: 100, damping: 30 })

  return (
    <section className={styles.section} ref={sectionRef}>
      <div className={styles.kicker}>How it works</div>
      <h2 className={styles.title}>
        From <span className={styles.titleStrong}>idea</span> to{' '}
        <span className={styles.titleStrong}>live</span> in minutes
      </h2>

      <div className={styles.timeline}>
        {/* Animated progress line */}
        <motion.div
          className={styles.stepProgress}
          style={{ scaleY: lineScale, transformOrigin: 'top' }}
        />

        {steps.map((step, i) => (
          <motion.div
            key={step.num}
            className={styles.step}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{
              duration: 0.5,
              delay: i * 0.12,
              ease: [0.19, 1, 0.22, 1],
            }}
          >
            {/* Timeline dot */}
            <div className={styles.stepDot} style={{ position: 'absolute' }} />

            {/* Number */}
            <div className={styles.stepNum}>{step.num}</div>

            {/* Content */}
            <div className={styles.stepContent}>
              <div className={styles.stepIcon}>
                <step.icon />
              </div>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDesc}>{step.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

function BulbIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function RocketIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 012.81-4.81l.17-.19a22 22 0 013.84 3.84L12 15z" />
      <path d="M13.5 4.5A22 22 0 0019 2s-1.5 4-3 6.5M9 17.5V21l3-3M15 10.5V5l-3 3" />
    </svg>
  )
}
