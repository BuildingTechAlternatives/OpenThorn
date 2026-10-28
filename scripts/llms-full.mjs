// Builds llms-full.txt: the complete public content of openthorn.app in one
// markdown file, for AI assistants and answer engines that prefer a single
// fetch over crawling. Linked from llms.txt per the llms.txt convention.
import { readFileSync } from 'fs'
import { join } from 'path'

export function buildLlmsFull({ rootDir, blogMeta, faqData, compareMeta, glossary, providersMeta = [] }) {
  const sections = []

  sections.push(readFileSync(join(rootDir, 'public', 'llms.txt'), 'utf8').trim())

  sections.push('\n\n---\n\n# Frequently Asked Questions\n')
  for (const category of faqData) {
    sections.push(`\n## ${category.label}\n`)
    for (const item of category.items) {
      sections.push(`\n### ${item.question}\n\n${item.answer}\n`)
    }
  }

  sections.push('\n\n---\n\n# Glossary\n')
  for (const g of glossary) {
    sections.push(`\n### ${g.term}\n\n${g.definition}\n`)
  }

  sections.push('\n\n---\n\n# Comparisons\n')
  for (const entry of compareMeta) {
    sections.push(`\n## ${entry.title} (facts last verified ${entry.lastVerified})\n`)
    if (entry.answer) sections.push(`\n${entry.answer}\n`)
    sections.push(`\n${entry.intro}\n`)
    for (const row of entry.rows) {
      sections.push(`- ${row.feature}: OpenThorn — ${row.openthorn}; ${entry.competitor} — ${row.competitor}`)
    }
    for (const f of entry.faqs) {
      sections.push(`\n### ${f.question}\n\n${f.answer}\n`)
    }
    sections.push(`\nVerdict: ${entry.verdict}\n`)
  }

  sections.push('\n\n---\n\n# Provider guides (build a website with your own API key)\n')
  for (const guide of providersMeta) {
    sections.push(`\n## ${guide.title} (facts last verified ${guide.lastVerified})\n\n${guide.answer}\n`)
    sections.push(`- Get your key: ${guide.consoleUrl}`)
    sections.push(`- Official pricing: ${guide.pricingUrl}`)
    sections.push(`- Free tier: ${guide.freeTier}`)
    sections.push(`- Recommended models: ${guide.models.map((m) => `${m.name} (${m.note})`).join('; ')}`)
    sections.push(`- Cost: ${guide.costNote}\n`)
    for (const [i, s] of guide.steps.entries()) {
      sections.push(`${i + 1}. ${s.name} — ${s.text}`)
    }
    for (const f of guide.faqs) {
      sections.push(`\n### ${f.question}\n\n${f.answer}\n`)
    }
  }

  sections.push('\n\n---\n\n# Blog posts\n')
  for (const post of blogMeta) {
    const md = readFileSync(join(rootDir, 'src', 'content', 'blog', `${post.slug}.md`), 'utf8')
    sections.push(`\n## ${post.title} (${post.date})\n\n${md.trim()}\n`)
  }

  return sections.join('\n')
}
