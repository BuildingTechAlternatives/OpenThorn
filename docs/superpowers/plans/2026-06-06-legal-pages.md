# Legal Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Privacy Policy, Terms of Service, and Cookie Policy pages to OpenThorn, plus a GDPR/Garante-compliant cookie consent banner that gates PostHog analytics until the user accepts.

**Architecture:** A shared `LegalPage` layout component renders the page shell (title, last-updated, content area). Three content pages (PrivacyPage, TermsPage, CookiesPage) render inside it. A `CookieBanner` component checks localStorage for prior consent, initialises PostHog if accepted, and shows the banner if no decision exists. `initAnalytics()` is removed from `main.tsx` and moved into CookieBanner. Footer legal links updated from `#` to real routes using React Router `<Link>`.

**Tech Stack:** React, React Router v6, CSS Modules, PostHog (consent-gated via localStorage)

---

## File Map

**Create:**
- `src/pages/LegalPage.tsx` — shared layout shell for all legal pages
- `src/pages/LegalPage.module.css` — shared legal page styles
- `src/pages/PrivacyPage.tsx` — Privacy Policy content
- `src/pages/TermsPage.tsx` — Terms of Service content
- `src/pages/CookiesPage.tsx` — Cookie Policy content
- `src/components/CookieBanner/CookieBanner.tsx` — consent banner component
- `src/components/CookieBanner/CookieBanner.module.css` — banner styles

**Modify:**
- `src/main.tsx` — remove `initAnalytics()` call (now consent-gated in CookieBanner)
- `src/App.tsx` — add `/privacy`, `/terms`, `/cookies` routes; render `<CookieBanner />` inside Layout
- `src/components/Footer/Footer.tsx` — update legalLinks hrefs; switch `<a>` to `<Link>` for internal routes

---

### Task 1: Shared LegalPage layout + CSS

**Files:**
- Create: `src/pages/LegalPage.module.css`
- Create: `src/pages/LegalPage.tsx`

- [ ] **Step 1: Create `src/pages/LegalPage.module.css`**

```css
.page {
  min-height: calc(100vh - 64px);
  padding: 64px 24px 120px;
}

.container {
  max-width: 720px;
  margin: 0 auto;
}

.header {
  margin-bottom: 48px;
  padding-bottom: 32px;
  border-bottom: 1px solid rgba(148, 137, 251, 0.15);
}

.title {
  font-family: 'Fraunces', serif;
  font-size: clamp(1.8rem, 4vw, 2.75rem);
  font-weight: 700;
  color: #ededf5;
  line-height: 1.2;
  margin: 0 0 12px;
}

.updated {
  font-size: 0.875rem;
  color: #7474a0;
  margin: 0;
}

.content {
  color: #c8c8e0;
  font-size: 1rem;
  line-height: 1.75;
}

.content h2 {
  font-family: 'Fraunces', serif;
  font-size: 1.35rem;
  font-weight: 600;
  color: #ededf5;
  margin: 2.25rem 0 0.875rem;
  line-height: 1.3;
}

.content p {
  margin: 0 0 1.1rem;
}

.content ul,
.content ol {
  margin: 0 0 1.1rem 1.5rem;
  padding: 0;
}

.content li {
  margin-bottom: 0.35rem;
}

.content a {
  color: #9d89fb;
  text-underline-offset: 3px;
}

.content a:hover {
  color: #b8a9fd;
}

.content strong {
  color: #ededf5;
  font-weight: 600;
}

.content code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.875em;
  color: #9d89fb;
  background: rgba(157, 137, 251, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}
```

- [ ] **Step 2: Create `src/pages/LegalPage.tsx`**

```tsx
import styles from './LegalPage.module.css'

interface Props {
  title: string
  lastUpdated: string
  children: React.ReactNode
}

export default function LegalPage({ title, lastUpdated, children }: Props) {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.updated}>Last updated: {lastUpdated}</p>
        </header>
        <div className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/LegalPage.tsx src/pages/LegalPage.module.css
git commit -m "feat: add shared LegalPage layout component"
```

---

### Task 2: PrivacyPage

**Files:**
- Create: `src/pages/PrivacyPage.tsx`

- [ ] **Step 1: Create `src/pages/PrivacyPage.tsx`**

