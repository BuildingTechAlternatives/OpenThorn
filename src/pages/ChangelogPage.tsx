import { usePageTitle } from '../lib/usePageTitle'
import changelog from '../data/changelog.json'
import styles from './ChangelogPage.module.css'

// Content lives in src/data/changelog.json, regenerated from the GitHub commit
// history by scripts/generate-changelog.mjs on every build — so each push
// updates this page automatically. Don't edit the JSON by hand.

interface ChangelogEntry {
  category: string
  message: string
  sha: string
  shortSha: string
  url: string
}

interface ChangelogDay {
  date: string
  entries: ChangelogEntry[]
}

const CATEGORY_STYLES: Record<string, string> = {
  New: styles.badgeNew,
  Fix: styles.badgeFix,
  Improved: styles.badgeImproved,
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function ChangelogPage() {
  usePageTitle('Changelog', {
    description:
      'Every OpenThorn update, generated automatically from our GitHub commit history — new features, fixes, and improvements as they ship.',
  })

  const days = changelog.days as ChangelogDay[]

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Resources</p>
          <h1 className={styles.title}>
            What <span className={styles.titleAccent}>shipped</span>
          </h1>
          <p className={styles.subtitle}>
            Every update, straight from our{' '}
            <a
              href="https://github.com/BuildingTechAlternatives/OpenThorn"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub repository
            </a>
            . This page regenerates automatically with every push.
          </p>
          {days[0] && (
            <p className={styles.lastUpdated}>
              Last updated: <time dateTime={days[0].date}>{formatDate(days[0].date)}</time>
            </p>
          )}
        </header>

        {days.map((day) => (
          <section key={day.date} className={styles.day}>
            <p className={styles.dayLabel}>
              <time dateTime={day.date}>{formatDate(day.date)}</time>
            </p>
            <ul className={styles.entries}>
              {day.entries.map((entry) => (
                <li key={entry.sha} className={styles.entry}>
                  <span className={`${styles.badge} ${CATEGORY_STYLES[entry.category] ?? styles.badgeImproved}`}>
                    {entry.category}
                  </span>
                  <span className={styles.message}>{entry.message}</span>
                  <a
                    className={styles.commitLink}
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View commit ${entry.shortSha} on GitHub`}
                  >
                    {entry.shortSha}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
