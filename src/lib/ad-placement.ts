/**
 * Placement helpers for ad slots inside content pages. Kept pure (no DOM, no
 * React) so the "does this page deserve an ad?" rules stay testable.
 */

/** Posts shorter than this read as one screen — an ad would look forced. */
const MIN_CONTENT_LENGTH = 2000

/**
 * Splits markdown at the `##` heading nearest `targetRatio` of the body, so an
 * ad can sit partway through an article without cutting a section in half.
 *
 * Returns null when the content is too short or has too few top-level headings
 * for a natural placement; callers then render no ad at all.
 */
export function splitMarkdownForAd(content: string, targetRatio = 0.35): [string, string] | null {
  const normalized = content.replace(/\r\n/g, '\n')
  if (normalized.trim().length < MIN_CONTENT_LENGTH) return null

  const lines = normalized.split('\n')

  // Headings inside fenced code blocks are content, not section boundaries.
  const headingLines: number[] = []
  let inFence = false
  lines.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      return
    }
    if (!inFence && /^##\s+\S/.test(line)) headingLines.push(i)
  })

  // Need at least three: one to open each half, plus one candidate to split on.
  if (headingLines.length < 3) return null

  const target = normalized.length * targetRatio
  const offsets = lineOffsets(lines)

  // Never split on the first or last heading — both halves keep real content.
  let best = headingLines[1]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const line of headingLines.slice(1, -1)) {
    const distance = Math.abs(offsets[line] - target)
    if (distance < bestDistance) {
      bestDistance = distance
      best = line
    }
  }

  const before = lines.slice(0, best).join('\n').trim()
  const after = lines.slice(best).join('\n').trim()
  if (!before || !after) return null

  return [before, after]
}

/**
 * After which index of a list (entries, categories, sections) an ad is placed
 * so it lands mid-page instead of right after the intro. Returns -1 for lists
 * too short to interrupt.
 */
export function adAfterIndex(length: number, minLength = 6): number {
  if (length < minLength) return -1
  return Math.floor(length / 2) - 1
}

function lineOffsets(lines: string[]): number[] {
  const offsets: number[] = []
  let total = 0
  for (const line of lines) {
    offsets.push(total)
    total += line.length + 1
  }
  return offsets
}
