# Visual Click-to-Edit ("Point & Edit") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users toggle an edit cursor in the live preview, click any element, and describe a change in an inline popover; the existing agent applies the change scoped to that element's exact source location.

**Architecture:** An opt-in instrumented preview build tags host DOM elements with `data-oeid="file:line:col"` via a `jsxDev` runtime shim. A script injected into the sandboxed iframe handles hover-highlight + click-to-select and posts the selection to the parent. A React popover collects an instruction and hands a scoped prompt to the existing `handleAgentRequest` path. No optimistic write-back, no new agent tools.

**Tech Stack:** React 19 + TypeScript, esbuild-wasm, CSS Modules, Vitest. Mirrors existing patterns in `preview-bundle.ts`, `preview-runtime-check.ts`, `preview-inspect.ts`.

---

## File structure

- `src/lib/preview-bundle.ts` — **modify**: add `instrument` build option (jsxDev + dev-runtime import-map swap + inject select-mode script).
- `public/openthorn-jsx-dev.js` — **create**: dev-runtime shim, injected as a data URL (mirrors `openthorn-router.js`). Adds `data-oeid` to host elements.
- `src/lib/preview-edit.ts` — **create**: pure helpers (`injectOeidProps`, `normalizeOeid`, `composeEditInstruction`, `anchorPopover`) + the injectable select-mode `<script>` builder + shared message types.
- `src/components/PreviewEditPopover/PreviewEditPopover.tsx` + `.module.css` — **create**: the inline popover UI.
- `src/pages/ProjectBuilderPage.tsx` — **modify**: toolbar toggle, iframe enable/disable messaging, selection state, popover rendering, agent handoff; keep deploy/screenshot builds uninstrumented.
- Tests in `src/lib/__tests__/`.

Conventions: design tokens from `src/index.css` (no hardcoded hex); `openthorn:` event namespace; one folder per component with co-located `.module.css`.

---

## Task 1: `buildPreview` gains an `instrument` option (build wiring only)

**Files:**
- Modify: `src/lib/preview-bundle.ts`
- Test: `src/lib/__tests__/preview-bundle.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/__tests__/preview-bundle.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import * as esbuild from 'esbuild'
import { buildPreview } from '../preview-bundle'

const FILES = [
  { path: '/src/App.tsx', content: `export default function App(){ return <h1>Hi</h1> }` },
]

describe('buildPreview instrument option', () => {
  it('uses the dev jsx runtime + data-URL shim when instrument is true', async () => {
    const { html, errors } = await buildPreview(FILES, esbuild, { instrument: true })
    expect(errors).toEqual([])
    // import map repoints the dev runtime to a data: URL (the shim), not esm.sh
    expect(html).toMatch(/"react\/jsx-dev-runtime":\s*"data:text\/javascript/)
    // bundled JS calls the dev runtime (jsxDEV) so source locations are emitted
    expect(html).toContain('jsxDEV')
  })

  it('is unchanged (prod runtime, no shim, no data-oeid) when instrument is omitted', async () => {
    const { html, errors } = await buildPreview(FILES, esbuild)
    expect(errors).toEqual([])
    expect(html).not.toContain('jsxDEV')
    expect(html).not.toContain('data-oeid')
    expect(html).toMatch(/"react\/jsx-dev-runtime":\s*"https:\/\/esm\.sh/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/preview-bundle.test.ts -t "instrument option"`
Expected: FAIL — `buildPreview` ignores the third arg; dev runtime still points to esm.sh and `jsxDEV` is absent.

- [ ] **Step 3: Implement the option**

In `src/lib/preview-bundle.ts`:

Change the signature and thread the option through. Replace the `buildPreview` declaration:

```ts
export interface BuildPreviewOptions {
  /** When true, tag host DOM elements with data-oeid and include the select-mode script. */
  instrument?: boolean
}

export async function buildPreview(
  files: VirtualFile[],
  esbuildOverride?: EsbuildLike,
  opts: BuildPreviewOptions = {},
): Promise<PreviewResult> {
```

In the `esbuild.build({ ... })` call, make the jsx mode conditional:

```ts
      jsx: 'automatic',
      jsxDev: opts.instrument === true,
```

Make `getImportMap` accept the flag and swap the dev runtime entry. Change its signature:

