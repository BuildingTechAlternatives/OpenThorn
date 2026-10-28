import { lazy, Suspense, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReelCarousel from '../ReelCarousel/ReelCarousel'
import styles from './MeetOpenThornSection.module.css'

// Heavy (pulls in esbuild-wasm for the live preview) — only loaded on click.
const LandingTemplateDemo = lazy(() => import('../LandingTemplateDemo/LandingTemplateDemo'))

// Lightweight button metadata only — the modal resolves the full template.
const TEMPLATE_BUTTONS = [
  { id: 'creative-portfolio', name: 'Portfolio' },
  { id: 'saas-landing', name: 'SaaS Landing' },
  { id: 'ecommerce-storefront', name: 'E-commerce' },
  { id: 'photography-studio', name: 'Photography' },
  { id: 'restaurant-landing', name: 'Restaurant' },
  { id: 'tech-blog', name: 'Blog' },
]

export default function MeetOpenThornSection() {
  const [activeId, setActiveId] = useState<string | null>(null)

  return (
    <section className={styles.section}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
      >
        <div className={styles.kicker}>How OpenThorn works</div>
        <h2 className={styles.title}>
          From <span className={styles.titleItalic}>prompt</span> to{' '}
          <span className={styles.titleItalic}>production</span>
        </h2>
      </motion.div>

      <motion.div
        className={styles.carouselWrapper}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.19, 1, 0.22, 1] }}
      >
        <ReelCarousel showDots />
      </motion.div>

      <motion.div
        className={styles.tryArea}
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.19, 1, 0.22, 1] }}
      >
        <h3 className={styles.tryTitle}>See it build, live</h3>
        <div className={styles.tryButtons}>
          {TEMPLATE_BUTTONS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={styles.tryButton}
              onClick={() => setActiveId(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
      </motion.div>

      <AnimatePresence>
        {activeId && (
          <Suspense fallback={null}>
            <LandingTemplateDemo templateId={activeId} onClose={() => setActiveId(null)} />
          </Suspense>
        )}
      </AnimatePresence>
    </section>
  )
}
