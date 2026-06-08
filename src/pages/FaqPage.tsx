import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../lib/usePageTitle'
import styles from './FaqPage.module.css'

interface FaqItem {
  question: string
  answer: React.ReactNode
}

interface FaqCategory {
  label: string
  items: FaqItem[]
}

const FAQ_DATA: FaqCategory[] = [
  {
    label: 'Getting Started',
    items: [
      {
        question: 'What is OpenThorn?',
        answer:
          'OpenThorn is an AI-powered app builder. You describe what you want to build in plain language, and OpenThorn generates the code and deploys a working website — no coding skills required.',
      },
      {
        question: 'Do I need to know how to code?',
        answer:
          'No. OpenThorn handles the technical side entirely. You write in plain English and the AI takes care of the rest. If you do know how to code, you can still inspect and modify the generated output.',
      },
      {
        question: 'How do I get started?',
        answer: (
          <>
            Sign up for a free account, add an API key for at least one AI provider (such as OpenAI
            or Anthropic), create a project, and start describing your app. The{' '}
            <Link to="/providers">Providers page</Link> shows all supported providers.
          </>
        ),
      },
    ],
  },
  {
    label: 'BYOK & API Keys',
    items: [
      {
        question: 'What does BYOK mean?',
        answer:
          'BYOK stands for Bring Your Own Key. Rather than routing all AI usage through a shared account, you supply your own API key directly from an AI provider. This means you pay your provider directly and OpenThorn never controls your billing.',
      },
      {
        question: 'Where do I get an API key?',
        answer: (
          <>
            From your chosen provider&rsquo;s developer portal — for example,{' '}
            <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer">
              platform.openai.com
            </a>{' '}
            for OpenAI or{' '}
            <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">
              console.anthropic.com
            </a>{' '}
            for Anthropic. Create an account there, generate an API key, and paste it into
            OpenThorn&rsquo;s Providers page.
          </>
        ),
      },
      {
        question: 'Which AI providers are supported?',
        answer: (
          <>
            OpenAI and Anthropic are supported today, with more on the way. See the{' '}
            <Link to="/providers">Providers page</Link> inside the app for the current full list and
            per-model pricing data.
          </>
        ),
      },
      {
        question: 'Can I use multiple providers?',
        answer:
          'Yes. You can add keys for several providers and choose which model to use on a per-project basis. This lets you balance cost and quality for different types of work.',
      },
    ],
  },
  {
    label: 'Security & Privacy',
    items: [
      {
        question: 'Are my API keys safe?',
        answer:
          'Saved API keys are encrypted before database storage, are not used for OpenThorn billing, and are decrypted only when needed to send your request to the AI provider you selected. You should still set provider-side spend limits, rotate keys, and revoke any key you suspect has been exposed.',
      },
      {
        question: 'What data does OpenThorn store?',
        answer:
          'We store the data needed to provide the service, including account/profile data, encrypted API keys, project names, prompts, generated code, collaboration records, community likes, deployment metadata, and optional GitHub integration data. Browser-local storage may also keep app preferences and local user memory.',
      },
      {
        question: 'Where is my data hosted?',
        answer:
          "Your data is hosted on Vercel's infrastructure. Request data including IP addresses may be processed by Vercel, and data may be transferred to the United States under Standard Contractual Clauses (SCCs) in compliance with GDPR.",
      },
      {
        question: 'Can I delete my data?',
        answer: (
          <>
            Yes. Email{' '}
            <a href="mailto:mys.thomas00@gmail.com">mys.thomas00@gmail.com</a> to request full
            account and data deletion. We will process your request within 30 days.
          </>
        ),
      },
    ],
  },
  {
    label: 'Pricing',
    items: [
      {
        question: 'Is OpenThorn free to use?',
        answer:
          'The OpenThorn platform itself is free. You only pay for the AI usage billed directly by your provider — OpenThorn adds no markup. Your provider charges you based on the model you choose and the number of tokens generated.',
      },
      {
        question: 'Does OpenThorn charge per generation?',
        answer:
          'No. OpenThorn does not take a cut of your AI usage. All generation costs go directly to your provider account, billed according to their standard rates.',
      },
      {
        question: 'Where can I see model pricing?',
        answer: (
          <>
            On the <Link to="/pricing">Pricing page</Link>, which shows live cost and quality data
            for all supported flagship models so you can choose the best model for your budget.
          </>
        ),
      },
    ],
  },
]

function AccordionItem({ question, answer }: FaqItem) {
  const [open, setOpen] = useState(false)

  return (
    <div className={[styles.item, open ? styles.itemOpen : ''].filter(Boolean).join(' ')}>
      <button className={styles.question} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>{question}</span>
        <svg
          className={styles.chevron}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 6l5 5 5-5" />
        </svg>
      </button>
      <div className={styles.answer} style={open ? { maxHeight: '600px' } : undefined}>
        <div className={styles.answerInner}>{answer}</div>
      </div>
    </div>
  )
}

export default function FaqPage() {
  usePageTitle('FAQ')

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.hero}>
          <h1 className={styles.title}>Frequently Asked Questions</h1>
          <p className={styles.subtitle}>
            Everything you need to know about OpenThorn. Can&rsquo;t find your answer?{' '}
            <a href="mailto:mys.thomas00@gmail.com">Drop us a line.</a>
          </p>
        </header>

        {FAQ_DATA.map((category) => (
          <section key={category.label} className={styles.group}>
            <p className={styles.groupLabel}>{category.label}</p>
            {category.items.map((item) => (
              <AccordionItem key={item.question} {...item} />
            ))}
          </section>
        ))}

        <div className={styles.cta}>
          Still have questions?{' '}
          <a href="mailto:mys.thomas00@gmail.com">Contact us</a> — we&rsquo;re happy to help.
        </div>
      </div>
    </div>
  )
}
