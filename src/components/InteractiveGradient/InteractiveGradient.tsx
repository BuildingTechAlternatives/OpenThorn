import { useEffect, useRef, type ComponentProps } from 'react'
import {
  motion,
  useMotionValue,
  useTransform,
  useSpring,
  useMotionTemplate,
  animate,
  useReducedMotion,
} from 'framer-motion'
import styles from './InteractiveGradient.module.css'

interface InteractiveGradientProps {
  color1?: string
  color2?: string
  color3?: string
  orbitRadius?: number
  loopDuration?: number
  followStrength?: number
  blur?: number
  brightness?: number
  isStatic?: boolean
  className?: string
  style?: ComponentProps<'div'>['style']
}

export default function InteractiveGradient({
  color1 = '#A78BFA',
  color2 = '#7B61FF',
  color3 = '#6366F1',
  orbitRadius = 26,
  loopDuration = 18,
  followStrength = 0.35,
  blur = 70,
  brightness = 0.95,
  isStatic = false,
  className,
  style,
}: InteractiveGradientProps) {
  const prefersReducedMotion = useReducedMotion()
  const reduce = Boolean(prefersReducedMotion) || isStatic
  const rectRef = useRef<DOMRect | null>(null)
  const overScanRef = useRef(12)
  const isHovering = useRef(false)

  // Phase — drives orbital motion for layer 2 and 3
  const phase = useMotionValue(0)

  // Pointer position — raw values 0–100
  const pointerX = useMotionValue(50)
  const pointerY = useMotionValue(50)

  // Spring-smoothed pointer
  const pX = useSpring(pointerX, { stiffness: 200, damping: 28, mass: 0.8 })
  const pY = useSpring(pointerY, { stiffness: 200, damping: 28, mass: 0.8 })

  // Layer 1 — follows pointer
  const x1 = useTransform(pX, (v) => 50 + (v - 50) * followStrength)
  const y1 = useTransform(pY, (v) => 50 + (v - 50) * followStrength)

  // Layer 2 — orbits with phase
  const x2 = useTransform(phase, (p) => 50 + Math.cos(p) * orbitRadius)
  const y2 = useTransform(phase, (p) => 50 + Math.sin(p) * orbitRadius)

  // Layer 3 — orbits with phase + 120° offset
  const x3 = useTransform(phase, (p) => 50 + Math.cos(p + Math.PI * 2 / 3) * orbitRadius)
  const y3 = useTransform(phase, (p) => 50 + Math.sin(p + Math.PI * 2 / 3) * orbitRadius)

  // Dynamic gradient string
  const gradient = useMotionTemplate`
    radial-gradient(circle at ${x1}% ${y1}%, ${color1} 0%, ${color1} 22%, rgba(0,0,0,0) 60%),
    radial-gradient(circle at ${x2}% ${y2}%, ${color2} 0%, ${color2} 22%, rgba(0,0,0,0) 60%),
    radial-gradient(circle at ${x3}% ${y3}%, ${color3} 0%, ${color3} 22%, rgba(0,0,0,0) 60%)
  `

  // Phase animation loop
  useEffect(() => {
    if (reduce) return
    const controls = animate(phase, Math.PI * 2, {
      duration: loopDuration,
      ease: 'linear',
      repeat: Infinity,
    })
    return () => controls.stop()
  }, [phase, loopDuration, reduce])

  // Pointer handlers
  function updatePointer(clientX: number, clientY: number) {
    if (!rectRef.current) return
    const rect = rectRef.current
    const x = ((clientX - rect.left) / rect.width) * 100
    const y = ((clientY - rect.top) / rect.height) * 100
    pointerX.set(Math.max(0, Math.min(100, x)))
    pointerY.set(Math.max(0, Math.min(100, y)))
  }

  function triggerPointerReturn() {
    isHovering.current = false
    animate(pointerX, 50, { duration: 0.35, ease: 'easeOut' })
    animate(pointerY, 50, { duration: 0.35, ease: 'easeOut' })
  }

  function handlePointerEnter(e: React.PointerEvent) {
    if (reduce) return
    const el = e.currentTarget
    rectRef.current = el.getBoundingClientRect()
    isHovering.current = true
    const rect = rectRef.current
    pointerX.set(((e.clientX - rect.left) / rect.width) * 100)
    pointerY.set(((e.clientY - rect.top) / rect.height) * 100)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (reduce) return
    updatePointer(e.clientX, e.clientY)
  }

  function handlePointerLeave() {
    if (reduce) return
    triggerPointerReturn()
  }

  // Global pointer listener for overscan
  useEffect(() => {
    if (reduce) return

    function handleGlobalMove(e: PointerEvent) {
      if (!rectRef.current || !isHovering.current) return
      const rect = rectRef.current
      const os = overScanRef.current
      const expanded = {
        left: rect.left - os,
        right: rect.right + os,
        top: rect.top - os,
        bottom: rect.bottom + os,
      }
      if (
        e.clientX < expanded.left ||
        e.clientX > expanded.right ||
        e.clientY < expanded.top ||
        e.clientY > expanded.bottom
      ) {
        triggerPointerReturn()
        rectRef.current = null
        window.removeEventListener('pointermove', handleGlobalMove)
      } else {
        updatePointer(e.clientX, e.clientY)
      }
    }

    window.addEventListener('pointermove', handleGlobalMove)
    return () => window.removeEventListener('pointermove', handleGlobalMove)
  }, [reduce])

  return (
    <div className={`${styles.container} ${className ?? ''}`} style={style}>
      <motion.div
        className={styles.gradient}
        style={{
          background: gradient,
          filter: `blur(${blur}px) brightness(${brightness})`,
        }}
        onPointerEnter={reduce || isStatic ? undefined : handlePointerEnter}
        onPointerMove={reduce || isStatic ? undefined : handlePointerMove}
        onPointerLeave={reduce || isStatic ? undefined : handlePointerLeave}
      />
    </div>
  )
}
