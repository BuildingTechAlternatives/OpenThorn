/**
 * Visual click-to-edit support ("Point & Edit").
 *
 * Pure helpers here are unit-tested. The `public/openthorn-jsx-dev.js` shim
 * mirrors `injectOeidProps` (it cannot import TS, so the small logic is
 * duplicated there — keep them in sync).
 */

export interface JsxSource {
  fileName: string
  lineNumber: number
  columnNumber: number
}

/** Strip esbuild's virtual prefix / leading slash to a short basename:line:col. */
export function normalizeOeid(source: JsxSource): string {
  const file = String(source.fileName || '')
    .replace(/^virtual:/, '')
    .replace(/^\/+/, '')
    .split('/')
    .pop()
  return `${file}:${source.lineNumber}:${source.columnNumber}`
}

/**
 * For host elements (string type), return a new props object with `data-oeid`
 * added from the source location. For component types or missing source, return
 * the original props unchanged (and never mutate the caller's object).
 */
export function injectOeidProps<P extends Record<string, unknown>>(
  type: unknown,
  props: P,
  source: JsxSource | undefined,
): P & { 'data-oeid'?: string } {
  if (typeof type !== 'string' || !source) return props
  return { ...props, 'data-oeid': normalizeOeid(source) }
}

// ─── Selection types + scoped instruction composer ────────────────────────

export interface EditRect {
  top: number
  left: number
  width: number
  height: number
}

export interface EditSelection {
  /** "file.tsx:line:col" or null when no data-oeid was found. */
  oeid: string | null
  tag: string
  text: string
  rect: EditRect
  styles: Record<string, string>
}

/** Build the scoped prompt handed to the existing agent run path. */
export function composeEditInstruction(sel: EditSelection, userText: string): string {
  const loc = sel.oeid ? ` at ${sel.oeid.split(':').slice(0, 2).join(':')}` : ''
  const text = sel.text ? ` (text: "${sel.text.slice(0, 80)}")` : ''
  const style = Object.entries(sel.styles)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ')
  const styleLine = style ? ` Current styles — ${style}.` : ''
  return (
    `[Visual edit] The user selected the <${sel.tag}> element${loc}${text}.` +
    `${styleLine} Apply only this change to that element: ${userText.trim()}`
  )
}

/** Basename of an oeid ("a/b/Navbar.tsx:9:5" → "Navbar.tsx"), or null. */
export function oeidBasename(oeid: string | null): string | null {
  if (!oeid) return null
  const file = oeid.split(':')[0]
  return file.split('/').pop() ?? null
}

/**
 * Short, human-friendly label shown in the chat for a visual edit (the full
 * context block is sent to the model separately, not displayed).
 * e.g. `Edit <a> in Navbar.tsx: Change the text to: Kebab`
 */
export function formatEditLabel(sel: EditSelection, userText: string): string {
  const file = oeidBasename(sel.oeid)
  const where = file ? ` in ${file}` : ''
  return `Edit <${sel.tag}>${where}: ${userText.trim()}`
}

/**
 * Resolve which project file an oeid refers to. Matches by basename; returns
 * null when the oeid is null or the basename is ambiguous (so callers can fall
 * back to the agent rather than edit the wrong file).
 */
export function resolveOeidPath(paths: string[], oeid: string | null): string | null {
  const base = oeidBasename(oeid)
  if (!base) return null
  const matches = paths.filter((p) => p === base || p.endsWith('/' + base))
  return matches.length === 1 ? matches[0] : null
}

/**
 * Deterministically replace an element's text content in source. Returns the
 * patched code only when `oldText` occurs exactly once (literal, not regex);
 * otherwise null so the caller can fall back to the agent.
 */
export function applyTextEdit(code: string, oldText: string, newText: string): string | null {
  const needle = oldText.trim()
  if (!needle) return null
  const parts = code.split(needle)
  if (parts.length !== 2) return null // 0 or >1 occurrences
  return parts.join(newText)
}

// ─── Popover anchor math ───────────────────────────────────────────────────

const GAP = 8

