import { useEffect, useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { fetchModels, getFlagshipModels, type ModelEntry } from '../lib/pricing'
import styles from './PricingPage.module.css'

type HighlightRole = 'bestValue' | 'highestQuality' | 'cheapestUsable'

const roleCopy: Record<HighlightRole, { label: string; short: string; detail: string }> = {
  bestValue: {
    label: 'Best value',
    short: 'Value',
    detail: 'Highest quality per output dollar among usable flagship models.',
  },
  highestQuality: {
    label: 'Highest quality',
    short: 'Quality',
    detail: 'Top quality index when raw capability matters most.',
  },
  cheapestUsable: {
    label: 'Cheapest usable',
    short: 'Budget',
    detail: 'Lowest output cost while staying in the practical flagship tier.',
  },
}

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
  const maxCost = scatterData.length ? Math.max(...scatterData.map((d) => d.outputPer1M), 5) : 5
  const highlights = getHighlights(scatterData)
  const highlightCards = (['bestValue', 'highestQuality', 'cheapestUsable'] as HighlightRole[])
    .map((role) => ({ role, model: highlights[role] }))
    .filter((item): item is { role: HighlightRole; model: ModelEntry } => Boolean(item.model))

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
          BYOK means you pay providers directly - no markup, no subscription, no hidden fees.
        </p>
      </motion.div>

      {!models.length && !error && <div className={styles.loading}>Loading...</div>}
      {error && <div className={styles.error}>Could not load data. Try again shortly.</div>}

      {scatterData.length > 0 && (
        <motion.div
          className={styles.chartSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Quality vs cost</h2>
              <p className={styles.chartSubtitle}>
                Higher is smarter. Further right is more expensive per output token.
              </p>
            </div>
            <div className={styles.legend}>
              <span><i className={styles.legendFeatured} /> Recommended picks</span>
              <span><i className={styles.legendStandard} /> Other flagships</span>
            </div>
          </div>

          {highlightCards.length > 0 && (
            <div className={styles.storyGrid}>
              {highlightCards.map(({ role, model }) => (
                <article key={role} className={`${styles.storyCard} ${styles[role]}`}>
                  <span className={styles.storyLabel}>{roleCopy[role].label}</span>
                  <strong>{model.name}</strong>
                  <p>{roleCopy[role].detail}</p>
                  <span className={styles.storyMetric}>
                    {model.qualityIndex} quality / ${model.outputPer1M.toFixed(2)} output
                  </span>
                </article>
              ))}
            </div>
          )}

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
                {scatterData.map((d, index) => {
                  const roles = getModelRoles(d, highlights)
                  const primaryRole = roles[0]
                  const placement = labelPlacement(d, index, primaryRole)
                  const style = {
                    left: `${xPos(d.outputPer1M)}%`,
                    top: `${yPos(d.qualityIndex)}%`,
                    '--label-x': placement.x,
                    '--label-y': placement.y,
                    '--label-align': placement.align,
                  } as CSSProperties

                  return (
                    <div
                      key={d.id}
                      className={[
                        styles.dot,
                        roles.length ? styles.dotFeatured : '',
                        primaryRole ? styles[primaryRole] : '',
                        placement.hideMobile ? styles.hideLabelMobile : '',
                      ].filter(Boolean).join(' ')}
                      style={style}
                    >
                      <div className={styles.dotCircle} />
                      <span className={styles.dotName}>{d.name}</span>
                      {roles.length > 0 && (
                        <span className={styles.dotBadge}>
                          {roles.map((role) => roleCopy[role].short).join(' + ')}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className={styles.xTicks} style={{ marginLeft: 70 }}>
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

          <div className={styles.tableShell}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Provider</th>
                  <th>Best for</th>
                  <th>Quality</th>
                  <th>Context</th>
                  <th>Input $/MTok</th>
                  <th>Output $/MTok</th>
                </tr>
              </thead>
              <tbody>
                {flagships.map((m, index) => {
                  const roles = getModelRoles(m, highlights)
                  const startsProviderGroup = index === 0 || flagships[index - 1].provider !== m.provider

                  return (
                    <tr
                      key={m.id}
                      className={[
                        startsProviderGroup ? styles.providerGroupStart : '',
                        roles.length ? styles.highlightRow : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <td className={styles.modelName}>{m.name}</td>
                      <td><span className={styles.providerTag}>{m.provider}</span></td>
                      <td>
                        <div className={styles.roleCell}>
                          {roles.length > 0
                            ? roles.map((role) => (
                              <span key={role} className={`${styles.roleTag} ${styles[role]}`}>
                                {roleCopy[role].label}
                              </span>
                            ))
                            : <span className={styles.strengthText}>{m.strengths || 'General purpose'}</span>}
                        </div>
                      </td>
                      <td className={styles.price}>{m.qualityIndex}</td>
                      <td className={styles.price}>{(m.contextLength / 1000).toFixed(0)}K</td>
                      <td className={styles.price}>${m.inputPer1M.toFixed(2)}</td>
                      <td className={styles.price}>${m.outputPer1M.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  )
}

function getHighlights(models: ModelEntry[]): Partial<Record<HighlightRole, ModelEntry>> {
  if (!models.length) return {}

  const practical = models.filter((m) => m.qualityIndex >= 78)
  const comparisonSet = practical.length ? practical : models

  return {
    bestValue: comparisonSet.reduce((best, model) => (
      model.qualityIndex / Math.max(model.outputPer1M, 0.05) >
      best.qualityIndex / Math.max(best.outputPer1M, 0.05) ? model : best
    ), comparisonSet[0]),
    highestQuality: models.reduce((best, model) => (
      model.qualityIndex > best.qualityIndex ? model : best
    ), models[0]),
    cheapestUsable: comparisonSet.reduce((best, model) => (
      model.outputPer1M < best.outputPer1M ? model : best
    ), comparisonSet[0]),
  }
}

function getModelRoles(model: ModelEntry, highlights: Partial<Record<HighlightRole, ModelEntry>>): HighlightRole[] {
  return (['bestValue', 'highestQuality', 'cheapestUsable'] as HighlightRole[])
    .filter((role) => highlights[role]?.id === model.id)
}

function labelPlacement(model: ModelEntry, index: number, role?: HighlightRole) {
  if (role === 'highestQuality') return { x: '14px', y: '-46px', align: 'left', hideMobile: false }
  if (role === 'bestValue') return { x: 'calc(-100% - 16px)', y: '-48px', align: 'right', hideMobile: false }
  if (role === 'cheapestUsable') return { x: '14px', y: '22px', align: 'left', hideMobile: false }

  const placements = [
    { x: '14px', y: '-28px', align: 'left' },
    { x: 'calc(-100% - 14px)', y: '-28px', align: 'right' },
    { x: '14px', y: '18px', align: 'left' },
    { x: 'calc(-100% - 14px)', y: '18px', align: 'right' },
  ]
  const placement = placements[index % placements.length]

  return {
    ...placement,
    hideMobile: model.qualityIndex < 82,
  }
}
