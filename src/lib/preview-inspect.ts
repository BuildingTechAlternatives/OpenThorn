/**
 * Deterministic preview inspection — give the agent *eyes* without a vision model.
 *
 * ## Why this exists
 *
 * The system prompt asks the agent to ship Stripe/Linear-quality layouts:
 * controls must not cover text, text must not clip, contrast must be ≥ 4.5:1,
 * the mobile layout must not overflow. But the agent is **blind** — `compile`
 * only proves the app builds and renders without throwing. It cannot see that a
 * button overlaps a heading, that body text is light-grey-on-white at 2:1, or
 * that the hero spills 200px past the right edge at 390px.
 *
 * This module renders the built bundle in hidden iframes at real viewport
 * widths and *measures* the rendered DOM — bounding boxes, computed styles,
 * contrast ratios — then reports concrete, deterministic findings the agent can
 * act on. No screenshot, no vision-model token cost. It is informational (it
 * does not gate `done`); it just turns "I think it looks fine" into measured
 * facts.
 *
 * The pure helpers (colour parsing, contrast math, report formatting) are
 * exported and unit-tested. The DOM-dependent measurement runs as an inline
 * script inside the sandboxed iframe and posts a structured report back.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type InspectIssueType =
  | 'overflow'
  | 'contrast'
  | 'clipping'
  | 'overlap'
  | 'offscreen'
  | 'tap-target'

export interface InspectIssue {
  type: InspectIssueType
  severity: 'error' | 'warning'
  /** Human-readable, agent-actionable description. */
  message: string
  /** A short CSS-ish selector identifying the element, when known. */
  selector?: string
  /** Viewport label the issue was observed at (e.g. "mobile (390px)"). */
  viewport?: string
}

export interface InspectSummary {
  elements: number
  buttons: number
  links: number
  inputs: number
  headings: number
  imagesWithoutAlt: number
}

export interface InspectResult {
  /** Whether the inspection actually ran (false when no DOM is available). */
  ran: boolean
  /** Whether the app rendered visible content into #root. */
  rendered: boolean
  /** Viewport labels that were measured. */
  viewports: string[]
  /** All findings, across viewports, de-duplicated. */
  issues: InspectIssue[]
  /** Structural summary of the rendered output (null when nothing rendered). */
  summary: InspectSummary | null
  /** console.error output captured while rendering. */
  consoleErrors: string[]
}

/** A single colour channel triple plus alpha (0–1). */
export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

// ─── Pure colour / contrast helpers (exported for tests) ───────────────────

/**
 * Parse a CSS colour string as returned by getComputedStyle (always `rgb(...)`
 * or `rgba(...)`), plus the keyword `transparent`. Returns null for anything we
 * cannot interpret (e.g. a gradient or named colour we don't resolve).
 */
export function parseCssColor(input: string): Rgba | null {
  const str = (input || '').trim().toLowerCase()
  if (!str) return null
  if (str === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }

  const m = str.match(
    /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/,
  )
  if (!m) return null
  const r = Number(m[1])
  const g = Number(m[2])
  const b = Number(m[3])
  let a = 1
  if (m[4] != null) {
    a = m[4].endsWith('%') ? Number(m[4].slice(0, -1)) / 100 : Number(m[4])
  }
  if ([r, g, b, a].some((n) => !Number.isFinite(n))) return null
  return { r, g, b, a }
}

/**
 * Composite a (possibly translucent) foreground colour over an opaque
 * background, returning an opaque colour. Used so contrast is computed against
 * what the eye actually sees.
 */
export function compositeOver(fg: Rgba, bg: Rgba): Rgba {
  const a = fg.a
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
    a: 1,
  }
}

