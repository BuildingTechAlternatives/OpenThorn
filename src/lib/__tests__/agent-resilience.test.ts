import { describe, expect, it } from 'vitest'
import {
  isRetryableStatus,
  parseRetryAfter,
  emptyUsage,
  addUsage,
  isContinuationRequest,
  isLikelyBuildRequest,
  isSmallRefineRequest,
  shouldRejectWholeFileRewrite,
  matchesGlob,
  nearestSnippet,
  type RunUsage,
} from '../agent'

describe('isRetryableStatus', () => {
  it('retries timeouts, rate limits, and server errors', () => {
    expect(isRetryableStatus(408)).toBe(true)
    expect(isRetryableStatus(429)).toBe(true)
    expect(isRetryableStatus(500)).toBe(true)
    expect(isRetryableStatus(502)).toBe(true)
    expect(isRetryableStatus(503)).toBe(true)
    expect(isRetryableStatus(529)).toBe(true) // Anthropic "overloaded"
  })

  it('does not retry auth or validation errors', () => {
    expect(isRetryableStatus(400)).toBe(false)
    expect(isRetryableStatus(401)).toBe(false)
    expect(isRetryableStatus(403)).toBe(false)
    expect(isRetryableStatus(404)).toBe(false)
    expect(isRetryableStatus(422)).toBe(false)
    expect(isRetryableStatus(200)).toBe(false)
  })
})

describe('parseRetryAfter', () => {
  it('returns null for missing or unparseable headers', () => {
    expect(parseRetryAfter(null)).toBeNull()
    expect(parseRetryAfter('soon')).toBeNull()
    expect(parseRetryAfter('')).toBeNull()
  })

  it('parses delta-seconds into milliseconds', () => {
    expect(parseRetryAfter('2')).toBe(2000)
    expect(parseRetryAfter('0')).toBe(0)
  })

  it('caps very large delays', () => {
    expect(parseRetryAfter('3600')).toBe(30_000)
  })

  it('parses HTTP dates relative to now', () => {
    const inFiveSeconds = new Date(Date.now() + 5000).toUTCString()
    const delay = parseRetryAfter(inFiveSeconds)
    expect(delay).not.toBeNull()
    expect(delay!).toBeGreaterThan(0)
    expect(delay!).toBeLessThanOrEqual(5000)
  })

  it('clamps past HTTP dates to zero', () => {
    const past = new Date(Date.now() - 60_000).toUTCString()
    expect(parseRetryAfter(past)).toBe(0)
  })
})

describe('usage accounting', () => {
  it('emptyUsage starts at zero', () => {
    expect(emptyUsage()).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })
  })

  it('addUsage sums all fields', () => {
    const a: RunUsage = { inputTokens: 100, outputTokens: 20, cacheReadTokens: 80, cacheWriteTokens: 10 }
    const b: RunUsage = { inputTokens: 50, outputTokens: 5, cacheReadTokens: 40, cacheWriteTokens: 0 }
    expect(addUsage(a, b)).toEqual({
      inputTokens: 150,
      outputTokens: 25,
      cacheReadTokens: 120,
      cacheWriteTokens: 10,
    })
  })

  it('addUsage with undefined delta returns the total unchanged', () => {
    const a = emptyUsage()
    expect(addUsage(a, undefined)).toEqual(a)
  })
})

