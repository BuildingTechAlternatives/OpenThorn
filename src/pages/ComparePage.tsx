import { Link, Navigate, useParams } from 'react-router-dom'
import { usePageTitle } from '../lib/usePageTitle'
import { useJsonLd } from '../lib/useJsonLd'
import compareMeta from '../data/compare-meta.json'
import AdsterraNativeBanner from '../components/AdsterraNativeBanner/AdsterraNativeBanner'
import styles from './ComparePage.module.css'

interface CompareEntry {
  slug: string
  competitor: string
  logo: string
  title: string
  description: string
  lastVerified: string
  answer: string
  intro: string
  rows: { feature: string; openthorn: string; competitor: string }[]
  faqs: { question: string; answer: string }[]
  verdict: string
}

const entries = compareMeta as CompareEntry[]

export default function ComparePage() {
  const { slug } = useParams<{ slug: string }>()
  const entry = entries.find((e) => e.slug === slug)

  usePageTitle(entry?.title, entry ? { description: entry.description } : undefined)

  useJsonLd(
    entry
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: entry.faqs.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        }
      : {}
  )

  if (!entry) return <Navigate to="/" replace />

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.heading}>
          <div className={styles.logoWrap}>
            {entry.logo ? (
              <img className={styles.logo} src={entry.logo} alt={`${entry.competitor} logo`} />
            ) : (
              <span className={styles.logoFallback} aria-hidden="true">{entry.competitor[0]}</span>
            )}
          </div>
          <div>
            <p className={styles.eyebrow}>Comparison</p>
            <h1 className={styles.title}>{entry.title}</h1>
          </div>
        </div>
        <p className={styles.lastVerified}>
          Facts last verified: <time dateTime={entry.lastVerified}>{entry.lastVerified}</time>.
          Competitor pricing changes — check their site for current numbers.
        </p>
        <p className={styles.answer}>{entry.answer}</p>
        <p className={styles.intro}>{entry.intro}</p>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Feature</th>
                <th scope="col">OpenThorn</th>
                <th scope="col">{entry.competitor}</th>
              </tr>
            </thead>
            <tbody>
              {entry.rows.map((row) => (
                <tr key={row.feature}>
                  <th scope="row">{row.feature}</th>
                  <td>{row.openthorn}</td>
                  <td>{row.competitor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <AdsterraNativeBanner variant="inline" />

        <h2 className={styles.sectionTitle}>Common questions</h2>
        {entry.faqs.map((f) => (
          <div key={f.question} className={styles.faqItem}>
            <h3>{f.question}</h3>
            <p>{f.answer}</p>
          </div>
        ))}

        <h2 className={styles.sectionTitle}>Verdict</h2>
        <p className={styles.verdict}>{entry.verdict}</p>

        <p className={styles.links}>
          New to BYOK? Read{' '}
          <Link to="/blog/what-is-a-byok-ai-website-builder">what a BYOK AI website builder is</Link>,
          compare <Link to="/pricing">model pricing</Link>, or see the other comparisons:{' '}
          {entries
            .filter((e) => e.slug !== entry.slug)
            .map((e, i) => (
              <span key={e.slug}>
                {i > 0 && ' · '}
                <Link to={`/compare/${e.slug}`}>{e.title}</Link>
              </span>
            ))}
        </p>
      </div>
    </div>
  )
}
