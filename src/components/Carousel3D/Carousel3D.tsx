import type { ReactNode } from 'react'
import styles from './Carousel3D.module.css'

export interface Carousel3DCard {
  icon?: ReactNode
  title: string
  description: string
}

interface Carousel3DProps {
  cards: Carousel3DCard[]
  rotateSpeed?: number
  translateZ?: number
  cardWidth?: number
  cardHeight?: number
  borderRadius?: number
  pauseOnHover?: boolean
}

export default function Carousel3D({
  cards,
  rotateSpeed = 25,
  translateZ = 320,
  cardWidth = 200,
  cardHeight = 150,
  borderRadius = 14,
  pauseOnHover = true,
}: Carousel3DProps) {
  const items = cards.filter((c) => c).slice(0, Math.max(cards.length, 3))
  const total = items.length
  const spreadAngle = 360 / total

  return (
    <div className={styles.container}>
      <div
        className={styles.carousel}
        style={{
          animation: `${styles.rotate3d} ${rotateSpeed}s infinite linear`,
          animationPlayState: pauseOnHover ? undefined : 'running',
        }}
      >
        {items.map((card, i) => {
          const angle = i * spreadAngle
          return (
            <div
              key={i}
              className={styles.card}
              style={{
                width: cardWidth,
                height: cardHeight,
                borderRadius,
                transform: `translate(-50%, -50%) rotateY(${angle}deg) translateZ(${translateZ}px)`,
              }}
            >
              <div
                className={styles.cardFront}
                style={{ borderRadius }}
              >
                {card.icon && <div className={styles.cardIcon}>{card.icon}</div>}
                <h3 className={styles.cardTitle}>{card.title}</h3>
                <p className={styles.cardDesc}>{card.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