```tsx
import LegalPage from './LegalPage'
import { usePageTitle } from '../lib/usePageTitle'

export default function PrivacyPage() {
  usePageTitle('Privacy Policy')
  return (
    <LegalPage title="Privacy Policy" lastUpdated="June 6, 2025">
      <h2>1. Who We Are</h2>
      <p>
        OpenThorn is operated by <strong>[CONTROLLER_NAME]</strong>, located at{' '}
        <strong>[CONTROLLER_ADDRESS]</strong>, Italy (the "Data Controller"). For
        privacy-related enquiries, contact us at <strong>[CONTACT_EMAIL]</strong>.
      </p>

      <h2>2. What Data We Collect</h2>
      <p>We collect only what is necessary to provide the service:</p>
      <ul>
        <li>
          <strong>Account data</strong> — your email address when you register or sign in.
        </li>
        <li>
          <strong>Project data</strong> — the prompts you write, the code OpenThorn
          generates, and your project names. Stored so you can return to your work.
        </li>
        <li>
          <strong>Technical / error data</strong> — error reports that may include browser
          information, the page URL, and your user ID if you are signed in. Collected via
          Sentry to help us fix bugs.
        </li>
        <li>
          <strong>Analytics data</strong> — page views and feature interactions. Collected
          via PostHog <em>only if you give consent</em> through the cookie banner.
        </li>
      </ul>

      <h2>3. Legal Basis for Processing</h2>
      <ul>
        <li>
          <strong>Account and project data</strong> — performance of a contract
          (Art. 6(1)(b) GDPR): processing is necessary to provide the service you signed
          up for.
        </li>
        <li>
          <strong>Error monitoring</strong> — legitimate interests (Art. 6(1)(f) GDPR):
          we have a legitimate interest in maintaining a functioning, secure service.
        </li>
        <li>
          <strong>Analytics</strong> — consent (Art. 6(1)(a) GDPR): PostHog is only
          activated after you accept analytics via the cookie banner. You may withdraw
          consent at any time.
        </li>
      </ul>

      <h2>4. Third-Party Service Providers</h2>
      <p>
        We use the following processors who handle personal data on our behalf:
      </p>
      <ul>
        <li>
          <strong>Supabase, Inc.</strong> (authentication and database) — your account
          credentials and project data are stored on Supabase infrastructure. Data may be
          processed in the United States under Standard Contractual Clauses.
        </li>
        <li>
          <strong>Sentry, Inc.</strong> (error monitoring) — error reports including
          technical context are sent to Sentry. Data may be processed in the United States
          under Standard Contractual Clauses.
        </li>
        <li>
          <strong>PostHog, Inc.</strong> (analytics) — page view and interaction data is
          sent to PostHog only if you accept analytics cookies. Data may be processed in
          the United States under Standard Contractual Clauses.
        </li>
      </ul>
      <p>OpenThorn does not sell your personal data to any third party.</p>

      <h2>5. Data Retention</h2>
      <ul>
        <li>
          <strong>Account and project data</strong> — retained for as long as your account
          is active, or until you request deletion.
        </li>
        <li>
          <strong>Error data</strong> — retained according to Sentry's configured retention
          period.
        </li>
        <li>
          <strong>Analytics data</strong> — retained according to PostHog's retention
          settings. Withdrawing consent stops new data collection; historical data may
          remain until the retention period expires.
        </li>
      </ul>

      <h2>6. International Data Transfers</h2>
      <p>
        Supabase, Sentry, and PostHog are US-based companies. Transfers of personal data
        from the EU/EEA to these providers are covered by Standard Contractual Clauses
        (SCCs) approved by the European Commission under Art. 46 GDPR.
      </p>

      <h2>7. Your Rights</h2>
      <p>Under the GDPR you have the right to:</p>
      <ul>
        <li><strong>Access</strong> — request a copy of your personal data.</li>
        <li><strong>Rectification</strong> — ask us to correct inaccurate data.</li>
        <li><strong>Erasure</strong> — ask us to delete your account and associated data.</li>
        <li>
          <strong>Restriction</strong> — ask us to pause processing in certain
          circumstances.
        </li>
        <li>
          <strong>Portability</strong> — receive your data in a structured,
          machine-readable format.
        </li>
        <li>
          <strong>Object</strong> — object to processing based on legitimate interests.
        </li>
        <li>
          <strong>Withdraw consent</strong> — revoke analytics consent at any time via the
          cookie banner, without affecting the lawfulness of prior processing.
        </li>
      </ul>
      <p>
        To exercise any of these rights, email us at <strong>[CONTACT_EMAIL]</strong>. We
        will respond within 30 days.
      </p>

      <h2>8. Complaints</h2>
      <p>
        If you believe we have handled your data unlawfully, you have the right to lodge a
        complaint with the Italian data protection authority:{' '}
        <strong>Garante per la protezione dei dati personali</strong> (
        <a
          href="https://www.garanteprivacy.it"
          target="_blank"
          rel="noopener noreferrer"
        >
          garanteprivacy.it
        </a>
        ).
      </p>

      <h2>9. Changes to This Policy</h2>
      <p>
        We may update this policy from time to time. When we do, we will update the "Last
        updated" date at the top of this page. Continued use of the service after a change
        constitutes acceptance of the revised policy.
      </p>

      <h2>10. Contact</h2>
      <p>
        For any questions about this privacy policy or your personal data, contact us at{' '}
        <strong>[CONTACT_EMAIL]</strong>.
      </p>
    </LegalPage>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/PrivacyPage.tsx
git commit -m "feat: add PrivacyPage with GDPR-compliant privacy policy"
```

