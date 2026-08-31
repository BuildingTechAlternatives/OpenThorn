import { Link, Navigate, useParams } from 'react-router-dom'
import { usePageTitle } from '../lib/usePageTitle'
import { useJsonLd } from '../lib/useJsonLd'
import providersMeta from '../data/providers-meta.json'
import AdsterraNativeBanner from '../components/AdsterraNativeBanner/AdsterraNativeBanner'
import styles from './BuildWithPage.module.css'

export interface ProviderGuide {
  slug: string
  name: string
  logo: string
  title: string
  description: string
  lastVerified: string
  answer: string
  freeTier: string
  consoleUrl: string
  consoleLabel: string
  pricingUrl: string
  models: { name: string; note: string }[]
  costNote: string
  steps: { name: string; text: string }[]
  faqs: { question: string; answer: string }[]
}

const guides = providersMeta as ProviderGuide[]

export default function BuildWithPage() {
  const { slug } = useParams<{ slug: string }>()
  const guide = guides.find((g) => g.slug === slug)

  usePageTitle(guide?.title, guide ? { description: guide.description } : undefined)

  useJsonLd(
    guide
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: guide.faqs.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        }
      : {}
  )

  useJsonLd(
    guide
      ? {
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: guide.title,
          step: guide.steps.map((s, i) => ({
            '@type': 'HowToStep',
            position: i + 1,
            name: s.name,
            text: s.text,
          })),
        }
      : {}
  )

  if (!guide) return <Navigate to="/build-with" replace />

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.heading}>
          <div className={styles.logoWrap}>
            <img className={styles.logo} src={guide.logo} alt={`${guide.name} logo`} />
          </div>
          <div>
            <p className={styles.eyebrow}>Build with your API key</p>
            <h1 className={styles.title}>{guide.title}</h1>
          </div>
        </div>
        <p className={styles.lastVerified}>
          Facts last verified: <time dateTime={guide.lastVerified}>{guide.lastVerified}</time>.
          Provider pricing and free tiers change — check their site for current numbers.
        </p>

        <p className={styles.answer}>{guide.answer}</p>

        <div className={styles.facts}>
          <div className={styles.fact}>
            <p className={styles.factLabel}>Get your key</p>
            <p>
              <a href={guide.consoleUrl} target="_blank" rel="noopener noreferrer">
                {guide.consoleLabel}
              </a>
            </p>
          </div>
          <div className={styles.fact}>
            <p className={styles.factLabel}>Official pricing</p>
            <p>
              <a href={guide.pricingUrl} target="_blank" rel="noopener noreferrer">
                {guide.pricingUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </a>
            </p>
          </div>
          <div className={styles.fact}>
            <p className={styles.factLabel}>Free tier</p>
            <p>{guide.freeTier}</p>
          </div>
        </div>

        <h2 className={styles.sectionTitle}>Recommended models</h2>
        <ul className={styles.models}>
          {guide.models.map((m) => (
            <li key={m.name}>
              <strong>{m.name}</strong> — {m.note}
            </li>
          ))}
        </ul>

        <AdsterraNativeBanner variant="inline" />

        <h2 className={styles.sectionTitle}>How to build your website</h2>
        <ol className={styles.steps}>
          {guide.steps.map((s) => (
            <li key={s.name}>
              <strong>{s.name}</strong>
              {s.text}
            </li>
          ))}
        </ol>

        <h2 className={styles.sectionTitle}>What it costs</h2>
        <p className={styles.costNote}>{guide.costNote}</p>

        <h2 className={styles.sectionTitle}>Common questions</h2>
        {guide.faqs.map((f) => (
          <div key={f.question} className={styles.faqItem}>
            <h3>{f.question}</h3>
            <p>{f.answer}</p>
          </div>
        ))}

        <p className={styles.links}>
          New here? Read{' '}
          <Link to="/blog/how-to-build-a-website-with-ai-byok">how to build a website with AI using your own key</Link>,{' '}
          <Link to="/blog/how-to-get-an-ai-api-key">how to get an AI API key</Link>, or compare{' '}
          <Link to="/pricing">model pricing</Link>. Other providers:{' '}
          {guides
            .filter((g) => g.slug !== guide.slug)
            .map((g, i) => (
              <span key={g.slug}>
                {i > 0 && ' · '}
                <Link to={`/build-with/${g.slug}`}>{g.name}</Link>
              </span>
            ))}
        </p>
      </div>
    </div>
  )
}
