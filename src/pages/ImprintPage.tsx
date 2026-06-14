import LegalPage from './LegalPage'
import { usePageTitle } from '../lib/usePageTitle'

export default function ImprintPage() {
  usePageTitle('Imprint', {
    description: 'Legal disclosure and operator information for OpenThorn, the bring-your-own-key AI website builder.',
  })
  return (
    <LegalPage title="Imprint" lastUpdated="June 8, 2026">
      <h2>Operator</h2>
      <p>
        Name: <strong>Thomas Tschinkel</strong><br />
        Email: <a href="mailto:btalabs.contact@gmail.com">btalabs.contact@gmail.com</a><br />
        Country: Italy
      </p>
    </LegalPage>
  )
}