/**
 * Position a popover near an element rect (all coords in parent/overlay space).
 * Prefers below the element; flips above when it would overflow the bottom;
 * clamps horizontally to the viewport with an 8px margin.
 */
export function anchorPopover(
  rect: EditRect,
  popover: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  const belowTop = rect.top + rect.height + GAP
  const fitsBelow = belowTop + popover.height <= viewport.height
  const top = fitsBelow ? belowTop : rect.top - popover.height - GAP

  const maxLeft = viewport.width - popover.width - GAP
  const left = Math.max(GAP, Math.min(rect.left, maxLeft))

  return { top, left }
}

/**
 * Returns a self-contained <script> (conservative ES5-ish, like
 * preview-runtime-check.ts) that runs inside the sandboxed preview iframe.
 * It is inert until the parent posts {__openthornEdit:'enable'}. While enabled
 * it draws a hover outline and, on click, posts the selected element back.
 * Message shape: {__openthornEdit:'selected'|'ready', payload?}.
 */
export function buildSelectModeScript(): string {
  return `<script>
(function(){
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  var enabled = false, hl = null, label = null;

  function box(){
    if (hl) return;
    hl = document.createElement('div');
    hl.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;border:2px solid #6d28d9;background:rgba(109,40,217,0.08);border-radius:4px;transition:all .05s ease;';
    label = document.createElement('div');
    label.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;font:600 11px system-ui,sans-serif;color:#fff;background:#6d28d9;padding:2px 6px;border-radius:4px 4px 4px 0;transform:translateY(-100%);white-space:nowrap;';
    document.body.appendChild(hl); document.body.appendChild(label);
  }
  function clearBox(){ if (hl){ hl.remove(); label.remove(); hl=null; label=null; } }

  function nearestOeid(el){
    var n = el;
    while (n && n.nodeType === 1){ if (n.getAttribute && n.getAttribute('data-oeid')) return n; n = n.parentElement; }
    return null;
  }
  function move(e){
    if (!enabled) return;
    var el = e.target; if (!el || el.nodeType !== 1) return;
    var r = el.getBoundingClientRect();
    box();
    hl.style.top=r.top+'px'; hl.style.left=r.left+'px'; hl.style.width=r.width+'px'; hl.style.height=r.height+'px';
    label.style.top=r.top+'px'; label.style.left=r.left+'px';
    label.textContent = '<' + el.tagName.toLowerCase() + '>';
  }
  function pick(e){
    if (!enabled) return;
    e.preventDefault(); e.stopPropagation();
    var el = e.target; var holder = nearestOeid(el) || el;
    var cs = getComputedStyle(el); var r = el.getBoundingClientRect();
    var styles = {};
    ['color','backgroundColor','fontSize','fontWeight','margin','padding','display','textAlign'].forEach(function(k){ styles[k]=cs[k]; });
    var payload = {
      oeid: holder.getAttribute ? holder.getAttribute('data-oeid') : null,
      tag: el.tagName.toLowerCase(),
      text: (el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,120),
      rect: { top:r.top, left:r.left, width:r.width, height:r.height },
      styles: styles
    };
    parent.postMessage({ __openthornEdit:'selected', payload: payload }, '*');
  }
  function enable(){ if (enabled) return; enabled=true; document.body.style.cursor='crosshair';
    document.addEventListener('mousemove', move, true); document.addEventListener('click', pick, true); }
  function disable(){ enabled=false; document.body.style.cursor=''; clearBox();
    document.removeEventListener('mousemove', move, true); document.removeEventListener('click', pick, true); }

  window.addEventListener('message', function(ev){
    var d = ev.data; if (!d || !d.__openthornEdit) return;
    if (d.__openthornEdit === 'enable') enable();
    else if (d.__openthornEdit === 'disable') disable();
  });
  // Esc inside the preview (where focus often lives) bubbles out to the parent.
  window.addEventListener('keydown', function(e){
    if (e.key === 'Escape') parent.postMessage({ __openthornEdit:'escape' }, '*');
  }, true);
  parent.postMessage({ __openthornEdit:'ready' }, '*');
})();
</script>`
}
