import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { fetchModels, getFlagshipModels, type ModelEntry } from '../lib/pricing'
import styles from './PricingPage.module.css'

export default function PricingPage() {
  const [models, setModels] = useState<ModelEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchModels()
      .then(setModels)
      .catch((e) => setError(e.message))
  }, [])

  const flagships = getFlagshipModels(models)
  const scatterData = flagships.filter((m) => m.qualityIndex > 0 && m.outputPer1M > 0)
  const maxCost = Math.max(...scatterData.map((d) => d.outputPer1M), 5)

  const xRange = [0, maxCost * 1.1]
  const yRange = [60, 105]
  function xPos(v: number) { return ((v - xRange[0]) / (xRange[1] - xRange[0])) * 100 }
  function yPos(v: number) { return 100 - ((v - yRange[0]) / (yRange[1] - yRange[0])) * 100 }

  const xTicks = [0, 5, 10, 15, 20, 25, 30].filter((t) => t <= Math.ceil(xRange[1] / 5) * 5)
  const yTicks = [65, 75, 85, 95, 100]

  return (
    <div className={styles.page}>
      <motion.div
        className={styles.header}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className={styles.title}>Model pricing</h1>
        <p className={styles.subtitle}>
          BYOK means you pay providers directly — no markup, no subscription, no hidden fees.
        </p>
      </motion.div>

      {!models.length && !error && <div className={styles.loading}>Loading...</div>}
      {error && <div className={styles.error}>Couldn't load data. Try again shortly.</div>}

      {/* Quality vs Cost scatter chart */}
      {scatterData.length > 0 && (
        <motion.div
          className={styles.chartSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h2 className={styles.sectionTitle}>Quality vs cost</h2>
          <p className={styles.chartSubtitle}>
            Higher is smarter. Further right is more expensive per token.
          </p>

          <div className={styles.chartBox}>
            <div className={styles.chartArea}>
              <span className={styles.yLabel}>Quality Index</span>

              {yTicks.map((t) => (
                <span key={`y${t}`} className={styles.tickY} style={{ top: `${yPos(t)}%` }}>
                  {t}
                </span>
              ))}
              {yTicks.map((t) => (
                <div key={`gy${t}`} className={styles.gridLine} style={{ top: `${yPos(t)}%` }} />
              ))}
              {xTicks.map((t) => (
                <div key={`gx${t}`} className={styles.gridLineV} style={{ left: `${xPos(t)}%` }} />
              ))}

              <div className={`${styles.axisLine} ${styles.axisX}`} />
              <div className={`${styles.axisLine} ${styles.axisY}`} />

              <div className={styles.scatterInner}>
                {scatterData.map((d) => (
                  <div
                    key={d.id}
                    className={styles.dot}
                    style={{
                      left: `${xPos(d.outputPer1M)}%`,
                      top: `${yPos(d.qualityIndex)}%`,
                    }}
                  >
                    <div className={styles.dotCircle} />
                    <span className={styles.dotName}>{d.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ position: 'relative', height: 28, marginLeft: 70 }}>
              {xTicks.map((t) => (
                <span key={`x${t}`} className={styles.tickX} style={{ left: `${xPos(t)}%` }}>
                  ${t}
                </span>
              ))}
            </div>
            <p className={styles.xLabel}>Output cost per 1M tokens</p>
          </div>
        </motion.div>
      )}

      {/* Flagship pricing table */}
      {flagships.length > 0 && (
        <motion.div
          className={styles.chartSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <h2 className={styles.sectionTitle}>All flagship models</h2>
          <p className={styles.chartSubtitle}>
            Pricing live from OpenRouter. Compare quality, cost, and context windows.
          </p>

          <div className={styles.chartBox} style={{ padding: 0, overflow: 'hidden' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Provider</th>
                  <th>Quality</th>
                  <th>Context</th>
                  <th>Input $/MTok</th>
                  <th>Output $/MTok</th>
                </tr>
              </thead>
              <tbody>
                {flagships.map((m) => (
                  <tr key={m.id}>
                    <td className={styles.modelName}>{m.name}</td>
                    <td><span className={styles.providerTag}>{m.provider}</span></td>
                    <td className={styles.price}>{m.qualityIndex}</td>
                    <td className={styles.price}>{(m.contextLength / 1000).toFixed(0)}K</td>
                    <td className={styles.price}>${m.inputPer1M.toFixed(2)}</td>
                    <td className={styles.price}>${m.outputPer1M.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  )
}
