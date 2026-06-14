/**
 * Deterministic write-time cleanup ("lifecycle hook" pattern).
 *
 * Cheap, safe normalizations are bound to the write_file lifecycle and run by
 * the harness — never relying on the LLM to remember them. This frees the model
 * from bookkeeping and removes a class of "forgot to clean up" turns.
 *
 * Hard rule: every transform here must be SAFE — it must never change program
 * behavior. When in doubt, it leaves the code untouched. The unused-import pass
 * only removes a name when it appears exactly once in the whole file (the import
 * itself), so any real usage — even inside a comment or string — keeps it.
 */

const CODE_LANGS = new Set(['ts', 'tsx', 'js', 'jsx'])

export interface NormalizeResult {
  code: string
  changed: boolean
  /** Names of unused React hook imports that were stripped, for reporting. */
  removedImports: string[]
}

/**
 * Apply safe normalizations to written code. Returns the original code unchanged
 * (changed: false) for non-code files or when nothing needed doing.
 */
export function normalizeWrittenCode(language: string, code: string): NormalizeResult {
  if (!CODE_LANGS.has(language)) {
    return { code, changed: false, removedImports: [] }
  }

  let out = code
  const removedImports = stripUnusedReactImports(out)
  if (removedImports.code !== out) out = removedImports.code

  out = normalizeWhitespace(out)

  return {
    code: out,
    changed: out !== code,
    removedImports: removedImports.removed,
  }
}

/** Trim trailing whitespace, collapse 3+ blank lines, ensure one trailing newline. */
function normalizeWhitespace(code: string): string {
  const lines = code.split('\n').map((l) => l.replace(/[ \t]+$/, ''))
  let collapsed = lines.join('\n')
  // Collapse runs of 3+ blank lines down to a single blank line.
  collapsed = collapsed.replace(/\n{3,}/g, '\n\n')
  // Exactly one trailing newline.
  collapsed = collapsed.replace(/\n+$/, '') + '\n'
  return collapsed
}

/**
 * Remove unused named imports from the `react` import line only. A name is
 * considered unused only when it appears exactly once in the entire file (the
 * import). This is intentionally conservative: any other occurrence — code,
 * JSX, comment, or string — counts as a use and the name is kept.
 */
function stripUnusedReactImports(code: string): { code: string; removed: string[] } {
  // Match: import { a, b, c } from 'react'
  const importRe = /^(\s*)import\s*\{([^}]*)\}\s*from\s*['"]react['"]\s*;?\s*$/m
  const match = code.match(importRe)
  if (!match) return { code, removed: [] }

  const indent = match[1]
  const rawNames = match[2]

  // Bail on aliased ("as") imports — renaming/removal there is riskier.
  if (/\bas\b/.test(rawNames)) return { code, removed: [] }

  const names = rawNames
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (names.length === 0) return { code, removed: [] }

  const removed: string[] = []
  const kept: string[] = []
  for (const name of names) {
    const ident = name.replace(/^type\s+/, '').trim()
    if (!/^[A-Za-z_$][\w$]*$/.test(ident)) {
      kept.push(name) // not a plain identifier — leave it alone
      continue
    }
    const occurrences = countWord(code, ident)
    if (occurrences <= 1) removed.push(name)
    else kept.push(name)
  }

  if (removed.length === 0) return { code, removed: [] }

  // Replace (or drop) the import line.
  const replacement =
    kept.length === 0
      ? '' // whole import becomes dead — drop the line entirely
      : `${indent}import { ${kept.join(', ')} } from 'react'`

  let next = code.replace(importRe, replacement)
  // If we dropped the whole line, clean up the now-empty line it left behind.
  if (kept.length === 0) next = next.replace(/^\n/, '')

  return { code: next, removed }
}

