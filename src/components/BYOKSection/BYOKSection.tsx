import { motion } from 'framer-motion'
import Carousel3D from '../Carousel3D/Carousel3D'
import type { Carousel3DCard } from '../Carousel3D/Carousel3D'
import styles from './BYOKSection.module.css'

const featureCards: Carousel3DCard[] = [
  {
    icon: <KeyIcon />,
    title: 'Bring your own keys',
    description: 'Hook up OpenAI, Anthropic, Gemini - whatever you use. OpenThorn uses your keys only for requests you make.',
  },
  {
    icon: <DollarIcon />,
    title: 'Zero platform tax',
    description: 'No subscription, no per-request markup. You pay providers directly and keep what you save.',
  },
  {
    icon: <CodeIcon />,
    title: 'Your code, your repo',
    description: 'Export everything to GitHub, deploy to your own Vercel account. There is no OpenThorn lock-in.',
  },
  {
    icon: <SparkIcon />,
    title: 'Real code, real time',
    description: 'OpenThorn writes production-grade code - not a drag-and-drop approximation. Watch every file appear.',
  },
  {
    icon: <GlobeIcon />,
    title: 'Deploy in one click',
    description: 'From prompt to production in under a minute. Push live when you\'re ready, not when a plan allows.',
  },
]

export default function BYOKSection() {
  return (
    <section className={styles.section}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
      >
        <div className={styles.kicker}>Why OpenThorn</div>
        <h2 className={styles.title}>
          Your keys,{' '}
          your control
        </h2>
        <p className={styles.bodyText}>
          Most AI website builders bundle the AI cost and mark it up behind
          a subscription you can't escape.
          <span className={styles.bodyHighlight}> OpenThorn is different.</span> You
          bring your own AI keys, pay providers directly, and keep every line
          of code. No vendor lock-in, no recurring tax on your creativity.
        </p>
      </motion.div>

      <motion.div
        className={styles.carouselArea}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        <Carousel3D
          cards={featureCards}
          rotateSpeed={30}
          translateZ={340}
          cardWidth={210}
          cardHeight={160}
          borderRadius={16}
        />
      </motion.div>

    </section>
  )
}

function KeyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  )
}
function DollarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  )
}
function CodeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  )
}
function SparkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6.4-4.8-6.4 4.8 2.4-7.2-6-4.8h7.6z" />
    </svg>
  )
}
function GlobeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  )
}
