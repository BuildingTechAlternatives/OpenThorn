import LegalPage from './LegalPage'
import { usePageTitle } from '../lib/usePageTitle'

export default function PrivacyPage() {
  usePageTitle('Privacy Policy')
  return (
    <LegalPage title="Privacy Policy" lastUpdated="June 8, 2026">
      <h2>1. Who We Are</h2>
      <p>
        OpenThorn is operated by <strong>Thomas Tschinkel</strong>, located in{' '}
        <strong>Rome, Italy</strong> (the "Data Controller"). For privacy-related enquiries,
        contact us at{' '}
        <strong><a href="mailto:mys.thomas00@gmail.com">mys.thomas00@gmail.com</a></strong>.
      </p>

      <h2>2. What Data We Process</h2>
      <p>We process the data needed to provide, secure, and improve OpenThorn:</p>
      <ul>
        <li>
          <strong>Account and profile data</strong> - email address, display name,
          avatar URL, OAuth account metadata, authentication identifiers, and session data.
        </li>
        <li>
          <strong>Project and repository data</strong> - project names, prompts, chat
          history, generated code, uploaded or edited files, preview/deploy metadata,
          starred status, and repository names or owner names when you connect GitHub.
        </li>
        <li>
          <strong>API provider data</strong> - AI provider names, model settings, base
          URLs, enabled/disabled status, and API keys you save. API keys are encrypted
          before database storage and are decrypted only when needed to send your request
          to the AI provider you selected.
        </li>
        <li>
          <strong>AI request data</strong> - prompts, project context, generated files,
          runtime errors, and other technical context needed to produce or refine output.
          This data may be sent to the AI provider you choose.
        </li>
        <li>
          <strong>GitHub integration data</strong> - GitHub OAuth access tokens, GitHub
          username, repository owner/name, repository descriptions, auto-sync setting,
          and code pushed to GitHub when you enable repository sync.
        </li>
        <li>
          <strong>Deployment data</strong> - generated HTML, project identifiers, Netlify
          site IDs, deploy IDs, deploy URLs, and related deployment status data when you
          use the Netlify deployment feature.
        </li>
        <li>
          <strong>Community and collaboration data</strong> - public shared projects,
          author/profile details displayed with community projects, likes, collaborator
          email addresses, collaborator permissions, invite status, and real-time presence
          or generation state used to support collaboration.
        </li>
        <li>
          <strong>Local user memory</strong> - optional browser-local preferences, fixes,
          and facts inferred from your prompts so OpenThorn can keep useful context across
          projects on the same browser.
        </li>
        <li>
          <strong>Technical data</strong> - IP address, browser/device data, request
          logs, error information, and security events processed by our hosting,
          authentication, database, font, CDN, and integration providers.
        </li>
      </ul>

      <h2>3. Why We Process Data and Legal Bases</h2>
      <ul>
        <li>
          <strong>Providing the service</strong> - account access, project storage,
          AI generation, GitHub sync, Netlify deploys, collaboration, and community
          features are processed under Art. 6(1)(b) GDPR (performance of a contract).
        </li>
        <li>
          <strong>Security, abuse prevention, reliability, and essential diagnostics</strong> -
          processed under Art. 6(1)(f) GDPR (legitimate interests).
        </li>
        <li>
          <strong>Legal compliance</strong> - records or disclosures required by law are
          processed under Art. 6(1)(c) GDPR.
        </li>
        <li>
          <strong>Optional connected services</strong> - when you choose OAuth login,
          GitHub sync, provider keys, public sharing, or deployment, we process the data
          needed for that feature under Art. 6(1)(b) GDPR and, where required, your
          consent under Art. 6(1)(a) GDPR.
        </li>
      </ul>

      <h2>4. Third-Party Services and Recipients</h2>
      <p>We use service providers and integrations that may process personal data:</p>
      <ul>
        <li>
          <strong>Vercel Inc.</strong> (hosting and infrastructure) - request data,
          including IP addresses and technical logs, may be processed by Vercel.
        </li>
        <li>
          <strong>Supabase, Inc.</strong> (authentication, database, realtime) - account,
          profile, session, project, collaboration, community, encrypted provider-key,
          and GitHub integration records are stored or processed on Supabase infrastructure.
        </li>
        <li>
          <strong>AI providers you select</strong> (for example OpenAI, Anthropic, Google,
          Mistral, Groq, OpenRouter, or custom providers) - prompts, project context,
          generated files or errors, and your API key or authorization credentials are
          transmitted as needed to fulfil your AI request.
        </li>
        <li>
          <strong>GitHub, Inc.</strong> - OAuth login data and, if you connect a repository,
          OAuth access tokens, repository metadata, and project code are processed by GitHub.
        </li>
        <li>
          <strong>Netlify, Inc.</strong> - when you deploy, generated HTML and deployment
          metadata are sent to Netlify to create or update a site.
        </li>
        <li>
          <strong>Google Fonts / Google LLC</strong> - OpenThorn loads fonts from Google
          Fonts. When your browser requests those font resources, Google may receive your
          IP address, browser data, referrer, and request timing information.
        </li>
        <li>
          <strong>CDN and package providers</strong> - generated previews may load runtime
          resources such as JavaScript packages, type definitions, or WebAssembly files
          from public CDNs when needed to build, preview, or typecheck generated code.
        </li>
        <li>
          <strong>OAuth providers</strong> (Google and GitHub) - if you sign in with an
          OAuth provider, that provider processes authentication data according to its own
          terms and privacy policy.
        </li>
      </ul>
      <p>
        OpenThorn does not sell your personal data. API keys are not used for OpenThorn
        billing and are not disclosed except where technically necessary to communicate
        with the provider you selected or where legally required.
      </p>
      <p>
        Where a provider acts as our processor, we aim to use appropriate data processing
        terms, confidentiality obligations, and transfer safeguards. Where a third-party
        service is independently selected by you, such as your AI provider or GitHub
        account, that service may also act as an independent controller under its own
        terms.
      </p>

      <h2>5. Security Measures</h2>
      <p>
        We use technical and organisational measures intended to protect personal data,
        including Supabase row-level security, authenticated access controls, HTTPS,
        provider-side infrastructure security, and encryption of saved provider API keys
        before database storage.
      </p>
      <p>
        Saved provider API keys are sensitive credentials. OpenThorn encrypts them before
        database storage and decrypts them only when needed to send your request to the
        provider you selected. This reduces exposure but does not make stored keys risk
        free. You remain responsible for managing provider-side permissions, spend limits,
        and key rotation, and you should revoke a key immediately if you suspect misuse.
      </p>

      <h2>6. Public Sharing</h2>
      <p>
        If you publish a project to the Community, its title, preview, generated content,
        author/profile information, likes count, and related metadata may be visible to
        other users or visitors. Do not publish secrets, credentials, private repository
        data, or personal information you do not want to make public.
      </p>

      <h2>7. Data Retention</h2>
      <ul>
        <li>
          <strong>Account, profile, project, provider-key, integration, collaboration,
          and community data</strong> - retained while your account is active or until you
          delete it or request deletion, unless a longer retention period is required by law.
        </li>
        <li>
          <strong>GitHub tokens and repo settings</strong> - retained until you disconnect
          GitHub, delete the related data, or request deletion.
        </li>
        <li>
          <strong>Deployment metadata</strong> - retained while needed to show and update
          your deployment. Data hosted by Netlify may remain in your Netlify-managed site
          according to Netlify's retention practices.
        </li>
        <li>
          <strong>Browser-local data</strong> - remains on your device until you clear it,
          sign out where applicable, or the app removes it.
        </li>
        <li>
          <strong>Server logs and security records</strong> - retained for a limited
          period needed for security, debugging, and legal compliance.
        </li>
      </ul>

      <h2>8. International Data Transfers</h2>
      <p>
        Some providers are based in or process data in the United States and other
        countries outside the EU/EEA. Where required, transfers are protected by adequacy
        decisions, Standard Contractual Clauses, the EU-US Data Privacy Framework where
        applicable, or other safeguards under Chapter V GDPR.
      </p>

      <h2>9. Your Rights</h2>
      <p>Under the GDPR you have the right to:</p>
      <ul>
        <li><strong>Access</strong> - request a copy of your personal data.</li>
        <li><strong>Rectification</strong> - ask us to correct inaccurate data.</li>
        <li><strong>Erasure</strong> - ask us to delete your account and associated data.</li>
        <li>
          <strong>Restriction</strong> - ask us to pause processing in certain
          circumstances.
        </li>
        <li>
          <strong>Portability</strong> - receive your data in a structured,
          machine-readable format.
        </li>
        <li><strong>Object</strong> - object to processing based on legitimate interests.</li>
        <li>
          <strong>Withdraw consent</strong> - withdraw consent where processing is based
          on consent, without affecting prior lawful processing.
        </li>
      </ul>
      <p>
        To exercise any of these rights, email us at{' '}
        <strong><a href="mailto:mys.thomas00@gmail.com">mys.thomas00@gmail.com</a></strong>.
        We will respond within 30 days.
      </p>

      <h2>10. Complaints</h2>
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

      <h2>11. Changes to This Policy</h2>
      <p>
        We may update this policy from time to time. When we do, we will update the "Last
        updated" date at the top of this page. For material changes that affect your
        rights under the GDPR - such as new categories of data collected, new processors,
        or a new legal basis - we will notify you by email or a prominent notice in the
        service and, where required by law, seek your renewed consent.
      </p>

      <h2>12. Contact</h2>
      <p>
        For any questions about this privacy policy or your personal data, contact us at{' '}
        <strong><a href="mailto:mys.thomas00@gmail.com">mys.thomas00@gmail.com</a></strong>.
      </p>
    </LegalPage>
  )
}
