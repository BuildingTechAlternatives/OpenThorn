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
      <p>We use the following processors who handle personal data on our behalf:</p>
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
        <li>
          <strong>Erasure</strong> — ask us to delete your account and associated data.
        </li>
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
