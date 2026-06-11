// Pre-build script: regenerates src/data/changelog.json from the public GitHub
// commit history. Run: node scripts/generate-changelog.mjs
//
// Runs first in `npm run build`, so every Vercel deploy (= every GitHub push)
// refreshes the changelog automatically. The JSON snapshot is committed to the
// repo as a fallback: if the GitHub API is unreachable or rate-limited during
// a build, the script warns and keeps the existing snapshot instead of failing
// the build. Set GITHUB_TOKEN to raise the unauthenticated rate limit (60/h/IP,
// shared across Vercel build machines) if it ever becomes a problem.

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { buildChangelog } from './changelog-core.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '..', 'src', 'data', 'changelog.json')

const REPO = 'BuildingTechAlternatives/OpenThorn'
const MAX_PAGES = 3 // 3 × 100 commits is plenty for a product changelog

async function fetchCommits() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'openthorn-changelog-generator',
  }
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  const commits = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/commits?per_page=100&page=${page}`,
      { headers }
    )
    if (!res.ok) throw new Error(`GitHub API responded ${res.status} ${res.statusText}`)

    const batch = await res.json()
    for (const c of batch) {
      commits.push({
        sha: c.sha,
        message: c.commit.message,
        // Committer date reflects when the change actually landed (rebases,
        // amends), which is what a "pushed on" changelog should group by.
        date: c.commit.committer.date,
        url: c.html_url,
      })
    }
    if (batch.length < 100) break
  }
  return commits
}

try {
  const commits = await fetchCommits()
  const days = buildChangelog(commits)
  const json = JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), days }, null, 2)

  if (existsSync(outPath) && readFileSync(outPath, 'utf8') === json + '\n') {
    console.log(`✓ changelog.json up to date (${days.length} days)`)
  } else {
    writeFileSync(outPath, json + '\n', 'utf8')
    console.log(`✓ changelog.json written (${days.length} days, ${commits.length} commits scanned)`)
  }
} catch (err) {
  if (existsSync(outPath)) {
    console.warn(`⚠ changelog generation failed (${err.message}) — keeping existing snapshot`)
  } else {
    console.error(`✗ changelog generation failed and no existing snapshot: ${err.message}`)
    process.exit(1)
  }
}
