import { useState, useEffect, useCallback, startTransition } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import styles from './ReelCarousel.module.css'

const FALLBACK_IMAGE = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><rect width="800" height="450" fill="#14101C"/><text x="400" y="225" text-anchor="middle" dominant-baseline="central" fill="#5F5968" font-family="sans-serif" font-size="16">Image unavailable</text></svg>'
)

export interface CarouselSlide {
  image: string
  title: string
  description: string
  tag?: string
}

interface ReelCarouselProps {
  slides?: CarouselSlide[]
  autoPlaySpeed?: number
  pauseOnHover?: boolean
  showArrows?: boolean
  showDots?: boolean
}

const bloomSlides: CarouselSlide[] = [
  {
    image: '/assets/input_box.png',
    tag: 'Step 01',
    title: 'Describe what you need',
    description:
      'Tell OpenThorn what you\'re building — a storefront, a dashboard, a blog. Plain English is all it takes.',
  },
  {
    image: '/assets/project_page.png',
    tag: 'Step 02',
    title: 'See it take shape',
    description:
      'OpenThorn generates real components and styles live — every file visible as it\'s written.',
  },
  {
    image: '/assets/deployed.png',
    tag: 'Step 03',
    title: 'Edit and publish',
    description:
      'Refine anything in the builder, then deploy to your domain or export to your own repo.',
  },
]

const textVariants: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, y: -10, transition: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] } },
}

const imageVariants: Variants = {
  initial: { opacity: 0, scale: 1.015 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, transition: { duration: 0.25 } },
}

export default function ReelCarousel({
  slides = bloomSlides,
  autoPlaySpeed = 5000,
  pauseOnHover = true,
}: ReelCarouselProps) {
  const [current, setCurrent] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const total = slides.length

  const jumpTo = useCallback((index: number) => {
    startTransition(() => {
      setCurrent(index)
      setProgress(0)
    })
  }, [])

  useEffect(() => {
    if (isPaused) return
    setProgress(0)
    const start = performance.now()
    let rafId: number
    const tick = (now: number) => {
      const p = Math.min(((now - start) / autoPlaySpeed) * 100, 100)
      setProgress(p)
      if (p < 100) {
        rafId = requestAnimationFrame(tick)
      } else {
        startTransition(() => setCurrent((prev) => (prev + 1) % total))
      }
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [isPaused, autoPlaySpeed, current, total])

  const slide = slides[current]
  if (!slide) return null

  return (
    <div
      className={styles.root}
      onMouseEnter={() => pauseOnHover && setIsPaused(true)}
      onMouseLeave={() => pauseOnHover && setIsPaused(false)}
    >
      {/* Left: text + step nav */}
      <div className={styles.left}>
        <div className={styles.textArea}>
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              variants={textVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {slide.tag && <span className={styles.stepTag}>{slide.tag}</span>}
              <h3 className={styles.title}>{slide.title}</h3>
              <p className={styles.desc}>{slide.description}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <nav className={styles.stepNav}>
          {slides.map((s, i) => (
            <button
              key={i}
              className={`${styles.stepBtn} ${i === current ? styles.stepBtnActive : ''}`}
              onClick={() => jumpTo(i)}
              aria-label={`Go to ${s.tag || `step ${i + 1}`}`}
            >
              <div className={styles.stepTrack}>
                <div
                  className={styles.stepFill}
                  style={{
                    width: i === current ? `${progress}%` : i < current ? '100%' : '0%',
                  }}
                />
              </div>
              <span className={styles.stepName}>{s.tag || `Step ${i + 1}`}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Right: browser frame + screenshot */}
      <div className={styles.right}>
        <div className={styles.browserFrame}>
          <div className={styles.browserChrome}>
            <div className={styles.chromeDots}>
              <span className={styles.chromeDot} />
              <span className={styles.chromeDot} />
              <span className={styles.chromeDot} />
            </div>
            <div className={styles.chromeBar} />
          </div>
          <div className={styles.imageWrap}>
            <AnimatePresence mode="wait">
              <motion.img
                key={current}
                className={styles.slideImage}
                src={slide.image}
                alt={slide.title}
                loading="lazy"
                variants={imageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE }}
              />
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
