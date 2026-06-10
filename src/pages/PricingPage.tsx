import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fetchModels, getFlagshipModels, type ModelEntry } from '../lib/pricing'
import { usePageTitle } from '../lib/usePageTitle'
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
  usePageTitle('Model Pricing', {
    description: 'Compare per-token pricing across the AI providers OpenThorn supports. You pay your provider directly — OpenThorn charges no subscription.',
  })
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
        <p className={styles.eyebrow}>Bring your own key</p>
        <h1 className={styles.title}>
          Model pricing, <span className={styles.titleAccent}>transparent</span>
        </h1>
        <p className={styles.subtitle}>
          BYOK means you pay providers directly — no markup, no subscription, no hidden fees.
        </p>
        <p className={styles.lastUpdated}>
          Pricing data syncs from live provider rates. New to BYOK?{' '}
          <Link to="/blog/what-is-a-byok-ai-website-builder">Read how it works</Link> or check the{' '}
          <Link to="/faq">FAQ</Link>.
        </p>
      </motion.div>

      {!models.length && !error && <div className={styles.loading}>Loading...</div>}
      {error && <div className={styles.error}>Could not load data. Try again shortly.</div>}

      {highlightCards.length > 0 && (
        <motion.div
          className={styles.highlightCardsRow}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
        >
          {highlightCards.map(({ role, model }) => (
            <div key={role} className={`${styles.highlightCard} ${styles[role]}`}>
              <span className={styles.highlightCardLabel}>{roleCopy[role].label}</span>
              <span className={styles.highlightCardName}>{model.name}</span>
              <span className={styles.highlightCardMeta}>
                {model.provider} · ${model.outputPer1M.toFixed(2)}/MTok out · q{model.qualityIndex}
              </span>
              <p className={styles.highlightCardDetail}>{roleCopy[role].detail}</p>
            </div>
          ))}
        </motion.div>
      )}

      {scatterData.length > 0 && (
        <motion.div
          className={styles.chartSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
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
