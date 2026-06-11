import { describe, it, expect } from 'vitest'
import { isNoise, categorize, buildChangelog } from '../../../scripts/changelog-core.mjs'

describe('isNoise', () => {
  it('drops merge commits, typo fixes, lockfile bumps, and WIP', () => {
    expect(isNoise('Merge branch master of github.com:foo/bar')).toBe(true)
    expect(isNoise('Fix typo in README')).toBe(true)
    expect(isNoise('Update package-lock.json')).toBe(true)
    expect(isNoise('bump deps')).toBe(true)
    expect(isNoise('WIP changelog page')).toBe(true)
    expect(isNoise('chore: tidy imports')).toBe(true)
    expect(isNoise('ci(deploy): tweak workflow')).toBe(true)
  })

  it('keeps real product changes', () => {
    expect(isNoise('Add Vercel Speed Insights with privacy policy disclosures')).toBe(false)
    expect(isNoise('Fix favicon: use real logo.png instead of placeholder SVG')).toBe(false)
    expect(isNoise('Improve mobile navigation behavior')).toBe(false)
  })
})

describe('categorize', () => {
  it('maps leading verbs to categories', () => {
    expect(categorize('Add cover image to BYOK blog post')).toBe('New')
    expect(categorize('Implement provider fallback')).toBe('New')
    expect(categorize('Fix duplicate JSON-LD flagged by Google')).toBe('Fix')
    expect(categorize('Prevent empty set_requirements from wiping the plan')).toBe('Fix')
    expect(categorize('Improve agent retry behavior')).toBe('Improved')
    expect(categorize('Update privacy policy wording')).toBe('Improved')
  })
})

describe('buildChangelog', () => {
  const commits = [
    { sha: 'aaaa111aaaa111aaaa111', message: 'Add changelog page\n\nbody text', date: '2026-06-11T14:00:00Z', url: 'https://github.com/x/y/commit/aaaa111' },
    { sha: 'bbbb222bbbb222bbbb222', message: 'Merge branch feature', date: '2026-06-11T13:00:00Z', url: 'https://github.com/x/y/commit/bbbb222' },
    { sha: 'cccc333cccc333cccc333', message: 'Fix favicon', date: '2026-06-10T09:00:00Z', url: 'https://github.com/x/y/commit/cccc333' },
  ]

  it('groups by day newest first, filters noise, and uses only the subject line', () => {
    const days = buildChangelog(commits)
    expect(days).toEqual([
      {
        date: '2026-06-11',
        entries: [
          {
            category: 'New',
            message: 'Add changelog page',
            sha: 'aaaa111aaaa111aaaa111',
            shortSha: 'aaaa111',
            url: 'https://github.com/x/y/commit/aaaa111',
          },
        ],
      },
      {
        date: '2026-06-10',
        entries: [
          {
            category: 'Fix',
            message: 'Fix favicon',
            sha: 'cccc333cccc333cccc333',
            shortSha: 'cccc333',
            url: 'https://github.com/x/y/commit/cccc333',
          },
        ],
      },
    ])
  })

  it('returns an empty list when every commit is noise', () => {
    expect(buildChangelog([commits[1]])).toEqual([])
  })
})