```ts
function getImportMap(instrument = false): Record<string, string> {
```

Inside, after the existing `'react/jsx-dev-runtime'` line, override it when instrumenting (the shim is imported lazily as raw text — add the import at the top of the file next to the router import):

```ts
import openthornJsxDevSource from '../../public/openthorn-jsx-dev.js?raw'
```

and in `getImportMap`:

```ts
  if (instrument) {
    map['react/jsx-dev-runtime'] =
      'data:text/javascript;base64,' + toBase64(openthornJsxDevSource)
  }
```

Update the call site inside `buildPreview` (where `importMap` is built):

```ts
  const importMap = JSON.stringify({ imports: getImportMap(opts.instrument) }, null, 2)
```

> NOTE: `public/openthorn-jsx-dev.js` does not exist yet — this task will not pass until Task 2 creates it. If your tooling errors on the missing `?raw` import, do Task 2 first, then return here. (Subagent runner: Task 2 is a hard prerequisite for Step 4.)

- [ ] **Step 4: Run the test to verify it passes** (requires Task 2 file present)

Run: `npx vitest run src/lib/__tests__/preview-bundle.test.ts`
Expected: PASS (all existing tests in the file still pass too).

- [ ] **Step 5: Commit**

```bash
git add src/lib/preview-bundle.ts src/lib/__tests__/preview-bundle.test.ts
git commit -m "feat(preview): add instrument option to buildPreview for source mapping"
```

---

## Task 2: dev-runtime shim that injects `data-oeid`

**Files:**
- Create: `public/openthorn-jsx-dev.js`
- Create: `src/lib/preview-edit.ts` (the `injectOeidProps` helper — single source of truth for the logic the shim mirrors)
- Test: `src/lib/__tests__/preview-edit.test.ts`

- [ ] **Step 1: Write the failing test for the pure injection helper**

Create `src/lib/__tests__/preview-edit.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { injectOeidProps } from '../preview-edit'

describe('injectOeidProps', () => {
  const source = { fileName: 'virtual:/src/App.tsx', lineNumber: 14, columnNumber: 9 }

  it('adds data-oeid to host (string type) elements', () => {
    const props = { className: 'x' }
    const out = injectOeidProps('h1', props, source)
    expect(out['data-oeid']).toBe('App.tsx:14:9')
    expect(out.className).toBe('x')
  })

  it('does not mutate the caller props object', () => {
    const props = { className: 'x' }
    injectOeidProps('h1', props, source)
    expect('data-oeid' in props).toBe(false)
  })

  it('leaves component (function/non-string type) elements untouched', () => {
    const props = { foo: 1 }
    const Comp = () => null
    expect(injectOeidProps(Comp, props, source)).toBe(props)
  })

  it('returns props unchanged when source is missing', () => {
    const props = { a: 1 }
    expect(injectOeidProps('div', props, undefined)).toBe(props)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/preview-edit.test.ts -t injectOeidProps`
Expected: FAIL — module `../preview-edit` not found.

- [ ] **Step 3: Implement the helper in a new `preview-edit.ts`**

Create `src/lib/preview-edit.ts` with (more is added in later tasks):

```ts
/**
 * Visual click-to-edit support. Pure helpers here are unit-tested; the
 * `public/openthorn-jsx-dev.js` shim mirrors `injectOeidProps` (it cannot import
 * TS, so the small logic is duplicated there — keep them in sync).
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/preview-edit.test.ts -t injectOeidProps`
Expected: PASS.

- [ ] **Step 5: Create the runtime shim**

Create `public/openthorn-jsx-dev.js` (dependency-free ES module; mirrors `injectOeidProps`):

```js
// OpenThorn dev jsx-runtime shim. Injected into instrumented previews via a
// data: URL so clicking a rendered element can be traced to its JSX source.
// Mirrors injectOeidProps in src/lib/preview-edit.ts — keep in sync.
import { jsxDEV as _jsxDEV, Fragment } from 'https://esm.sh/react@18.2.0/jsx-dev-runtime'

function oeid(source) {
  if (!source || !source.fileName) return ''
  var file = String(source.fileName).replace(/^virtual:/, '').replace(/^\/+/, '')
  file = file.split('/').pop()
  return file + ':' + source.lineNumber + ':' + source.columnNumber
}

export function jsxDEV(type, props, key, isStaticChildren, source, self) {
  if (typeof type === 'string' && source) {
    var next = Object.assign({}, props)
    next['data-oeid'] = oeid(source)
    return _jsxDEV(type, next, key, isStaticChildren, source, self)
  }
  return _jsxDEV(type, props, key, isStaticChildren, source, self)
}

export { Fragment }
```

