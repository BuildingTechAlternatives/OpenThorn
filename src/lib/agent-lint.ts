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