---

### Task 3: TermsPage

**Files:**
- Create: `src/pages/TermsPage.tsx`

- [ ] **Step 1: Create `src/pages/TermsPage.tsx`**

```tsx
import LegalPage from './LegalPage'
import { usePageTitle } from '../lib/usePageTitle'

export default function TermsPage() {
  usePageTitle('Terms of Service')
  return (
    <LegalPage title="Terms of Service" lastUpdated="June 6, 2025">
      <h2>1. About OpenThorn</h2>
      <p>
        OpenThorn is a free AI web builder. You describe what you want; OpenThorn generates
        production-grade code using the AI provider of your choice. The service is provided
        at no charge and without a subscription.
      </p>

      <h2>2. Acceptance of Terms</h2>
      <p>
        By creating an account or using the service, you agree to these Terms of Service.
        If you do not agree, do not use OpenThorn.
      </p>

      <h2>3. Accounts</h2>
      <ul>
        <li>You must provide a valid email address to register.</li>
        <li>
          You are responsible for maintaining the confidentiality of your account
          credentials.
        </li>
        <li>
          You must notify us immediately at <strong>[CONTACT_EMAIL]</strong> if you suspect
          unauthorised access to your account.
        </li>
        <li>You must be at least 16 years old to use the service.</li>
      </ul>

      <h2>4. Bring Your Own Keys (BYOK)</h2>
      <p>
        OpenThorn does not provide AI model access. You connect your own API keys from
        providers such as OpenAI, Anthropic, or Google. By doing so:
      </p>
      <ul>
        <li>
          Your API keys are used to make requests directly to the AI provider. OpenThorn
          does not store, log, or charge for your API usage.
        </li>
        <li>
          You are solely responsible for the security of your API keys. If a key is
          compromised, revoke it immediately with your provider.
        </li>
        <li>
          You are responsible for all costs incurred with your AI provider. OpenThorn
          charges you nothing.
        </li>
        <li>
          You must comply with the terms of service of the AI provider whose keys you use.
        </li>
      </ul>

      <h2>5. Acceptable Use</h2>
      <p>You agree not to use OpenThorn to:</p>
      <ul>
        <li>Violate any applicable law or regulation.</li>
        <li>
          Generate content that is illegal, harmful, defamatory, or infringes third-party
          rights.
        </li>
        <li>
          Attempt to gain unauthorised access to the service or its infrastructure.
        </li>
        <li>Interfere with or disrupt the service or other users.</li>
        <li>Use automated means to access the service beyond normal usage patterns.</li>
      </ul>

      <h2>6. User Content</h2>
      <p>
        You retain ownership of the prompts you write and the code generated in response to
        your prompts. By using the service, you grant OpenThorn a limited, non-exclusive
        licence to store and serve your content solely to provide the service to you.
      </p>
      <p>
        You are responsible for ensuring that any content you submit does not infringe
        third-party intellectual property rights.
      </p>

      <h2>7. Community Features</h2>
      <p>
        If you share a project publicly through the Community feature, it becomes visible to
        other users. You retain ownership of that content, but you grant other users the
        right to view and fork it within the service.
      </p>
      <p>
        We reserve the right to remove publicly shared content that violates these Terms or
        applicable law.
      </p>

      <h2>8. Intellectual Property</h2>
      <p>
        The OpenThorn name, logo, and interface design are our intellectual property.
        Nothing in these Terms transfers any ownership of OpenThorn's brand or software to
        you. Code output generated by the service belongs to you.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        The service is provided <strong>"as is"</strong> and{' '}
        <strong>"as available"</strong> without warranties of any kind, either express or
        implied. We do not warrant that the service will be uninterrupted, error-free, or
        that generated code will be fit for any particular purpose. You use the service at
        your own risk.
      </p>

      <h2>10. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by applicable law, OpenThorn and its operators
        shall not be liable for any indirect, incidental, special, consequential, or
        punitive damages arising out of or related to your use of the service. Because the
        service is provided free of charge, our aggregate liability to you shall not exceed
        €0.
      </p>
      <p>
        Nothing in these Terms limits liability for fraud, gross negligence, or death or
        personal injury caused by our negligence.
      </p>

      <h2>11. Termination</h2>
      <p>
        We may suspend or terminate your account if you breach these Terms. You may delete
        your account at any time by contacting us at <strong>[CONTACT_EMAIL]</strong>.
        Termination does not affect any accrued rights or obligations.
      </p>

      <h2>12. Changes to Terms</h2>
      <p>
        We may update these Terms at any time by posting the revised version on this page
        with an updated date. Continued use of the service after the update constitutes
        acceptance. If you do not accept the changes, stop using the service and delete your
        account.
      </p>

      <h2>13. Governing Law</h2>
      <p>
        These Terms are governed by Italian law. For users who are consumers under the
        Italian Consumer Code (D.Lgs. 206/2005), the mandatory consumer protection
        provisions of your country of residence also apply. Disputes shall be subject to
        the exclusive jurisdiction of the courts of <strong>[JURISDICTION]</strong>, Italy,
        except where mandatory consumer law provides otherwise.
      </p>

      <h2>14. Contact</h2>
      <p>
        For any questions about these Terms, contact us at <strong>[CONTACT_EMAIL]</strong>.
      </p>
    </LegalPage>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/TermsPage.tsx
git commit -m "feat: add TermsPage with terms of service"
```

