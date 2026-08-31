import LegalPage from './LegalPage'
import { usePageTitle } from '../lib/usePageTitle'
import { openConsentPreferences } from '../lib/consent'

export default function CookiesPage() {
  usePageTitle('Cookie Policy', {
    description:
      'How OpenThorn uses cookies and local storage. Essential storage keeps you signed in, analytics are cookieless, and advertising stays off until you consent.',
  })
  return (
    <LegalPage title="Cookie and Storage Policy" lastUpdated="August 31, 2026">
      <h2>1. What Cookies and Local Storage Are</h2>
      <p>
        Cookies are small text files stored in your browser by a website. Modern web apps
        also use browser storage such as <strong>localStorage</strong> and{' '}
        <strong>sessionStorage</strong>. This page explains what OpenThorn stores in your
        browser and why.
      </p>

      <h2>2. Essential Authentication Storage</h2>
      <p>
        OpenThorn uses Supabase Auth to keep you signed in and protect account-only pages.
        Depending on browser and Supabase behavior, session information may be stored in
        browser storage and related authentication cookies. This storage is necessary for
        login, logout, account security, and session restoration.
      </p>

      <h2>3. Essential App Storage</h2>
      <p>
        OpenThorn also uses localStorage for product features that need to survive page
        reloads on the same browser:
      </p>
      <ul>
        <li>
          <strong>openthorn.consent.v1</strong> - stores your cookie consent choices (which
          categories you enabled and when), so your decision is respected across visits
          without asking again on every page load.
        </li>
        <li>
          <strong>seen_shared_projects_*</strong> - remembers which shared-project
          notifications you have already seen, so the dashboard does not repeat the same
          notice after every refresh.
        </li>
        <li>
          <strong>github_repo_*</strong> - stores per-project GitHub repository owner,
          repository name, and auto-sync preference for the browser you are using.
        </li>
        <li>
          <strong>openthorn.memory.*</strong> - stores local user-memory entries such as
          inferred design preferences, recurring fixes, and useful facts across projects.
        </li>
        <li>
          <strong>Preview storage polyfills</strong> - generated project previews may use
          in-memory replacements for localStorage or sessionStorage when sandboxed previews
          cannot access normal browser storage.
        </li>
      </ul>

      <h2>4. Cookieless Analytics and Performance Monitoring</h2>
      <p>
        OpenThorn uses <strong>Vercel Web Analytics</strong> to count anonymous page
        views and <strong>Vercel Speed Insights</strong> to measure anonymous web
        performance metrics (such as page load and responsiveness timings). Both
        services are cookieless: they do not set cookies, do not store identifiers in
        localStorage or sessionStorage, and do not track you across sites or sessions.
        Because nothing is stored on your device for analytics or performance-measurement
        purposes, this does not require cookie consent under the ePrivacy rules. See the
        Privacy Policy for details on how this data is processed.
      </p>

      <h2>5. Consent Banner and Consent Categories</h2>
      <p>
        Non-essential services on OpenThorn are opt-in. When you first visit, a consent
        banner offers three choices on equal terms: <strong>Accept all</strong>,{' '}
        <strong>Reject non-essential</strong>, and <strong>Manage preferences</strong>.
        The categories are:
      </p>
      <ul>
        <li>
          <strong>Essential</strong> - always active. Authentication, security, and the
          product functionality described in sections 2 and 3. This category does not
          require consent.
        </li>
        <li>
          <strong>Advertising / Marketing</strong> - <strong>off by default</strong>. If
          you enable it, third-party advertising technologies may run on public marketing
          and content pages (see section 6).
        </li>
      </ul>
      <p>
        Your choice is stored locally in your browser (openthorn.consent.v1) so you are not
        asked again on every visit. You can change or withdraw consent at any time via the
        <strong> "Cookie Settings"</strong> button in the footer or the button below.
        Withdrawing consent stops advertising technologies from loading again; it does not
        affect processing that already took place.
      </p>
      <p>
        <button type="button" className="linkButton" onClick={openConsentPreferences}>
          Manage cookie preferences
        </button>
      </p>

      <h2>6. Advertising and Third-Party Ad Technologies</h2>
      <p>
        Some public marketing and content pages (for example the blog, guides, and
        comparison pages) show advertising provided by <strong>Adsterra</strong>, an
        advertising network operated by Ad Market Limited (Cyprus) and Admedia LLC FZ
        (United Arab Emirates).
      </p>
      <p>
        Advertising is <strong>disabled by default</strong>: the Adsterra script and any
        related third-party advertising technologies are not loaded unless you have enabled
        the Advertising/Marketing category in the consent banner. If you choose "Reject
        non-essential", advertising stays fully disabled. When enabled, Adsterra and its
        advertising partners may use cookies or similar technologies and may process data
        such as your IP address, browser and device information, and ad impressions and
        interactions, for advertising, measurement, and fraud-prevention purposes, as
        described in the{' '}
        <a
          href="https://www.adsterra.com/privacy-policy/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Adsterra Privacy Policy
        </a>{' '}
        and{' '}
        <a href="https://adsterra.com/cookies/" target="_blank" rel="noopener noreferrer">
          Adsterra Cookies Policy
        </a>
        . Advertising placements are always labelled so they cannot be confused with
        OpenThorn's interface.
      </p>

      <h2>7. External Resource Requests</h2>
      <p>
        OpenThorn's fonts are self-hosted and served from our own infrastructure — no
        font requests are made to Google or other third parties. Generated project
        previews may load runtime packages, type definitions, or WebAssembly resources
        from third-party CDNs. These requests are not used by
        OpenThorn for advertising or behavioural tracking, but the third-party provider
        may receive technical request data such as your IP address, browser information,
        requested URL, referrer, and request time.
      </p>
      <p>
        We describe these providers and data flows in the Privacy Policy. Advertising as
        described in section 6 is loaded only with your consent. If we add further
        analytics, profiling, or other non-essential tracking, we will update this notice
        and request consent where required.
      </p>

      <h2>8. How to Control Storage</h2>
      <p>
        You can clear cookies and localStorage through your browser settings. Clearing
        storage may sign you out, remove local preferences, reset notification state, and
        disconnect browser-local GitHub repository settings. Clearing the consent entry
        (openthorn.consent.v1) causes the consent banner to appear again on your next
        visit. Server-side account, project, provider-key, integration, collaboration, and
        community records are handled as described in the Privacy Policy.
      </p>

      <h2>9. What We Do Not Use</h2>
      <ul>
        <li>No analytics or tracking cookies (our analytics is cookieless).</li>
        <li>
          No advertising or retargeting technologies are enabled unless you consent to the
          Advertising/Marketing category; third-party ad providers such as Adsterra may
          then use cookies or similar technologies as described in section 6 and their own
          policies.
        </li>
        <li>No third-party social media tracking pixels.</li>
        <li>No data shared with or sold to data brokers.</li>
      </ul>

      <h2>10. Contact</h2>
      <p>
        For questions about our use of cookies or local storage, contact us at{' '}
        <strong><a href="mailto:btalabs.contact@gmail.com">btalabs.contact@gmail.com</a></strong>.
      </p>
    </LegalPage>
  )
}