/** WCAG relative luminance for an opaque sRGB colour. */
export function relativeLuminance({ r, g, b }: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** WCAG contrast ratio (1–21) between two opaque colours. */
export function contrastRatio(c1: Rgba, c2: Rgba): number {
  const l1 = relativeLuminance(c1)
  const l2 = relativeLuminance(c2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * The WCAG AA threshold for a given text size. Large text (≥ 24px, or ≥ 18.66px
 * bold) only needs 3:1; everything else needs 4.5:1.
 */
export function contrastThreshold(fontSizePx: number, fontWeight: number): number {
  const isLarge = fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700)
  return isLarge ? 3 : 4.5
}

// ─── Report formatting (pure, exported for tests) ──────────────────────────

const ISSUE_ORDER: InspectIssueType[] = [
  'overflow',
  'overlap',
  'contrast',
  'clipping',
  'offscreen',
  'tap-target',
]

const ISSUE_HEADINGS: Record<InspectIssueType, string> = {
  overflow: 'Horizontal overflow (content wider than the viewport)',
  overlap: 'Overlapping elements (a control covers text/another control)',
  contrast: 'Low text contrast (below WCAG AA)',
  clipping: 'Clipped text (overflow hidden cutting content off)',
  offscreen: 'Off-screen interactive elements',
  'tap-target': 'Tap targets smaller than 44×44px (hard to tap on mobile)',
}

const MAX_PER_TYPE = 8

/**
 * Format an inspection result into a concise, agent-readable report. Returns
 * null when the run was clean (nothing worth the agent's attention), matching
 * the convention of formatRuntimeReport.
 */
export function formatInspectReport(result: InspectResult): string | null {
  if (!result.ran) return null

  const lines: string[] = []

  if (!result.rendered) {
    lines.push(
      'Inspection: the app rendered no visible content into #root. There is nothing to inspect — fix the render first (compile to see runtime errors).',
    )
    return lines.join('\n')
  }

  if (result.consoleErrors.length > 0) {
    lines.push('Console errors during render:')
    result.consoleErrors.slice(0, 5).forEach((e, i) => lines.push(`  ${i + 1}. ${e}`))
    lines.push('')
  }

  const byType = new Map<InspectIssueType, InspectIssue[]>()
  for (const issue of result.issues) {
    const arr = byType.get(issue.type) ?? []
    arr.push(issue)
    byType.set(issue.type, arr)
  }

  for (const type of ISSUE_ORDER) {
    const issues = byType.get(type)
    if (!issues || issues.length === 0) continue
    const errorCount = issues.filter((i) => i.severity === 'error').length
    const tag = errorCount > 0 ? 'PROBLEM' : 'check'
    lines.push(`[${tag}] ${ISSUE_HEADINGS[type]} — ${issues.length} found:`)
    for (const issue of issues.slice(0, MAX_PER_TYPE)) {
      const where = issue.viewport ? ` @ ${issue.viewport}` : ''
      const sel = issue.selector ? ` (${issue.selector})` : ''
      lines.push(`  - ${issue.message}${sel}${where}`)
    }
    if (issues.length > MAX_PER_TYPE) {
      lines.push(`  ... and ${issues.length - MAX_PER_TYPE} more`)
    }
    lines.push('')
  }

  if (lines.length === 0 || (lines.every((l) => l.trim() === ''))) {
    return null
  }

  const head = `Visual inspection of the rendered app at ${result.viewports.join(' and ')}.`
  const tail =
    result.issues.some((i) => i.severity === 'error')
      ? 'PROBLEM items are real layout bugs a user would see — fix them, compile, then re-inspect. check items are advisory; address them if they hurt the design.'
      : 'These are advisory — address the ones that hurt the design or usability, then move on. None are build-blocking.'

  return [head, '', ...lines, tail].join('\n').replace(/\n{3,}/g, '\n\n')
}

/** De-duplicate issues by (type, selector, message) keeping the first viewport. */
export function dedupeIssues(issues: InspectIssue[]): InspectIssue[] {
  const seen = new Set<string>()
  const out: InspectIssue[] = []
  for (const issue of issues) {
    const key = `${issue.type}|${issue.selector ?? ''}|${issue.message}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(issue)
  }
  return out
}

// ─── DOM measurement (runs inside the sandboxed iframe) ────────────────────

interface RawReport {
  rendered: boolean
  issues: Omit<InspectIssue, 'viewport'>[]
  summary: InspectSummary | null
  consoleErrors: string[]
}

/** Default viewports — the mobile width catches the bulk of layout bugs. */
const DEFAULT_VIEWPORTS: { width: number; height: number; label: string }[] = [
  { width: 390, height: 844, label: 'mobile (390px)' },
  { width: 1280, height: 900, label: 'desktop (1280px)' },
]

const DEFAULT_WAIT_MS = 1400
const HARD_TIMEOUT_MS = 9000

/**
 * The measurement script, injected as the first child of <head> so it can hook
 * console.error before the app runs. It walks the rendered DOM after mount and
 * posts a structured report. Written in conservative ES5-ish style to run
 * everywhere, mirroring preview-runtime-check.ts.
 */
function buildInspectScript(token: string, waitMs: number): string {
  return `<script>
(function(){
  if (typeof window === 'undefined') return;
  var TOKEN = ${JSON.stringify(token)};
  var consoleErrors = [];
  var origErr = console.error;
  console.error = function(){
    try { consoleErrors.push(Array.prototype.slice.call(arguments).map(String).join(' ')); } catch(e){}
    return origErr.apply(console, arguments);
  };

  function parseColor(str){
    str = (str||'').trim().toLowerCase();
    if (!str) return null;
    if (str === 'transparent') return {r:0,g:0,b:0,a:0};
    var m = str.match(/^rgba?\\(\\s*([\\d.]+)[, ]\\s*([\\d.]+)[, ]\\s*([\\d.]+)\\s*(?:[,/]\\s*([\\d.]+%?))?\\s*\\)$/);
    if (!m) return null;
    var a = 1;
    if (m[4] != null) a = m[4].slice(-1)==='%' ? parseFloat(m[4])/100 : parseFloat(m[4]);
    return {r:+m[1], g:+m[2], b:+m[3], a:a};
  }
  function composite(fg,bg){
    var a=fg.a;
    return {r:Math.round(fg.r*a+bg.r*(1-a)), g:Math.round(fg.g*a+bg.g*(1-a)), b:Math.round(fg.b*a+bg.b*(1-a)), a:1};
  }
  function lum(c){
    function ch(v){ v=v/255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); }
    return 0.2126*ch(c.r)+0.7152*ch(c.g)+0.0722*ch(c.b);
  }
  function ratio(c1,c2){ var l1=lum(c1),l2=lum(c2); var hi=Math.max(l1,l2),lo=Math.min(l1,l2); return (hi+0.05)/(lo+0.05); }

  function selectorFor(el){
    if (!el || !el.tagName) return '';
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (el.className && typeof el.className === 'string') {
      var c = el.className.trim().split(/\\s+/)[0];
      if (c) s += '.' + c;
    }
    var txt = (el.textContent || '').replace(/\\s+/g,' ').trim();
    if (txt) s += ' "' + (txt.length > 28 ? txt.slice(0,25) + '…' : txt) + '"';
    return s;
  }

  function isVisible(el, cs){
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (parseFloat(cs.opacity) === 0) return false;
    return true;
  }

  // Resolve the effective background colour by walking ancestors. Returns null
  // when a background-image/gradient is involved (we can't measure those).
  function effectiveBg(el){
    var node = el;
    while (node && node.nodeType === 1) {
      var cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      var bg = parseColor(cs.backgroundColor);
      if (bg && bg.a > 0) {
        if (bg.a < 1) {
          var under = effectiveBg(node.parentElement);
          if (!under) return null;
          return composite(bg, under);
        }
        return bg;
      }
      node = node.parentElement;
    }
    return {r:255,g:255,b:255,a:1}; // default page background
  }

  function hasDirectText(el){
    for (var i=0;i<el.childNodes.length;i++){
      var n = el.childNodes[i];
      if (n.nodeType === 3 && n.textContent && n.textContent.trim().length > 1) return true;
    }
    return false;
  }

  function rectsOverlap(a,b){
    var ix = Math.max(0, Math.min(a.right,b.right) - Math.max(a.left,b.left));
    var iy = Math.max(0, Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top));
    return ix * iy;
  }

  function inspect(){
    var root = document.getElementById('root');
    var rendered = !!(root && (root.childElementCount > 0 || (root.textContent||'').trim().length > 0));
    var issues = [];
    var vw = window.innerWidth;
    var isMobile = vw <= 480;

    function add(type, severity, message, el){
      issues.push({ type:type, severity:severity, message:message, selector: el ? selectorFor(el) : undefined });
    }

    if (!rendered) {
      report({ rendered:false, issues:[], summary:null, consoleErrors:consoleErrors });
      return;
    }

    var all = [].slice.call(document.querySelectorAll('#root *')).slice(0, 600);
    var visible = [];
    var contrastChecked = 0, contrastFlagged = 0;

    for (var i=0;i<all.length;i++){
      var el = all[i];
      var cs = getComputedStyle(el);
      if (!isVisible(el, cs)) continue;
      var rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      visible.push({ el:el, cs:cs, rect:rect });

      // ── Horizontal overflow: element spills past the viewport's right edge.
      if (rect.right > vw + 2 && rect.left < vw && rect.width <= vw + 600) {
        var over = Math.round(rect.right - vw);
        if (over >= 8) add('overflow', isMobile ? 'error' : 'warning',
          'Extends ' + over + 'px past the right edge — causes horizontal scroll', el);
      }

      // ── Off-screen interactive elements.
      var tag = el.tagName.toLowerCase();
      var interactive = tag==='button' || tag==='a' || tag==='input' || tag==='select' || tag==='textarea' || el.getAttribute('role')==='button';
      if (interactive) {
        if (rect.right <= 0 || rect.left >= vw || rect.bottom <= 0) {
          add('offscreen', 'warning', 'Interactive element rendered off-screen', el);
        }
        if (isMobile && (rect.width < 44 || rect.height < 44)) {
          add('tap-target', 'warning',
            'Only ' + Math.round(rect.width) + '×' + Math.round(rect.height) + 'px (min 44×44 for touch)', el);
        }
      }

      // ── Clipped text: overflow hidden while content is wider than the box.
      if ((cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.textOverflow === 'clip') &&
          hasDirectText(el) && el.scrollWidth > el.clientWidth + 2) {
        add('clipping', 'warning', 'Text is wider than its box and gets cut off (overflow hidden)', el);
      }

      // ── Contrast: only on elements with direct, non-trivial text.
      if (hasDirectText(el) && contrastChecked < 120) {
        var fg = parseColor(cs.color);
        var bg = effectiveBg(el);
        if (fg && bg) {
          contrastChecked++;
          var fgc = fg.a < 1 ? composite(fg, bg) : fg;
          var fs = parseFloat(cs.fontSize) || 16;
          var fw = parseInt(cs.fontWeight,10) || 400;
          var need = (fs >= 24 || (fs >= 18.66 && fw >= 700)) ? 3 : 4.5;
          var r = ratio(fgc, bg);
          if (r < need - 0.05 && contrastFlagged < 20) {
            contrastFlagged++;
            add('contrast', 'warning',
              'Contrast ' + r.toFixed(2) + ':1 (needs ' + need + ':1) — ' + cs.color + ' on rgb(' + bg.r + ',' + bg.g + ',' + bg.b + ')', el);
          }
        }
      }
    }

    // ── Overlap: an interactive control covering text it isn't an ancestor of.
    var texts = [], controls = [];
    for (var v=0; v<visible.length && v<250; v++){
      var item = visible[v];
      var t = item.el.tagName.toLowerCase();
      var isCtrl = t==='button' || t==='a' || t==='input' || t==='select' || item.el.getAttribute('role')==='button';
      if (isCtrl && parseFloat(item.cs.opacity) >= 0.5 && item.cs.pointerEvents !== 'none') controls.push(item);
      else if (hasDirectText(item.el)) texts.push(item);
    }
    var overlapReported = 0;
    for (var c=0;c<controls.length && overlapReported<6;c++){
      for (var x=0;x<texts.length && overlapReported<6;x++){
        var ctrl = controls[c], txt = texts[x];
        if (ctrl.el.contains(txt.el) || txt.el.contains(ctrl.el)) continue;
        var area = rectsOverlap(ctrl.rect, txt.rect);
        if (area <= 0) continue;
        var smaller = Math.min(ctrl.rect.width*ctrl.rect.height, txt.rect.width*txt.rect.height);
        if (smaller > 0 && area / smaller >= 0.6) {
          overlapReported++;
          add('overlap', 'warning', 'A control overlaps text "' + (txt.el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,24) + '"', ctrl.el);
        }
      }
    }

    var summary = {
      elements: all.length,
      buttons: document.querySelectorAll('#root button, #root [role="button"]').length,
      links: document.querySelectorAll('#root a').length,
      inputs: document.querySelectorAll('#root input, #root textarea, #root select').length,
      headings: document.querySelectorAll('#root h1, #root h2, #root h3, #root h4, #root h5, #root h6').length,
      imagesWithoutAlt: [].slice.call(document.querySelectorAll('#root img')).filter(function(im){ return !im.getAttribute('alt'); }).length
    };

    report({ rendered:true, issues:issues, summary:summary, consoleErrors:consoleErrors });
  }

  var reported = false;
  function report(data){
    if (reported) return;
    reported = true;
    data.__bloomInspect = TOKEN;
    try { parent.postMessage(data, '*'); } catch(e){}
  }

  function start(){ try { inspect(); } catch(e){ report({ rendered:true, issues:[], summary:null, consoleErrors:consoleErrors.concat(['inspect failed: '+String(e)]) }); } }
  if (document.readyState === 'complete') setTimeout(start, ${waitMs});
  else window.addEventListener('load', function(){ setTimeout(start, ${waitMs}); });
  setTimeout(function(){ report({ rendered: !!document.getElementById('root'), issues:[], summary:null, consoleErrors:consoleErrors }); }, ${waitMs} + 3000);
})();
</script>`
}

function instrumentHtml(html: string, script: string): string {
  if (html.includes('<head>')) return html.replace('<head>', `<head>\n${script}`)
  return script + '\n' + html
}

let tokenCounter = 0
function nextToken(): string {
  tokenCounter += 1
  return `bloom-insp-${tokenCounter}-${(tokenCounter * 2654435761) % 2147483647}`
}

/** Run the measurement in one hidden iframe at a single viewport. */
function inspectAtViewport(
  html: string,
  vp: { width: number; height: number; label: string },
  waitMs: number,
): Promise<RawReport | null> {
  const token = nextToken()
  const instrumented = instrumentHtml(html, buildInspectScript(token, waitMs))

  return new Promise<RawReport | null>((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${vp.width}px;height:${vp.height}px;border:none;opacity:0;pointer-events:none;`
    iframe.setAttribute('sandbox', 'allow-scripts')

    let settled = false
    const cleanup = () => {
      window.removeEventListener('message', onMessage)
      clearTimeout(hardTimeout)
      try {
        document.body.removeChild(iframe)
      } catch {
        /* already gone */
      }
    }
    const finish = (r: RawReport | null) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(r)
    }

    const onMessage = (event: MessageEvent) => {
      const data = event.data
      if (!data || data.__bloomInspect !== token) return
      finish({
        rendered: Boolean(data.rendered),
        issues: Array.isArray(data.issues) ? (data.issues as RawReport['issues']) : [],
        summary: (data.summary as InspectSummary | null) ?? null,
        consoleErrors: Array.isArray(data.consoleErrors)
          ? data.consoleErrors.map((e: unknown) => String(e))
          : [],
      })
    }

    const hardTimeout = setTimeout(() => finish(null), HARD_TIMEOUT_MS)
    window.addEventListener('message', onMessage)
    document.body.appendChild(iframe)
    iframe.srcdoc = instrumented
  })
}

