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
