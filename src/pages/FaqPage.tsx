import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../lib/usePageTitle'
import faqData from '../data/faq.json'
import styles from './FaqPage.module.css'

// Shown on the page and kept loosely in sync with content edits to faq.json —
// answer engines favor visibly dated, current facts.
const LAST_UPDATED = '2026-06-11'

// FAQ content lives in src/data/faq.json (plain text) so scripts/prerender.mjs
// can emit the same questions/answers as static FAQPage JSON-LD. Answers that
// need links are overridden here, keyed by question; the plain-text version in
// faq.json must stay equivalent in substance.
const RICH_ANSWERS: Record<string, React.ReactNode> = {
  'How do I get started?': (
    <>
      Sign up for a free account, add an API key for at least one AI provider (such as OpenAI or
      Anthropic), create a project, and start describing your app. The{' '}
      <Link to="/providers">Providers page</Link> shows all supported providers.
    </>
  ),
  'Where do I get an API key?': (
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
  'Which AI providers are supported?': (
    <>
      OpenThorn supports 18 AI providers: OpenAI, Anthropic, Google Gemini, DeepSeek, Mistral AI,
      Groq, Together AI, xAI, Cohere, Perplexity, OpenRouter, RodiumAi, Ollama, Fireworks AI, Cerebras, Azure
      OpenAI, Amazon Bedrock, and NVIDIA NIM. See the <Link to="/providers">Providers page</Link>{' '}
      inside the app for the current list and per-model pricing data.
    </>
  ),
  'Can I delete my data?': (
    <>
      Yes. Email <a href="mailto:mys.thomas00@gmail.com">mys.thomas00@gmail.com</a> to request full
      account and data deletion. We will process your request within 30 days.
    </>
  ),
  'How much does building a website cost?': (
    <>
      It depends on the model you choose: generating a typical website costs cents to a few dollars
      in provider API usage. OpenThorn itself charges nothing — there is no subscription and no
      platform fee. Compare models on the <Link to="/pricing">Pricing page</Link>.
    </>
  ),
  'Where can I see model pricing?': (
    <>
      On the <Link to="/pricing">Pricing page</Link>, which shows live cost and quality data for all
      supported flagship models so you can choose the best model for your budget.
    </>
  ),
}

interface FaqItem {
  question: string
  answer: string
}

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
        <div className={styles.answerInner}>{RICH_ANSWERS[question] ?? answer}</div>
      </div>
    </div>
  )
}

export default function FaqPage() {
  usePageTitle('FAQ', {
    description: 'Answers to common questions about OpenThorn — how bring-your-own-key works, supported AI providers, costs, and deploying your generated site.',
  })

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Support</p>
          <h1 className={styles.title}>
            Questions, <span className={styles.titleAccent}>answered</span>
          </h1>
          <p className={styles.subtitle}>
            Everything you need to know about OpenThorn. Can&rsquo;t find your answer?{' '}
            <a href="mailto:mys.thomas00@gmail.com">Drop us a line.</a>
          </p>
          <p className={styles.lastUpdated}>
            Last updated:{' '}
            <time dateTime={LAST_UPDATED}>
              {new Date(LAST_UPDATED).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          </p>
        </header>

        {faqData.map((category) => (
          <section key={category.label} className={styles.group}>
            <p className={styles.groupLabel}>{category.label}</p>
            {category.items.map((item) => (
              <AccordionItem key={item.question} {...item} />
            ))}
          </section>
        ))}

        <div className={styles.cta}>
          Still have questions?{' '}
          <a href="mailto:mys.thomas00@gmail.com">Contact us</a> — we&rsquo;re happy to help. You
          can also read{' '}
          <Link to="/blog/what-is-a-byok-ai-website-builder">
            what a BYOK AI website builder is
          </Link>{' '}
          or compare <Link to="/pricing">model pricing</Link>.
        </div>
      </div>
    </div>
  )
}