---

### Task 4: CookiesPage

**Files:**
- Create: `src/pages/CookiesPage.tsx`

- [ ] **Step 1: Create `src/pages/CookiesPage.tsx`**

```tsx
import LegalPage from './LegalPage'
import { usePageTitle } from '../lib/usePageTitle'

export default function CookiesPage() {
  usePageTitle('Cookie Policy')
  return (
    <LegalPage title="Cookie Policy" lastUpdated="June 6, 2025">
      <h2>1. What Are Cookies and Local Storage</h2>
      <p>
        Cookies are small text files stored in your browser by a website. Many modern web
        applications also use the browser's <strong>localStorage</strong> API — a similar
        mechanism that stores data locally without an expiry date. OpenThorn uses both.
        This page explains exactly what is stored, why, and how to control it.
      </p>

      <h2>2. Essential Storage (No Consent Required)</h2>
      <p>
        The following storage is strictly necessary for the service to function. It cannot
        be disabled without breaking the service.
      </p>
      <ul>
        <li>
          <strong>Supabase authentication session</strong> — stores your login session so
          you remain signed in across page loads. Set by Supabase when you sign in.
          Removed when you sign out or clear your browser data.
        </li>
        <li>
          <strong>Cookie consent preference</strong> — stores your Accept or Reject choice
          (<code>openthorn-cookie-consent</code> in localStorage) so we do not show the
          banner on every visit.
        </li>
      </ul>

      <h2>3. Analytics Storage (Consent Required)</h2>
      <p>
        The following storage is only activated if you click <strong>Accept</strong> on the
        cookie banner.
      </p>
      <ul>
        <li>
          <strong>PostHog analytics</strong> — stores a distinct user identifier and
          session data (keys beginning with <code>ph_</code> in localStorage). Used to
          track page views and feature interactions so we can understand how OpenThorn is
          used and improve it. Data is sent to PostHog, Inc. (US). No advertising or
          cross-site tracking is performed.
        </li>
      </ul>

      <h2>4. What We Do Not Use</h2>
      <ul>
        <li>No advertising or retargeting cookies.</li>
        <li>No third-party social media tracking pixels.</li>
        <li>No data shared with or sold to data brokers.</li>
      </ul>

      <h2>5. Managing Your Preferences</h2>
      <p>You can change your analytics consent at any time:</p>
      <ul>
        <li>
          <strong>Re-open the cookie banner</strong> — clear the{' '}
          <code>openthorn-cookie-consent</code> key from your browser's localStorage
          (DevTools → Application → Local Storage) and reload the page. The banner will
          reappear.
        </li>
        <li>
          <strong>Clear all site data</strong> — in your browser settings, clear site data
          for this domain. Note: this will also sign you out.
        </li>
      </ul>
      <p>
        Withdrawing consent stops new analytics data from being collected. It does not
        delete historical data already sent to PostHog.
      </p>

      <h2>6. Contact</h2>
      <p>
        For questions about our use of cookies or local storage, contact us at{' '}
        <strong>[CONTACT_EMAIL]</strong>.
      </p>
    </LegalPage>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/CookiesPage.tsx
git commit -m "feat: add CookiesPage with cookie policy"
```