describe('agent request planning helpers', () => {
  it('recognizes continuation prompts narrowly', () => {
    expect(isContinuationRequest('continue')).toBe(true)
    expect(isContinuationRequest('Keep going!')).toBe(true)
    expect(isContinuationRequest('continue the dark mode implementation')).toBe(false)
  })

  it('distinguishes build requests from questions about building', () => {
    expect(isLikelyBuildRequest('Can you add a double-jump power-up?')).toBe(true)
    expect(isLikelyBuildRequest('what can you build?')).toBe(false)
    expect(isLikelyBuildRequest('how does the build process work?')).toBe(false)
  })

  it('treats short tweaks as small refines but not big rewrites', () => {
    expect(isSmallRefineRequest('Change the heading text to "Welcome"')).toBe(true)
    expect(isSmallRefineRequest('update the navbar background to a darker shade')).toBe(true)
    expect(isSmallRefineRequest('Rebuild the entire app from scratch')).toBe(false)
  })

  it('always treats a visual click-to-edit as a small refine, even when long', () => {
    // The appended element + style context pushes a visual edit well past the
    // length cap; the [Visual edit] marker must still mark it small.
    const visualEdit =
      '[Visual edit] The user selected the <a> element at Navbar.tsx:50 (text: "Waitlist").' +
      ' Current styles — color: rgb(17, 24, 39); backgroundColor: rgba(0, 0, 0, 0);' +
      ' fontSize: 16px; fontWeight: 600; margin: 0px; padding: 8px 16px; display: inline-block;' +
      ' textAlign: left. Apply only this change to that element: Change the text to: Join now'
    expect(visualEdit.length).toBeGreaterThan(220)
    expect(isSmallRefineRequest(visualEdit)).toBe(true)
  })

  it('matches a no-slash glob by basename anywhere in the tree', () => {
    // The bug: "*.css" never matched a nested file because * cannot cross "/".
    expect(matchesGlob('src/styles/theme.css', '*.css')).toBe(true)
    expect(matchesGlob('src/pages/Menu.tsx', 'Menu.tsx')).toBe(true)
    expect(matchesGlob('src/pages/Menu.tsx', '*.tsx')).toBe(true)
    // A path-scoped glob still scopes to that directory.
    expect(matchesGlob('src/styles/theme.css', 'src/**')).toBe(true)
    expect(matchesGlob('src/styles/theme.css', 'src/components/**')).toBe(false)
    // "**/" can match zero directories too.
    expect(matchesGlob('theme.css', '**/*.css')).toBe(true)
  })

  it('tolerates malformed globs (stray quotes / leading ./)', () => {
    expect(matchesGlob('src/pages/Game.tsx', 'src/**"')).toBe(true)
    expect(matchesGlob('src/App.tsx', './src/App.tsx')).toBe(true)
    expect(matchesGlob('src/styles/theme.css', '"*.css"')).toBe(true)
  })

  it('nearestSnippet points at the closest current text for a failed edit', () => {
    const code = [
      'function greet() {',
      '  const message = "hello world"',
      '  return message',
      '}',
    ].join('\n')
    // old_string has slightly wrong text (drifted whitespace/quote) — should
    // still anchor on the message line and show its region with line numbers.
    const near = nearestSnippet(code, "  const message = 'hello world';")
    expect(near).not.toBeNull()
    expect(near!.text).toContain('const message = "hello world"')
    expect(near!.start).toBeLessThanOrEqual(2)
    expect(near!.end).toBeGreaterThanOrEqual(2)
  })

  it('nearestSnippet returns null when nothing resembles old_string', () => {
    const code = 'const a = 1\nconst b = 2\n'
    expect(nearestSnippet(code, 'completely unrelated zzzzzzzzzzzz qqqqq')).toBeNull()
  })

  it('guards long whole-file rewrites on small refine requests', () => {
    const existingCode = Array.from({ length: 220 }, (_, i) => `const a${i} = ${i}`).join('\n')
    const newCode = Array.from({ length: 230 }, (_, i) => `const b${i} = ${i}`).join('\n')

    expect(shouldRejectWholeFileRewrite({
      mode: 'refine',
      prompt: 'Add a double-jump power-up',
      existingCode,
      newCode,
      alreadyRejected: false,
    })).toBe(true)
    expect(shouldRejectWholeFileRewrite({
      mode: 'refine',
      prompt: 'Add a double-jump power-up',
      existingCode,
      newCode,
      alreadyRejected: true,
    })).toBe(false)
    expect(shouldRejectWholeFileRewrite({
      mode: 'create',
      prompt: 'Build a dino game',
      existingCode,
      newCode,
      alreadyRejected: false,
    })).toBe(false)
  })

  it('guards large multi-change refines that keep most of the file', () => {
    // A bigger refine (not a "small" one): the new file keeps every original
    // line and only appends a few — the changes are localized, so it should be
    // multi_edit, not a whole-file overwrite.
    const bigRefine =
      'Add a sidebar with collapsible sections, a top search bar, a user avatar ' +
      'menu, three summary stat cards, a sortable data table with pagination, and ' +
      'a settings panel, then wire up navigation and update the header to match.'
    expect(bigRefine.length).toBeGreaterThan(220)
    expect(isSmallRefineRequest(bigRefine)).toBe(false)

    const existingCode = Array.from({ length: 200 }, (_, i) => `const value${i} = compute(${i})`).join('\n')
    const newCode = existingCode + '\n' + Array.from({ length: 20 }, (_, i) => `const extra${i} = ${i}`).join('\n')

    expect(shouldRejectWholeFileRewrite({
      mode: 'refine',
      prompt: bigRefine,
      existingCode,
      newCode,
      alreadyRejected: false,
    })).toBe(true)
  })

  it('allows a genuine rewrite where little of the original survives', () => {
    const bigRefine =
      'Add a sidebar with collapsible sections, a top search bar, a user avatar ' +
      'menu, three summary stat cards, a sortable data table with pagination, and ' +
      'a settings panel, then wire up navigation and update the header to match.'
    const existingCode = Array.from({ length: 200 }, (_, i) => `const value${i} = compute(${i})`).join('\n')
    // Completely different content — a real rewrite, not scattered edits.
    const newCode = Array.from({ length: 210 }, (_, i) => `const fresh${i} = rebuild(${i})`).join('\n')

    expect(shouldRejectWholeFileRewrite({
      mode: 'refine',
      prompt: bigRefine,
      existingCode,
      newCode,
      alreadyRejected: false,
    })).toBe(false)
  })

  it('lets an explicit redesign overwrite the whole file', () => {
    const existingCode = Array.from({ length: 200 }, (_, i) => `const value${i} = compute(${i})`).join('\n')
    const newCode = existingCode + '\n' + Array.from({ length: 20 }, (_, i) => `const extra${i} = ${i}`).join('\n')

    expect(shouldRejectWholeFileRewrite({
      mode: 'refine',
      prompt: 'Redesign this page from scratch with a modern dark theme and a hero section',
      existingCode,
      newCode,
      alreadyRejected: false,
    })).toBe(false)
  })
})