- [ ] **Step 6: Run the Task 1 build test (now unblocked) and the full preview suite**

Run: `npx vitest run src/lib/__tests__/preview-bundle.test.ts src/lib/__tests__/preview-edit.test.ts`
Expected: PASS for both files.

- [ ] **Step 7: Commit**

```bash
git add public/openthorn-jsx-dev.js src/lib/preview-edit.ts src/lib/__tests__/preview-edit.test.ts
git commit -m "feat(preview): add data-oeid jsx-dev shim and injection helper"
```

---

## Task 3: scoped instruction composer + selection types

**Files:**
- Modify: `src/lib/preview-edit.ts`
- Test: `src/lib/__tests__/preview-edit.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/preview-edit.test.ts`:

```ts
import { composeEditInstruction, type EditSelection } from '../preview-edit'

describe('composeEditInstruction', () => {
  const sel: EditSelection = {
    oeid: 'App.tsx:14:9',
    tag: 'h1',
    text: 'Welcome',
    rect: { top: 10, left: 20, width: 100, height: 40 },
    styles: { color: 'rgb(17,17,17)', fontSize: '48px', fontWeight: '700' },
  }

  it('includes tag, source location, text and the user request', () => {
    const out = composeEditInstruction(sel, 'make it navy and bigger')
    expect(out).toContain('App.tsx:14')
    expect(out).toContain('<h1>')
    expect(out).toContain('Welcome')
    expect(out).toContain('make it navy and bigger')
  })

  it('omits the source location gracefully when oeid is null', () => {
    const out = composeEditInstruction({ ...sel, oeid: null }, 'center this')
    expect(out).not.toContain('null')
    expect(out).toContain('<h1>')
    expect(out).toContain('center this')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/preview-edit.test.ts -t composeEditInstruction`
Expected: FAIL — `composeEditInstruction` / `EditSelection` not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/preview-edit.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/preview-edit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/preview-edit.ts src/lib/__tests__/preview-edit.test.ts
git commit -m "feat(preview): add scoped edit-instruction composer"
```

---

## Task 4: popover anchor math

**Files:**
- Modify: `src/lib/preview-edit.ts`
- Test: `src/lib/__tests__/preview-edit.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/preview-edit.test.ts`:

```ts
import { anchorPopover } from '../preview-edit'

