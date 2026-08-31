import { describe, expect, it } from 'vitest'
import { adAfterIndex, splitMarkdownForAd } from '../ad-placement'

const longPost = [
  '# Title',
  '',
  'Intro paragraph with enough words to matter for the length check below.',
  '',
  '## First section',
  '',
  `${'First section body paragraph with plenty of words. '.repeat(20)}`,
  '',
  '## Second section',
  '',
  `${'Second section body paragraph with plenty of words. '.repeat(20)}`,
  '',
  '## Third section',
  '',
  `${'Third section body paragraph with plenty of words. '.repeat(20)}`,
  '',
  '## Fourth section',
  '',
  `${'Fourth section body paragraph with plenty of words. '.repeat(20)}`,
].join('\n')

describe('splitMarkdownForAd', () => {
  it('splits at a heading near the target ratio', () => {
    const [before, after] = splitMarkdownForAd(longPost)!
    expect(before).toContain('## First section')
    expect(before).not.toContain('## Fourth section')
    expect(after).toContain('## Fourth section')
    // The split lands in the first half of the body, not at the very top.
    const ratio = before.length / longPost.length
    expect(ratio).toBeGreaterThan(0.15)
    expect(ratio).toBeLessThan(0.6)
  })

  it('keeps both halves non-empty', () => {
    const [before, after] = splitMarkdownForAd(longPost)!
    expect(before.trim().length).toBeGreaterThan(0)
    expect(after.trim().length).toBeGreaterThan(0)
  })

  it('returns null for short posts', () => {
    expect(splitMarkdownForAd('## A\n\nshort\n\n## B\n\ntext\n\n## C\n\nmore')).toBeNull()
  })

  it('returns null when there are too few top-level headings', () => {
    const body = `${'word '.repeat(2500)}\n\n## Only one heading\n\n${'more words '.repeat(200)}`
    expect(splitMarkdownForAd(body)).toBeNull()
  })

  it('never splits on a heading inside a fenced code block', () => {
    // The decoy headings sit closest to the 35% mark; splitting there would
    // tear the code fence in half.
    const fenced = [
      '## First',
      '',
      'word '.repeat(60),
      '',
      '```md',
      '## Decoy heading',
      '## Another decoy',
      '```',
      '',
      'word '.repeat(60),
      '',
      '## Second',
      '',
      'word '.repeat(200),
      '',
      '## Third',
      '',
      'word '.repeat(200),
    ].join('\n')

    const result = splitMarkdownForAd(fenced)
    expect(result).not.toBeNull()
    const [before, after] = result!
    expect(after.startsWith('## Second')).toBe(true)
    expect(before).toContain('## Decoy heading')
    expect(before.endsWith('```')).toBe(false)
  })
})

describe('adAfterIndex', () => {
  it('places the ad around the middle of a long list', () => {
    expect(adAfterIndex(8)).toBe(3)
    expect(adAfterIndex(20)).toBe(9)
  })

  it('skips lists that are too short', () => {
    expect(adAfterIndex(4)).toBe(-1)
    expect(adAfterIndex(0)).toBe(-1)
  })
})