/**
 * Inspect a built preview at one or more viewport widths and return merged,
 * de-duplicated findings. Safe to call without a DOM (returns ran:false).
 */
export async function inspectPreview(
  html: string,
  opts: { viewports?: { width: number; height: number; label: string }[]; waitMs?: number } = {},
): Promise<InspectResult> {
  const empty: InspectResult = {
    ran: false,
    rendered: false,
    viewports: [],
    issues: [],
    summary: null,
    consoleErrors: [],
  }
  if (typeof document === 'undefined' || typeof window === 'undefined') return empty

  const viewports = opts.viewports ?? DEFAULT_VIEWPORTS
  const waitMs = opts.waitMs ?? DEFAULT_WAIT_MS

  const reports = await Promise.all(viewports.map((vp) => inspectAtViewport(html, vp, waitMs)))

  const issues: InspectIssue[] = []
  const consoleErrors: string[] = []
  let rendered = false
  let summary: InspectSummary | null = null
  const measured: string[] = []

  reports.forEach((report, i) => {
    if (!report) return
    measured.push(viewports[i].label)
    if (report.rendered) rendered = true
    if (report.summary && !summary) summary = report.summary
    for (const e of report.consoleErrors) if (!consoleErrors.includes(e)) consoleErrors.push(e)
    for (const issue of report.issues) {
      issues.push({ ...issue, viewport: viewports[i].label })
    }
  })

  return {
    ran: measured.length > 0,
    rendered,
    viewports: measured,
    issues: dedupeIssues(issues),
    summary,
    consoleErrors,
  }
}
