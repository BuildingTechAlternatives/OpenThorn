import type { Device } from './PreviewPanel'
import styles from './PreviewFrame.module.css'

const deviceWidths: Record<Device, string> = {
  phone: '375px',
  tablet: '768px',
  pc: '100%',
}

interface Props {
  device: Device
}

export default function PreviewFrame({ device }: Props) {
  return (
    <div className={`${styles.wrapper} ${device !== 'pc' ? styles.framed : ''}`}>
      <div
        className={styles.container}
        style={{ width: deviceWidths[device] }}
      >
        {device !== 'pc' && (
          <div className={styles.frame}>
            {device === 'phone' && <div className={styles.notch} />}
            <div className={styles.urlBar}>
              <div className={styles.dots}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
              <span className={styles.url}>http://localhost:5173</span>
            </div>
          </div>
        )}
        <div className={styles.content}>
          {/* Demo preview content */}
          <div className={styles.demoSite}>
            <nav className={styles.demoNav}>
              <span className={styles.demoLogo}>
                <span className={styles.demoLogoDot} />
                Flowly
              </span>
              <div className={styles.demoLinks}>
                <span>Features</span>
                <span>Pricing</span>
                <span>Docs</span>
                <span className={styles.demoCTA}>Get Started</span>
              </div>
            </nav>
            <main className={styles.demoMain}>
              <h1 className={styles.demoHeading}>
                Project management,<br/>
                <span className={styles.demoGradient}>powered by AI</span>
              </h1>
              <p className={styles.demoSub}>
                Flowly helps teams ship faster with intelligent task prioritization,
                automated workflows, and real-time collaboration.
              </p>
              <div className={styles.demoBtns}>
                <button className={styles.demoPrimary}>Start free trial</button>
                <button className={styles.demoSecondary}>Watch demo →</button>
              </div>
            </main>
            <section className={styles.demoSection}>
              <div className={styles.demoSectionTitle}>Key Features</div>
              <div className={styles.demoGrid}>
                {[
                  { label: 'AI Planning', desc: 'Smart task prioritization' },
                  { label: 'Real-time Sync', desc: 'Instant team updates' },
                  { label: 'Custom Views', desc: 'Flexible workflows' },
                  { label: 'Analytics', desc: 'Deep insights' },
                  { label: 'Integrations', desc: 'Connect your stack' },
                  { label: 'Security', desc: 'Enterprise-grade' },
                ].map((f) => (
                  <div key={f.label} className={styles.demoCard}>
                    <div className={styles.demoIcon}>✦</div>
                    <span className={styles.demoCardLabel}>{f.label}</span>
                    <span className={styles.demoCardDesc}>{f.desc}</span>
                  </div>
                ))}
              </div>
            </section>
            <footer className={styles.demoFooter}>
              <span>© 2026 Flowly</span>
              <span>Privacy · Terms · Contact</span>
            </footer>
          </div>
        </div>
      </div>
    </div>
  )
}
