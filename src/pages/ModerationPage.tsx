import LegalPage from './LegalPage'
import { usePageTitle } from '../lib/usePageTitle'

export default function ModerationPage() {
  usePageTitle('Moderation and DSA')
  return (
    <LegalPage title="Moderation and DSA Notice" lastUpdated="June 8, 2026">
      <h2>1. Scope</h2>
      <p>
        This notice explains how OpenThorn handles reports about illegal content,
        unlawful activity, intellectual-property complaints, and community moderation.
        It applies to public or shared areas of the service, including Community
        projects, public previews, project metadata, and user-visible profile details.
      </p>

      <h2>2. Single Point of Contact</h2>
      <p>
        For Digital Services Act, moderation, law-enforcement, or regulatory enquiries,
        contact us at{' '}
        <strong><a href="mailto:mys.thomas00@gmail.com">mys.thomas00@gmail.com</a></strong>.
        Please write in English, German, or Italian and include enough detail for us to
        identify the content or account concerned.
      </p>

      <h2>3. How to Report Illegal Content</h2>
      <p>
        If you believe content on OpenThorn is illegal or infringes your rights, email us
        with the following information:
      </p>
      <ul>
        <li>The URL, project ID, username, screenshot, or other identifier of the content.</li>
        <li>A clear explanation of why you believe the content is illegal or infringing.</li>
        <li>Your name and email address, unless you have a legally valid reason to report anonymously.</li>
        <li>For intellectual-property reports, proof that you own or represent the affected rights.</li>
        <li>A statement that the information in your report is accurate to the best of your knowledge.</li>
      </ul>

      <h2>4. Review and Action</h2>
      <p>
        We review reports in good faith and may remove, restrict, disable, or preserve
        content where this is necessary to comply with law, protect users, enforce our
        Terms, or investigate abuse. We may also reject reports that are incomplete,
        abusive, clearly unfounded, or not related to OpenThorn.
      </p>
      <p>
        When we take moderation action against user content, we will provide the affected
        user with a brief explanation where appropriate and legally permitted. We may not
        provide details if doing so would create security risks, reveal confidential
        information, interfere with an investigation, or violate applicable law.
      </p>

      <h2>5. Appeals</h2>
      <p>
        If your content or account is restricted and you believe the decision was wrong,
        contact us at{' '}
        <strong><a href="mailto:mys.thomas00@gmail.com">mys.thomas00@gmail.com</a></strong>
        {' '}with the subject line "Moderation Appeal". Include the original decision,
        your account email, the affected content, and why you believe the decision should
        be changed.
      </p>

      <h2>6. Repeat Abuse</h2>
      <p>
        We may suspend or terminate accounts that repeatedly publish illegal content,
        submit manifestly unfounded reports, attempt to evade moderation, or abuse the
        reporting process.
      </p>

      <h2>7. Community Standards</h2>
      <p>
        Public OpenThorn content must not include illegal material, malware, phishing,
        stolen credentials, private personal data, impersonation, copyright-infringing
        material, hate or harassment, sexual exploitation, or content that endangers
        children. Do not publish API keys, passwords, private repository data, or personal
        information you do not have permission to share.
      </p>

      <h2>8. Emergency and Authority Requests</h2>
      <p>
        Public authorities and law-enforcement bodies may contact us at{' '}
        <strong><a href="mailto:mys.thomas00@gmail.com">mys.thomas00@gmail.com</a></strong>.
        We will review requests under applicable law and may require proof of authority,
        legal basis, and a clear description of the requested action.
      </p>
    </LegalPage>
  )
}
