import { Link } from 'react-router-dom'
import { useJsonLd } from '../lib/useJsonLd'
import { usePageTitle } from '../lib/usePageTitle'
import providersMeta from '../data/providers-meta.json'
import type { ProviderGuide } from './BuildWithPage'
import styles from './BuildWithIndexPage.module.css'

const guides = providersMeta as ProviderGuide[]

export default function BuildWithIndexPage() {
  usePageTitle('Build with your API key', {
    description:
      'Step-by-step guides for building a website with your own API key from any of the 18 AI providers OpenThorn supports — OpenAI, Anthropic, Gemini, RodiumAi, and more.',
  })

  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Build a website with your own API key — provider guides',
    itemListElement: guides.map((guide, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: guide.title,
      url: `https://www.openthorn.app/build-with/${guide.slug}`,
    })),
  })

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Provider guides</span>
          <h1 className={styles.title}>Build with your API key</h1>
          <p className={styles.subtitle}>
            OpenThorn works with 18 AI providers. Pick yours for a step-by-step guide:
            where to get the key, which models to use, and what a website actually costs.
          </p>
        </header>

        <div className={styles.grid}>
          {guides.map((guide) => (
            <Link key={guide.slug} to={`/build-with/${guide.slug}`} className={styles.card}>
              <div className={styles.logoWrap}>
                <img className={styles.logo} src={guide.logo} alt={`${guide.name} logo`} loading="lazy" />
              </div>
              <div>
                <h2 className={styles.cardTitle}>{guide.name}</h2>
                <p className={styles.cardNote}>{guide.freeTier.startsWith('Yes') || guide.slug === 'ollama' ? 'Free tier available' : 'Pay as you go'}</p>
              </div>
            </Link>
          ))}
        </div>

        <p className={styles.links}>
          Not sure which provider to pick? Start with{' '}
          <Link to="/blog/how-to-get-an-ai-api-key">how to get an AI API key</Link> or compare{' '}
          <Link to="/pricing">model pricing</Link> across all providers.
        </p>
      </div>
    </div>
  )
}
