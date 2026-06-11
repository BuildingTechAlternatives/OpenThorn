// Pure helpers for the changelog generator. No I/O here — everything is
// unit-testable (src/lib/__tests__/changelog-core.test.mjs). The fetch/write
// side lives in scripts/generate-changelog.mjs.

// Commits that are internal housekeeping, not product changes. The changelog
// should read like "what shipped", so merges, typo fixes, lockfile bumps,
// CI/tooling tweaks and WIP commits are dropped.
const NOISE_PATTERNS = [
  /^merge\b/i,
  /^revert\b/i,
  /^wip\b/i,
  /\btypos?\b/i,
  /\b(package-lock|lockfiles?)\b/i,
  /^bump\b/i,
  /^(chore|ci|build|test|docs|style|refactor)(\([^)]*\))?!?:/i,
  /^update (dependencies|deps)\b/i,
  /^initial commit$/i,
]

export function isNoise(subject) {
  return NOISE_PATTERNS.some((re) => re.test(subject.trim()))
}

// Lightweight categorization from the leading verb. Repo commit messages are
// imperative sentences ("Add X", "Fix Y"), so the first word is a good signal.
export function categorize(subject) {
  const s = subject.trim()
  if (/^(add|implement|create|introduce|integrate|launch|enable|support)\b/i.test(s)) return 'New'
  if (/^(fix|resolve|repair|correct|patch|prevent|guard)\b/i.test(s)) return 'Fix'
  return 'Improved'
}

/**
 * Turn a flat, newest-first commit list into changelog days.
 *
 * @param commits Array of { sha, message, date, url } where `message` is the
 *   full commit message (only the subject line is used) and `date` is an ISO
 *   timestamp. Order is preserved within each day.
 * @returns Array of { date: 'YYYY-MM-DD', entries: [{ category, message, sha, shortSha, url }] },
 *   newest day first.
 */
export function buildChangelog(commits) {
  const days = new Map()

  for (const commit of commits) {
    const subject = commit.message.split('\n')[0].trim()
    if (!subject || isNoise(subject)) continue

    const date = commit.date.slice(0, 10)
    if (!days.has(date)) days.set(date, [])
    days.get(date).push({
      category: categorize(subject),
      message: subject,
      sha: commit.sha,
      shortSha: commit.sha.slice(0, 7),
      url: commit.url,
    })
  }

  return [...days.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, entries]) => ({ date, entries }))
}
