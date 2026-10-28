import { useRef, useEffect, useCallback } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  baseOpacity: number
  mass: number
  glowMultiplier: number
}

interface FloatingParticlesProps {
  particleCount?: number
  particleSize?: number
  particleOpacity?: number
  particleColor?: string
  backgroundColor?: string
  glowIntensity?: number
  movementSpeed?: number
  mouseInfluence?: number
  mouseGravity?: 'none' | 'attract' | 'repel'
  gravityStrength?: number
  glowAnimation?: 'instant' | 'ease' | 'spring'
  className?: string
}

export default function FloatingParticles({
  particleCount = 60,
  particleSize = 2.5,
  particleOpacity = 0.6,
  particleColor = '#A78BFA',
  backgroundColor = 'transparent',
  glowIntensity = 12,
  movementSpeed = 0.5,
  mouseInfluence = 120,
  mouseGravity = 'attract',
  gravityStrength = 40,
  glowAnimation: glowMode = 'ease',
  className,
}: FloatingParticlesProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const mouseRef = useRef<{ x: number; y: number; inCanvas: boolean }>({ x: 0, y: 0, inCanvas: false })
  const animRef = useRef<number>(0)
  const dimsRef = useRef({ w: 0, h: 0 })

  const initParticles = useCallback(
    (w: number, h: number) => {
      const arr: Particle[] = []
      for (let i = 0; i < particleCount; i++) {
        arr.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * movementSpeed,
          vy: (Math.random() - 0.5) * movementSpeed,
          size: Math.random() * particleSize + 1,
          opacity: particleOpacity,
          baseOpacity: particleOpacity,
          mass: Math.random() * 0.5 + 0.5,
          glowMultiplier: 1,
        })
      }
      particlesRef.current = arr
    },
    [particleCount, particleSize, particleOpacity, movementSpeed],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Sizing
    const resize = () => {
      const rect = container.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      dimsRef.current = { w, h }
      canvas.width = w * window.devicePixelRatio
      canvas.height = h * window.devicePixelRatio
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      initParticles(w, h)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    window.addEventListener('resize', resize)

    // Mouse tracking
    const handleMouse = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const inCanvas = x >= 0 && x <= rect.width && y >= 0 && y <= rect.height
      mouseRef.current = { x, y, inCanvas }
    }
    window.addEventListener('mousemove', handleMouse)

    // Animation loop
    const animate = () => {
      const { w, h } = dimsRef.current
      const particles = particlesRef.current
      const mouse = mouseRef.current

      // Update
      for (const p of particles) {
        // Movement + damping
        p.x += p.vx
        p.y += p.vy
        p.vx += (Math.random() - 0.5) * 0.002
        p.vy += (Math.random() - 0.5) * 0.002
        p.vx *= 0.999
        p.vy *= 0.999

        // Boundary wrap
        if (p.x < 0) p.x = w
        if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h
        if (p.y > h) p.y = 0

        // Mouse interaction
        if (mouse.inCanvas && mouseGravity !== 'none') {
          const dx = mouse.x - p.x
          const dy = mouse.y - p.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < mouseInfluence) {
            const force = (mouseInfluence - dist) / mouseInfluence
            const gf = force * (gravityStrength * 0.001)
            const nx = dx / (dist || 1)
            const ny = dy / (dist || 1)

            if (mouseGravity === 'attract') {
              p.vx += nx * gf
              p.vy += ny * gf
            } else {
              p.vx -= nx * gf
              p.vy -= ny * gf
            }

            // Glow near mouse
            const targetGlow = 1 + force * 2
            if (glowMode === 'instant') {
              p.glowMultiplier = targetGlow
            } else if (glowMode === 'ease') {
              p.glowMultiplier += (targetGlow - p.glowMultiplier) * 0.15
            } else {
              // spring
              const diff = targetGlow - p.glowMultiplier
              p.glowMultiplier += diff * 0.2
              p.glowMultiplier *= 0.85
            }

            // Opacity bump
            p.opacity = Math.min(1, p.baseOpacity + force * 0.4)
          } else {
            // Decay glow
            if (glowMode === 'instant') {
              p.glowMultiplier = 1
            } else if (glowMode === 'ease') {
              p.glowMultiplier += (1 - p.glowMultiplier) * 0.08
            } else {
              p.glowMultiplier += (1 - p.glowMultiplier) * 0.15
              p.glowMultiplier = p.glowMultiplier * 0.9 + 1 * 0.1
              if (p.glowMultiplier < 1) p.glowMultiplier = 1
            }

            // Decay opacity back to base
            p.opacity += (p.baseOpacity - p.opacity) * 0.05
          }
        }
      }

      // Draw
      ctx.clearRect(0, 0, w, h)
      for (const p of particles) {
        ctx.save()
        ctx.shadowColor = particleColor
        ctx.shadowBlur = glowIntensity * p.glowMultiplier * 2
        ctx.globalAlpha = p.opacity
        ctx.fillStyle = particleColor
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      animRef.current = requestAnimationFrame(animate)
    }

    animRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouse)
    }
  }, [
    particleColor,
    particleOpacity,
    glowIntensity,
    mouseGravity,
    gravityStrength,
    glowMode,
    mouseInfluence,
    initParticles,
  ])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: backgroundColor,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}