---

### Task 5: CookieBanner + analytics gating

**Files:**
- Create: `src/components/CookieBanner/CookieBanner.module.css`
- Create: `src/components/CookieBanner/CookieBanner.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create `src/components/CookieBanner/CookieBanner.module.css`**

```css
.banner {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px 20px;
  background: #13132a;
  border: 1px solid rgba(148, 137, 251, 0.25);
  border-radius: 12px;
  max-width: 680px;
  width: calc(100% - 48px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
}

@media (max-width: 560px) {
  .banner {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}

.text {
  font-size: 0.875rem;
  color: #9090b8;
  margin: 0;
  flex: 1;
  line-height: 1.5;
}

.link {
  color: #9d89fb;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.link:hover {
  color: #b8a9fd;
}

.actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.reject,
.accept {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.reject {
  background: rgba(255, 255, 255, 0.06);
  color: #9090b8;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.reject:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #c8c8e0;
}

.accept {
  background: rgba(157, 137, 251, 0.15);
  color: #9d89fb;
  border: 1px solid rgba(157, 137, 251, 0.3);
}

.accept:hover {
  background: rgba(157, 137, 251, 0.25);
  color: #b8a9fd;
}
```

- [ ] **Step 2: Create `src/components/CookieBanner/CookieBanner.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { initAnalytics } from '../../lib/analytics'
import styles from './CookieBanner.module.css'

const CONSENT_KEY = 'openthorn-cookie-consent'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY)
    if (stored === 'accepted') {
      initAnalytics()
    } else if (!stored) {
      setVisible(true)
    }
  }, [])

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'accepted')
    initAnalytics()
    setVisible(false)
  }

  function reject() {
    localStorage.setItem(CONSENT_KEY, 'rejected')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className={styles.banner} role="dialog" aria-label="Cookie consent">
      <p className={styles.text}>
        We use essential cookies to keep you signed in, and optional analytics to improve
        the service.{' '}
        <Link to="/cookies" className={styles.link}>Learn more</Link>
      </p>
      <div className={styles.actions}>
        <button onClick={reject} className={styles.reject}>Reject</button>
        <button onClick={accept} className={styles.accept}>Accept</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Remove `initAnalytics()` from `src/main.tsx`**

Replace the full file:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SupabaseAuthProvider } from './lib/AuthContext'
import { initSentry } from './lib/sentry'
import App from './App'
import './index.css'

initSentry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SupabaseAuthProvider>
        <App />
      </SupabaseAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 4: Commit**

```bash
git add src/components/CookieBanner/CookieBanner.tsx src/components/CookieBanner/CookieBanner.module.css src/main.tsx
git commit -m "feat: add CookieBanner with consent-gated PostHog analytics"
```

---

### Task 6: Wire up routes, Footer links, and CookieBanner in App

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Footer/Footer.tsx`

- [ ] **Step 1: Replace `src/App.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'
import Header from './components/Header/Header'
import HeroSection from './components/HeroSection/HeroSection'
import MeetOpenThornSection from './components/MeetOpenThornSection/MeetOpenThornSection'
import BYOKSection from './components/BYOKSection/BYOKSection'
import BottomCTA from './components/BottomCTA/BottomCTA'
import Footer from './components/Footer/Footer'
import PricingPage from './pages/PricingPage'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'
import CookiesPage from './pages/CookiesPage'
import DashboardPage from './pages/DashboardPage'
import ProjectBuilderPage from './pages/ProjectBuilderPage'
import ProvidersPage from './pages/ProvidersPage'
import TemplatesPage from './pages/TemplatesPage'
import CommunityPage from './pages/CommunityPage'
import BlogPage from './pages/BlogPage'
import BlogPostPage from './pages/BlogPostPage'
import NotFoundPage from './pages/NotFoundPage'
import AuthModal from './components/AuthModal/AuthModal'
import CookieBanner from './components/CookieBanner/CookieBanner'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute'
import { useAnalytics } from './lib/useAnalytics'
import styles from './App.module.css'

