import { Link } from 'react-router-dom'
import { useJsonLd } from '../lib/useJsonLd'
import { usePageTitle } from '../lib/usePageTitle'
import compareMeta from '../data/compare-meta.json'
import styles from './CompareIndexPage.module.css'

interface CompareEntry {
  slug: string
  competitor: string
  logo: string
  title: string
  description: string
  lastVerified: string
  verdict: string
}

const entries = compareMeta as CompareEntry[]

export default function CompareIndexPage() {
  usePageTitle('Comparisons', {
    description:
      'Compare OpenThorn with Lovable, Bolt.new, v0, and other AI website builders on pricing, BYOK support, model choice, and code ownership.',
  })

  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'OpenThorn comparisons',
    itemListElement: entries.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.title,
      url: `https://www.openthorn.app/compare/${entry.slug}`,
    })),
  })

  const [featured, ...rest] = entries

  return (
    <div className={styles.page}>
      <div className={styles.ambient} />

      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Buyer guides</span>
          <h1 className={styles.title}>Comparisons</h1>
          <p className={styles.subtitle}>
            Honest side-by-side notes on BYOK, subscriptions, model choice, export rights, and what each builder is best for.
          </p>
          <div className={styles.rule} />
        </header>

        {featured && (
          <Link to={`/compare/${featured.slug}`} className={styles.featured}>
            <div className={styles.featuredTop}>
              <div className={styles.logoWrap}>
                {featured.logo ? (
                  <img className={styles.logo} src={featured.logo} alt={`${featured.competitor} logo`} />
                ) : (
                  <span className={styles.logoFallback} aria-hidden="true">{featured.competitor[0]}</span>
                )}
              </div>
              <div className={styles.featuredMeta}>
                <span className={styles.tag}>Featured</span>
                <span className={styles.date}>Verified {featured.lastVerified}</span>
              </div>
            </div>
            <h2 className={styles.featuredTitle}>{featured.title}</h2>
            <p className={styles.excerpt}>{featured.description}</p>
            <p className={styles.verdict}>{featured.verdict}</p>
            <span className={styles.cta}>
              Read comparison
              <svg className={styles.ctaArrow} width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3.5 9h11M10 4.5L14.5 9 10 13.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </Link>
        )}

        {rest.length > 0 && (
          <section className={styles.more}>
            <h2 className={styles.moreLabel}>More comparisons</h2>
            <div className={styles.grid}>
              {rest.map((entry) => (
                <Link key={entry.slug} to={`/compare/${entry.slug}`} className={styles.card}>
                  <div className={styles.cardTop}>
                    <div className={styles.logoWrap}>
                      {entry.logo ? (
                        <img className={styles.logo} src={entry.logo} alt={`${entry.competitor} logo`} loading="lazy" />
                      ) : (
                        <span className={styles.logoFallback} aria-hidden="true">{entry.competitor[0]}</span>
                      )}
                    </div>
                    <span className={styles.date}>Verified {entry.lastVerified}</span>
                  </div>
                  <h3 className={styles.cardTitle}>{entry.title}</h3>
                  <p className={styles.excerpt}>{entry.description}</p>
                  <span className={styles.readMore}>Read comparison</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
