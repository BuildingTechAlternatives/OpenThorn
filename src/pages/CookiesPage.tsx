import LegalPage from './LegalPage'
import { usePageTitle } from '../lib/usePageTitle'

export default function CookiesPage() {
  usePageTitle('Cookie Policy')
  return (
    <LegalPage title="Cookie and Storage Policy" lastUpdated="June 8, 2026">
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

      <h2>4. Consent Banner</h2>
      <p>
        OpenThorn currently does not use analytics cookies, advertising cookies,
        retargeting pixels, or third-party social media tracking pixels. Because the
        current browser storage is used for authentication, security, and requested app
        functionality, we do not show a cookie consent banner. If we add non-essential
        cookies or tracking, we will update this page and request consent where required.
      </p>

      <h2>5. External Resource Requests</h2>
      <p>
        OpenThorn may load fonts, generated-preview runtime packages, type definitions,
        or WebAssembly resources from third-party CDNs. These requests are not used by
        OpenThorn for advertising or behavioural tracking, but the third-party provider
        may receive technical request data such as your IP address, browser information,
        requested URL, referrer, and request time.
      </p>
      <p>
        We describe these providers and data flows in the Privacy Policy. If we add
        analytics, profiling, advertising, or other non-essential tracking, we will update
        this notice and request consent where required.
      </p>

      <h2>6. How to Control Storage</h2>
      <p>
        You can clear cookies and localStorage through your browser settings. Clearing
        storage may sign you out, remove local preferences, reset notification state, and
        disconnect browser-local GitHub repository settings. Server-side account,
        project, provider-key, integration, collaboration, and community records are
        handled as described in the Privacy Policy.
      </p>

      <h2>7. What We Do Not Use</h2>
      <ul>
        <li>No analytics or tracking cookies.</li>
        <li>No advertising or retargeting cookies.</li>
        <li>No third-party social media tracking pixels.</li>
        <li>No data shared with or sold to data brokers.</li>
      </ul>

      <h2>8. Contact</h2>
      <p>
        For questions about our use of cookies or local storage, contact us at{' '}
        <strong><a href="mailto:mys.thomas00@gmail.com">mys.thomas00@gmail.com</a></strong>.
      </p>
    </LegalPage>
  )
}