function HomePage() {
  const { user, loading } = useAuth()

  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />

  return (
    <>
      <HeroSection />
      <MeetOpenThornSection />
      <BYOKSection />
      <BottomCTA />
    </>
  )
}

function Layout({ children }: { children: React.ReactNode }) {
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin')

  const openSignIn = () => { setAuthModalMode('signin'); setAuthModalOpen(true) }
  const openSignUp = () => { setAuthModalMode('signup'); setAuthModalOpen(true) }

  useEffect(() => {
    const handleRequireAuth = () => openSignIn()
    window.addEventListener('openthorn:require-auth', handleRequireAuth)
    return () => window.removeEventListener('openthorn:require-auth', handleRequireAuth)
  }, [])

  return (
    <>
      <Header onSignIn={openSignIn} onSignUp={openSignUp} />
      <main>{children}</main>
      <Footer />
      <CookieBanner />
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </>
  )
}

export default function App() {
  useAnalytics()

  return (
    <ErrorBoundary>
      <div className={styles.app}>
        <Routes>
          <Route path="/" element={<Layout><HomePage /></Layout>} />
          <Route path="/pricing" element={<Layout><PricingPage /></Layout>} />
          <Route path="/privacy" element={<Layout><PrivacyPage /></Layout>} />
          <Route path="/terms" element={<Layout><TermsPage /></Layout>} />
          <Route path="/cookies" element={<Layout><CookiesPage /></Layout>} />
          <Route path="/blog" element={<Layout><BlogPage /></Layout>} />
          <Route path="/blog/:slug" element={<Layout><BlogPostPage /></Layout>} />
          <Route path="/dashboard" element={<ProtectedRoute pageName="the Dashboard"><DashboardPage /></ProtectedRoute>} />
          <Route path="/projects/:projectId" element={<ProtectedRoute pageName="your project"><ProjectBuilderPage /></ProtectedRoute>} />
          <Route path="/templates" element={<ProtectedRoute pageName="Templates"><TemplatesPage /></ProtectedRoute>} />
          <Route path="/community" element={<ProtectedRoute pageName="Community"><CommunityPage /></ProtectedRoute>} />
          <Route path="/providers" element={<ProtectedRoute pageName="Providers"><ProvidersPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </ErrorBoundary>
  )
}
```

- [ ] **Step 2: Replace `src/components/Footer/Footer.tsx`**

```tsx
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
  { label: 'Guides', href: '#' },
  { label: 'Docs & FAQs', href: '#' },
]

const legalLinks = [
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Terms of Service', to: '/terms' },
  { label: 'Cookie Policy', to: '/cookies' },
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
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/components/Footer/Footer.tsx
git commit -m "feat: add legal page routes, wire footer links and CookieBanner"
```

---

## Self-Review

**Spec coverage:**
- ✅ PrivacyPage — GDPR Art. 13, covers Supabase/PostHog(consent-gated)/Sentry, all user rights, Garante complaint path
- ✅ TermsPage — BYOK model, no payments, acceptable use, UGC/Community, IP, liability, Italian governing law
- ✅ CookiesPage — essential vs analytics storage, PostHog `ph_*` keys documented, how to manage/withdraw
- ✅ CookieBanner — gates PostHog until accepted, equal-prominence Reject/Accept per Garante rules, persists choice to localStorage
- ✅ Analytics gating — `initAnalytics()` removed from `main.tsx`; only called on consent or recalled prior consent
- ✅ Routes — `/privacy`, `/terms`, `/cookies` added as public routes in `App.tsx`
- ✅ Footer — legal links updated from `#` to real paths using React Router `<Link>`

**Placeholder scan:** Legal content uses `[CONTROLLER_NAME]`, `[CONTROLLER_ADDRESS]`, `[CONTACT_EMAIL]`, `[JURISDICTION]` — intentional per user instruction.

**Type consistency:**
- `LegalPage` props (`title: string`, `lastUpdated: string`, `children: React.ReactNode`) used identically in Tasks 2, 3, 4
- `CONSENT_KEY = 'openthorn-cookie-consent'` defined once in CookieBanner, referenced in CookiesPage text
- `initAnalytics()` imported from `../../lib/analytics` in CookieBanner — matches existing named export