function countWord(code: string, ident: string): number {
  const re = new RegExp(`\\b${ident.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
  return (code.match(re) ?? []).length
}

// ─── Project-level: orphaned stylesheet detection ──────────────────────────

export interface ProjectFile {
  path: string
  code: string
}

/**
 * Find stylesheets that exist in the project but nothing imports — the classic
 * "wrote theme.css but never `import`ed it, so the whole site is unstyled" bug.
 * compile/runtime pass on it (the app still renders, just with browser
 * defaults) and a blind agent will declare success. This is a deterministic,
 * cross-file check the per-file lint cannot do.
 *
 * A `.css` file counts as imported if ANY other file references its basename in
 * an import-ish position: `import './styles/theme.css'`, `@import 'theme.css'`,
 * or `url(theme.css)`. Detection is intentionally GENEROUS — a missed orphan is
 * harmless, but a false orphan would wrongly block `done`. Only stylesheets that
 * actually contain rules (a `{ ... }` block) are considered; empty/comment-only
 * files are ignored.
 */
export function findOrphanedStylesheets(files: ProjectFile[]): string[] {
  const cssFiles = files.filter((f) => f.path.toLowerCase().endsWith('.css'))
  if (cssFiles.length === 0) return []

  const orphans: string[] = []
  for (const css of cssFiles) {
    // Only flag stylesheets that would actually change the page if imported.
    if (!/\{[\s\S]*\}/.test(css.code)) continue

    const basename = css.path.split('/').pop() ?? css.path
    const escaped = basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // basename must sit at an import/url boundary: preceded by a quote, slash,
    // or '(' and followed by a closing quote or ')'. Avoids matching a longer
    // filename that merely ends with this one (e.g. "mytheme.css").
    const refRe = new RegExp(`["'(/]${escaped}["')]`)

    const imported = files.some((f) => f.path !== css.path && refRe.test(f.code))
    if (!imported) orphans.push(css.path)
  }
  return orphans
}

// ─── Image licensing: only free-to-use remote image hosts ──────────────────

/**
 * Remote image hosts whose content is free to use without permission or
 * attribution. Unsplash (Unsplash License) and Picsum (Lorem Picsum, sourced
 * from Unsplash) cover real photography; placehold.co serves generated
 * placeholders. Any other remote image is rejected — it could be copyrighted.
 */
export const ALLOWED_IMAGE_HOSTS = [
  'images.unsplash.com',
  'source.unsplash.com',
  'picsum.photos',
  'fastly.picsum.photos',
  'placehold.co',
]

export interface DisallowedImage {
  path: string
  url: string
}

// Remote URLs that are unambiguously images: a URL ending in an image
// extension, a CSS `url(...)` background, or an <img src="...">. We do NOT match
// generic `src=`/`href=` so legitimate non-image embeds (e.g. a map/video
// iframe) are never mistaken for a copyrighted image.
const IMG_EXT_RE =
  /https?:\/\/[^\s'"()<>]+\.(?:jpe?g|png|gif|webp|avif|bmp|svg)(?:[?#][^\s'"()<>]*)?/gi
const CSS_URL_RE = /url\(\s*['"]?(https?:\/\/[^'")]+?)['"]?\s*\)/gi
const IMG_TAG_SRC_RE = /<img\b[^>]*?\bsrc\s*=\s*['"](https?:\/\/[^'"]+)['"]/gi

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

function isAllowedImageHost(host: string): boolean {
  return ALLOWED_IMAGE_HOSTS.some((h) => host === h || host.endsWith('.' + h))
}

/**
 * Find remote image URLs that are NOT from a free-to-use host — i.e. images
 * that may be copyrighted and unlicensed. Deterministic, cross-file; surfaced
 * on compile and rejected by the done gate so a generated site can never ship
 * hotlinked copyrighted photos. Free hosts (Unsplash/Picsum/placehold.co),
 * data:, blob:, and local/relative paths are all fine and never flagged.
 */
export function findDisallowedImageSources(files: ProjectFile[]): DisallowedImage[] {
  const out: DisallowedImage[] = []
  const seen = new Set<string>()

  const consider = (path: string, url: string) => {
    const clean = url.trim().replace(/[)'"]+$/, '')
    const host = hostOf(clean)
    if (!host || isAllowedImageHost(host)) return
    const key = `${path}|${clean}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ path, url: clean })
  }

  for (const f of files) {
    for (const re of [IMG_EXT_RE, CSS_URL_RE, IMG_TAG_SRC_RE]) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(f.code)) !== null) {
        consider(f.path, m[1] ?? m[0])
      }
    }
  }
  return out
}
