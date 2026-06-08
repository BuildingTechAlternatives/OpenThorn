import LegalPage from './LegalPage'
import { usePageTitle } from '../lib/usePageTitle'

export default function ImprintPage() {
  usePageTitle('Imprint')
  return (
    <LegalPage title="Imprint" lastUpdated="June 8, 2026">
      <h2>Service Provider</h2>
      <p>
        <strong>Thomas Tschinkel</strong><br />
        OpenThorn<br />
        Rome, Italy
      </p>

      <h2>Legal Address</h2>
      <p>
        The full postal address of the operator must be added here before public or
        commercial operation of the service. "Rome, Italy" alone may not satisfy provider
        information duties for an Italian or EU information society service.
      </p>

      <h2>Contact Details</h2>
      <p>
        Name: Thomas Tschinkel<br />
        Email: <a href="mailto:mys.thomas00@gmail.com">mys.thomas00@gmail.com</a>
      </p>

      <h2>Business and Tax Information</h2>
      <p>
        If OpenThorn is operated commercially or through a registered business, add the
        applicable business name, legal form, registration number, register court or
        chamber of commerce entry, VAT or Partita IVA, and PEC address here.
      </p>

      <h2>Responsible for Content</h2>
      <p>
        Thomas Tschinkel is responsible for OpenThorn content unless otherwise stated.
        User-generated Community content is handled under the{' '}
        <a href="/moderation">Moderation and DSA Notice</a>.
      </p>

      <h2>Dispute Resolution</h2>
      <p>
        The European Commission's former Online Dispute Resolution platform stopped
        accepting new complaints on March 20, 2025 and was discontinued on July 20, 2025.
        OpenThorn is not currently obliged or willing to participate in a voluntary
        consumer arbitration procedure unless mandatory law requires otherwise.
      </p>
    </LegalPage>
  )
}