describe('anchorPopover', () => {
  const viewport = { width: 1000, height: 800 }
  const popover = { width: 280, height: 160 }

  it('places the popover below the element when there is room', () => {
    const pos = anchorPopover({ top: 100, left: 100, width: 50, height: 30 }, popover, viewport)
    expect(pos.top).toBe(100 + 30 + 8) // below + 8px gap
    expect(pos.left).toBe(100)
  })

  it('flips above when there is not enough room below', () => {
    const pos = anchorPopover({ top: 720, left: 100, width: 50, height: 30 }, popover, viewport)
    expect(pos.top).toBe(720 - 160 - 8) // above + gap
  })

  it('clamps to the right/left edges', () => {
    const pos = anchorPopover({ top: 100, left: 950, width: 50, height: 30 }, popover, viewport)
    expect(pos.left).toBe(1000 - 280 - 8) // clamped 8px from the right edge
    const pos2 = anchorPopover({ top: 100, left: -20, width: 50, height: 30 }, popover, viewport)
    expect(pos2.left).toBe(8) // clamped 8px from the left edge
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/preview-edit.test.ts -t anchorPopover`
Expected: FAIL — `anchorPopover` not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/preview-edit.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/preview-edit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/preview-edit.ts src/lib/__tests__/preview-edit.test.ts
git commit -m "feat(preview): add popover anchor math"
```

---

## Task 5: in-iframe select-mode script + injection into the build

**Files:**
- Modify: `src/lib/preview-edit.ts` (add `buildSelectModeScript`)
- Modify: `src/lib/preview-bundle.ts` (inject the script when `instrument`)
- Test: `src/lib/__tests__/preview-bundle.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/preview-bundle.test.ts`:

```ts
describe('buildPreview select-mode script', () => {
  it('injects the select-mode script when instrument is true', async () => {
    const { html } = await buildPreview(FILES, esbuild, { instrument: true })
    expect(html).toContain('__openthornEdit')
  })
  it('omits the select-mode script by default', async () => {
    const { html } = await buildPreview(FILES, esbuild)
    expect(html).not.toContain('__openthornEdit')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/preview-bundle.test.ts -t "select-mode script"`
Expected: FAIL — `__openthornEdit` not present.

- [ ] **Step 3: Add the script builder to `preview-edit.ts`**

Append to `src/lib/preview-edit.ts`:

```ts
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
  parent.postMessage({ __openthornEdit:'ready' }, '*');
})();
</script>`
}
```

- [ ] **Step 4: Inject it from `buildPreview` when instrumenting**

In `src/lib/preview-bundle.ts`, import the builder near the other imports:

```ts
import { buildSelectModeScript } from './preview-edit'
```

In `buildPreview`, before the HTML template is assembled, compute:

```ts
  const selectModeScript = opts.instrument ? buildSelectModeScript() : ''
```

Add it into the `<head>` of the HTML template, right after `${previewNavigationGuard}`:

```ts
  ${previewNavigationGuard}
  ${selectModeScript}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/preview-bundle.test.ts src/lib/__tests__/preview-edit.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/preview-edit.ts src/lib/preview-bundle.ts src/lib/__tests__/preview-bundle.test.ts
git commit -m "feat(preview): add in-iframe select-mode script"
```

---

## Task 6: the inline popover component

**Files:**
- Create: `src/components/PreviewEditPopover/PreviewEditPopover.tsx`
- Create: `src/components/PreviewEditPopover/PreviewEditPopover.module.css`

(No new unit test — behavior is exercised by the pure helpers in Tasks 3–4 and the manual smoke in Task 8. Keep the component thin.)

- [ ] **Step 1: Create the component**

Create `src/components/PreviewEditPopover/PreviewEditPopover.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import type { EditSelection } from '../../lib/preview-edit'
import { anchorPopover } from '../../lib/preview-edit'
import styles from './PreviewEditPopover.module.css'

const CHIPS: { label: string; seed: (s: EditSelection) => string }[] = [
  { label: 'Edit text', seed: (s) => `Change the text to: ${s.text}` },
  { label: 'Restyle', seed: () => 'Restyle this element: ' },
  { label: 'Spacing', seed: () => 'Adjust the spacing/padding of this element: ' },
  { label: 'Delete', seed: () => 'Remove this element.' },
]

interface Props {
  selection: EditSelection
  /** Offset of the iframe within the page, in CSS px. */
  frameOffset: { top: number; left: number }
  busy: boolean
  onSubmit: (instruction: string, selection: EditSelection) => void
  onClose: () => void
}

const SIZE = { width: 300, height: 190 }

export default function PreviewEditPopover({ selection, frameOffset, busy, onSubmit, onClose }: Props) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [selection])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pos = anchorPopover(
    {
      top: selection.rect.top + frameOffset.top,
      left: selection.rect.left + frameOffset.left,
      width: selection.rect.width,
      height: selection.rect.height,
    },
    SIZE,
    { width: window.innerWidth, height: window.innerHeight },
  )

  const submit = () => {
    if (!text.trim() || busy) return
    onSubmit(text, selection)
  }

  const locLabel = selection.oeid ? selection.oeid.split(':').slice(0, 2).join(':') : 'unknown'

  return (
    <div
      className={styles.popover}
      style={{ top: pos.top, left: pos.left, width: SIZE.width }}
      role="dialog"
      aria-label="Edit selected element"
    >
      <div className={styles.header}>
        <span className={styles.tag}>&lt;{selection.tag}&gt;</span>
        <span className={styles.loc}>{locLabel}</span>
        <button className={styles.close} onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className={styles.chips}>
        {CHIPS.map((c) => (
          <button
            key={c.label}
            className={styles.chip}
            onClick={() => {
              setText(c.seed(selection))
              inputRef.current?.focus()
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <textarea
        ref={inputRef}
        className={styles.input}
        value={text}
        placeholder="Describe the change…"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
      />
      <button className={styles.apply} onClick={submit} disabled={!text.trim() || busy}>
        {busy ? 'Applying…' : 'Apply change'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create the styles** (use design tokens; no hardcoded hex)

Create `src/components/PreviewEditPopover/PreviewEditPopover.module.css`:

```css
.popover {
  position: fixed;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--color-bg);
  color: var(--color-text);
  border: 1px solid color-mix(in srgb, var(--color-text) 12%, transparent);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
  animation: pageFade 0.12s ease both;
}
.header { display: flex; align-items: center; gap: 0.5rem; }
.tag { font-weight: 600; font-size: 0.85rem; }
.loc {
  font-size: 0.72rem;
  opacity: 0.6;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.close {
  margin-left: auto;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0.6;
}
.close:hover { opacity: 1; }
.chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.chip {
  font-size: 0.72rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-text) 16%, transparent);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
}
.chip:hover { border-color: var(--color-accent); color: var(--color-accent); }
.input {
  width: 100%;
  min-height: 56px;
  resize: vertical;
  padding: 0.5rem;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--color-text) 16%, transparent);
  background: var(--color-bg);
  color: var(--color-text);
  font: inherit;
  font-size: 0.85rem;
}
.input:focus { outline: 2px solid var(--color-accent); outline-offset: 1px; }
.apply {
  align-self: flex-end;
  padding: 0.4rem 0.9rem;
  border: none;
  border-radius: 8px;
  background: var(--color-accent);
  color: #fff;
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
}
.apply:disabled { opacity: 0.5; cursor: not-allowed; }
```

> `pageFade` is a shared keyframe defined in `src/index.css` (per CLAUDE.md). If your checkout lacks it, drop the `animation` line.

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: `tsc -b` passes (no type errors). Fix the `useRef` import typo if the build flags it.

- [ ] **Step 4: Commit**

```bash
git add src/components/PreviewEditPopover/
git commit -m "feat(preview): add inline edit popover component"
```

---

## Task 7: wire it into ProjectBuilderPage

**Files:**
- Modify: `src/pages/ProjectBuilderPage.tsx`

- [ ] **Step 1: Make the live preview build instrumented (and confirm deploy/screenshot are not)**

Find the live-preview build effect (around `src/pages/ProjectBuilderPage.tsx:797`):

```ts
const result = await buildPreview(projectFiles.map((f) => ({ path: f.path, content: f.code })))
```

Change it to instrument the on-screen preview:

```ts
const result = await buildPreview(
  projectFiles.map((f) => ({ path: f.path, content: f.code })),
  undefined,
  { instrument: true },
)
```

Leave the deploy/storage build (around `:869`) and any screenshot build (around `:966`) **unchanged** — they must stay uninstrumented. Verify by reading those two call sites: neither should pass `{ instrument: true }`.

- [ ] **Step 2: Add edit-mode state, selection state, and imports**

Near the other imports at the top of the file:

```ts
import PreviewEditPopover from '../components/PreviewEditPopover/PreviewEditPopover'
import type { EditSelection } from '../lib/preview-edit'
import { composeEditInstruction } from '../lib/preview-edit'
```

Near the other `useState` declarations (e.g. after `viewMode`):

```ts
const [editMode, setEditMode] = useState(false)
const [selection, setSelection] = useState<EditSelection | null>(null)
```

- [ ] **Step 3: Send enable/disable to the iframe and receive selections**

Add an effect (place it after the existing preview effects). It posts enable/disable to the iframe and listens for selections:

```ts
useEffect(() => {
  const frame = previewFrameRef.current
  const msg = editMode ? 'enable' : 'disable'
  frame?.contentWindow?.postMessage({ __openthornEdit: msg }, '*')
  if (!editMode) setSelection(null)
}, [editMode, previewHtml])

useEffect(() => {
  const onMessage = (e: MessageEvent) => {
    const d = e.data
    if (!d || !d.__openthornEdit) return
    if (d.__openthornEdit === 'selected' && d.payload) {
      setSelection(d.payload as EditSelection)
    }
  }
  window.addEventListener('message', onMessage)
  return () => window.removeEventListener('message', onMessage)
}, [])
```

Auto-exit edit mode whenever the agent starts running (add after the effects above):

```ts
useEffect(() => {
  if (agentRunning && editMode) {
    setEditMode(false)
    setSelection(null)
  }
}, [agentRunning, editMode])
```

- [ ] **Step 4: Add the toolbar toggle**

In the `previewTools` div (around `:2194`, next to the fullscreen button), add an Edit toggle:

```tsx
<button
  type="button"
  className={editMode ? styles.modeActive : ''}
  onClick={() => setEditMode((v) => !v)}
  disabled={agentRunning || effectivePreviewStatus !== 'ready'}
  aria-pressed={editMode}
  aria-label={editMode ? 'Exit edit mode' : 'Edit elements'}
  title={editMode ? 'Exit edit mode' : 'Click an element to edit it'}
>
  ✏︎ Edit
</button>
```

- [ ] **Step 5: Render the popover**

Immediately after the closing `</div>` of the `previewRebuild` wrapper that contains the `<iframe>` (around `:2325`), render:

```tsx
{editMode && selection && (
  <PreviewEditPopover
    selection={selection}
    frameOffset={(() => {
      const r = previewFrameRef.current?.getBoundingClientRect()
      return { top: r?.top ?? 0, left: r?.left ?? 0 }
    })()}
    busy={agentRunning}
    onClose={() => setSelection(null)}
    onSubmit={(instruction, sel) => {
      setSelection(null)
      setEditMode(false)
      void handleAgentRequest(
        composeEditInstruction(sel, instruction),
        activeModel,
        activeThinkingLevel,
        { mode: 'refine' },
      )
    }}
  />
)}
```

- [ ] **Step 6: Typecheck + lint + full test run**

Run: `npm run build && npm run lint && npm run test`
Expected: build passes, lint clean, all tests green.

- [ ] **Step 7: Commit**

```bash
git add src/pages/ProjectBuilderPage.tsx
git commit -m "feat(preview): wire visual click-to-edit into the project builder"
```

---

## Task 8: manual smoke test + verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Open `http://localhost:5173`, open or create a project, and let the first build finish (preview shows "Live preview").

- [ ] **Step 2: Verify select mode**

- Click the **✏︎ Edit** toolbar button. Hover the preview — a purple outline + `<tag>` label should track elements.
- Click a heading. The inline popover should appear anchored near it, showing `<h1>` and a `file.tsx:line` location.

- [ ] **Step 3: Verify the agent handoff**

- Type "make this navy and larger" and Apply (or press Enter). Edit mode exits, the agent runs, and the rebuilt preview reflects the change.
- Confirm the chat shows the scoped `[Visual edit] …` instruction.

- [ ] **Step 4: Verify production builds are clean**

- Trigger a deploy (or inspect the deploy build path) and confirm the exported HTML contains **no** `data-oeid` and **no** `__openthornEdit` (uninstrumented build). The simplest automated proxy already exists: the Task 1/Task 5 "omits …" tests. Spot-check by searching the deployed output.

- [ ] **Step 5: Final full verification**

Run: `npm run build && npm run lint && npm run test`
Expected: all green. Record the output.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "test(preview): verify visual click-to-edit end-to-end"
```

---

## Self-review notes

- **Spec coverage:** Unit 1 (source mapping) → Tasks 1–2; Unit 2 (select mode) → Task 5; Unit 3 (popover) → Tasks 4 + 6; Unit 4 (agent handoff) → Tasks 3 + 7. Gating (deploy/screenshot uninstrumented) → Task 7 Step 1 + tests in Tasks 1 & 5. Edge cases (no oeid, anchor flip/clamp, agent-running disable, iframe rebuild clears selection) → Tasks 3, 4, 7. Testing plan → Tasks 1–5 unit/integration + Task 8 manual.
- **Type consistency:** `EditSelection`, `EditRect`, `JsxSource`, `injectOeidProps`, `normalizeOeid`, `composeEditInstruction`, `anchorPopover`, `buildSelectModeScript`, `BuildPreviewOptions` are defined once in Task 1–5 and reused with the same signatures in Tasks 6–7. `handleAgentRequest(request, selectedModel, thinkingLevel?, options?)` matches `ProjectBuilderPage.tsx:1206`.
- **No placeholders:** every code step contains complete, runnable code. `?raw` import ordering (Task 1 needs Task 2's file) is called out explicitly so the build test isn't run prematurely.
