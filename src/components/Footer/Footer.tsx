import { Link } from 'react-router-dom'
import styles from './Footer.module.css'

const solutionsLinks = [
  { label: 'Founders', href: '#' },
  { label: 'Developers', href: '#' },
  { label: 'Product Managers', href: '#' },
  { label: 'Designers', href: '#' },
  { label: 'Marketers', href: '#' },
  { label: 'Agencies', href: '#' },
  { label: 'Ops', href: '#' },
]

const useCasesLinks = [
  { label: 'Productivity', href: '#' },
  { label: 'E-Commerce', href: '#' },
  { label: 'Marketing & Sales', href: '#' },
  { label: 'SaaS & Startups', href: '#' },
  { label: 'Education', href: '#' },
  { label: 'Community platforms', href: '#' },
]

const resourcesLinks = [
  { label: 'Blog', href: '#' },
  { label: 'Templates', href: '#' },
]

const resourcesRouteLinks = [
  { label: 'Docs & FAQs', to: '/faq' },
]

const legalLinks = [
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Terms of Service', to: '/terms' },
  { label: 'Cookie Policy', to: '/cookies' },
  { label: 'Moderation & DSA', to: '/moderation' },
  { label: 'Imprint', to: '/imprint' },
]

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          {/* Brand */}
          <div className={styles.brand}>
            <a href="/" className={styles.logo}>
              <img src="/assets/logo.png" alt="" className={styles.logoImg} />
              <span className={styles.logoText}>OpenThorn</span>
            </a>
            <p className={styles.tagline}>
              Turn a description into a deployed website — with your own API keys and your
              own infrastructure.
            </p>
          </div>

          {/* Solutions */}
          <div>
            <div className={styles.colTitle}>Solutions</div>
            <div className={styles.colLinks}>
              {solutionsLinks.map((l) => (
                <a key={l.label} href={l.href}>{l.label}</a>
              ))}
            </div>
          </div>

          {/* Use Cases */}
          <div>
            <div className={styles.colTitle}>Use Cases</div>
            <div className={styles.colLinks}>
              {useCasesLinks.map((l) => (
                <a key={l.label} href={l.href}>{l.label}</a>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div>
            <div className={styles.colTitle}>Resources</div>
            <div className={styles.colLinks}>
              {resourcesLinks.map((l) => (
                <a key={l.label} href={l.href}>{l.label}</a>
              ))}
              {resourcesRouteLinks.map((l) => (
                <Link key={l.label} to={l.to}>{l.label}</Link>
              ))}
            </div>
          </div>

          {/* Legal */}
          <div>
            <div className={styles.colTitle}>Legal</div>
            <div className={styles.colLinks}>
              {legalLinks.map((l) => (
                <Link key={l.label} to={l.to}>{l.label}</Link>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.bottom}>
          <span className={styles.copyright}>
            &copy; {new Date().getFullYear()} OpenThorn. All rights reserved.
          </span>
          <div className={styles.socials}>
            <a href="https://github.com" aria-label="GitHub" target="_blank" rel="noopener noreferrer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
            <a href="https://x.com" aria-label="X" target="_blank" rel="noopener noreferrer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
