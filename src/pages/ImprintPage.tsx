import LegalPage from './LegalPage'
import { usePageTitle } from '../lib/usePageTitle'

export default function ImprintPage() {
  usePageTitle('Imprint')
  return (
    <LegalPage title="Imprint" lastUpdated="June 8, 2026">
      <h2>Operator</h2>
      <p>
        Name: <strong>Thomas Tschinkel</strong><br />
        Email: <a href="mailto:mys.thomas00@gmail.com">mys.thomas00@gmail.com</a><br />
        Country: Italy
      </p>
    </LegalPage>
  )
}
