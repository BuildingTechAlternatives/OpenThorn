# Visual Click-to-Edit ("Point & Edit") — Design

**Date:** 2026-06-16
**Status:** Approved (design), pending implementation plan

## Summary

Add a Lovable-style "point and edit" mode to the OpenThorn project builder: the user
toggles an edit cursor, hovers/clicks any element in the live preview, and an inline
popover lets them describe the change. Each change is applied by the **existing agent**,
scoped to the exact source location of the clicked element. No new agent loop, no new
tools, no direct source write-back.

## Background / competitor research

- **Lovable "Visual Edits":** click an element, edit text/colors/spacing/borders/fonts
  directly. A Vite/Babel plugin tags every JSX element with a stable source ID
  (`data-source`-style attribute → file + line). Clicking a DOM node maps back to the
  exact JSX; edits apply to an in-browser AST and reflect optimistically.
  Refs: lovable.dev/blog/introducing-visual-edits, lovable.dev/blog/visual-edits,
  github.com/adrianton3/babel-plugin-transform-react-jsx-location
- **Base44:** similar click-to-edit; its real differentiator is the full-stack backend,
  not the editor mechanics.

**Decision vs. competitors:** OpenThorn keeps the *selection + source-mapping* idea but
applies edits **through the agent** rather than via optimistic AST write-back. OpenThorn
uses CSS Modules per component, so deterministic style write-back is brittle; the agent
already edits files + CSS Modules correctly and rebundles. This is "the agent is the
core" applied to visual editing.

## Goals

- Toggle an edit/select mode from the preview toolbar.
- Hover highlight + click-to-select any element in the sandboxed preview iframe.
- Inline popover anchored to the element with quick-action chips and an instruction input.
- Submitting feeds a **scoped instruction** (element identity + source location + key
  computed styles + user text) into the existing agent run path.
- The change round-trips into a rebuilt live preview.

## Non-goals (YAGNI for v1)

- Multi-select (Lovable's ⌘/Win multi-edit).
- Direct/optimistic write-back to source — every edit goes through the agent.
- Separate code paths per quick-action — chips only seed the instruction text.
- Instrumented data attributes in deployed/exported sites or screenshots.

## Architecture

Four units, each independently understandable and testable.

### Unit 1 — Source mapping (DOM → exact JSX location)

**What it does:** makes every rendered host (DOM) element carry a
`data-oeid="<fileName>:<line>:<col>"` attribute pointing at the JSX that produced it.

**How:**
- `buildPreview()` gains an opt-in option, `instrument?: boolean` (default `false`).
- When `instrument` is true:
  - esbuild build options add `jsxDev: true` (alongside existing `jsx: 'automatic'`).
    esbuild then emits calls to `react/jsx-dev-runtime`'s `jsxDEV(type, props, key,
    isStaticChildren, source, self)`, where `source = {fileName, lineNumber,
    columnNumber}`.
  - The import map entry for `react/jsx-dev-runtime` is repointed from esm.sh to a **new
    shim** served as a data URL (same mechanism as `openthorn-router.js`):
    `public/openthorn-jsx-dev.js`.
  - The shim imports the real `jsxDEV`/`Fragment` from
    `https://esm.sh/react@18.2.0/jsx-dev-runtime` and re-exports a wrapped `jsxDEV` that,
    **only when `typeof type === 'string'`** (host element), injects
    `props['data-oeid'] = fileName + ':' + lineNumber + ':' + columnNumber` (without
    mutating the caller's props object). Component elements are passed through untouched.
- When `instrument` is false the build is byte-for-byte today's behavior (prod runtime,
  no source arg, no shim).

**Dependencies:** esbuild-wasm, the existing import-map + data-URL injection pattern in
`preview-bundle.ts`.

**Gating:** the builder passes `instrument: true` **only** for the live, on-screen
editing preview. The deploy path and `capturePreviewThumbnail`/screenshot path call
`buildPreview` **without** `instrument`, so `data-oeid` never ships to production or
appears in thumbnails.

### Unit 2 — Select mode (injected into the sandboxed iframe)

**What it does:** inside the preview iframe, draws a hover outline + label and, on click,
captures the target element's selection info and posts it to the parent.

**How:** a new module `src/lib/preview-edit.ts` exports a function that returns the
injectable `<script>` string (mirroring `preview-runtime-check.ts` / `preview-inspect.ts`
style — conservative ES5-ish, token-guarded `postMessage`). Behavior:
- Listens for a parent `postMessage` (`{__openthornEdit: 'enable'|'disable', token}`).
- While enabled: `mousemove` → draw a highlight box (a single absolutely-positioned
  overlay `div`, no per-element style mutation) and a small tag label; `click` →
  `preventDefault`/`stopPropagation`, then capture:
  - `oeid` (nearest ancestor's `data-oeid`, walking up if the exact target lacks one),
  - `tag` (lowercased tagName),
  - `text` (trimmed `textContent`, truncated),
  - `rect` (bounding box relative to the iframe viewport),
  - `styles`: a fixed allowlist read from `getComputedStyle` — `color`,
    `backgroundColor`, `fontSize`, `fontWeight`, `margin`, `padding`, `display`,
    `textAlign`.
- Posts `{__openthornEdit:'selected', token, payload}` to the parent.
- `disable` removes overlay + listeners and restores normal interaction.

This script is appended to the preview HTML only when building the instrumented preview
(it is inert until the parent enables it, so including it always is also acceptable; for
clarity it is added alongside instrumentation).

**Dependencies:** DOM in the iframe; the parent for enable/disable + receiving selections.

### Unit 3 — Inline popover (parent React)

**What it does:** renders the edit UI anchored to the selected element and collects the
user's instruction.

**How:** a new component `src/components/PreviewEditPopover/` (with co-located
`.module.css`, per repo convention):
- Props: the selection payload (incl. `rect` and `oeid`), `onSubmit(instruction,
  payload)`, `onClose`.
- Renders an element-identity header (`<h1> · App.tsx:14`), quick-action chips —
  **Edit text · Restyle · Spacing · Delete** — and a compact textarea/input with submit.
- Chips seed the input text only (e.g. *Edit text* → prefill current text; *Spacing* →
  "Adjust the spacing/padding of this element"; *Delete* → "Remove this element"); they
  do not branch the apply logic.
- Anchoring math lives in a pure helper (`anchorPopover(rect, popoverSize, viewport)` →
  `{top,left}`), so it is unit-testable and flips above/below + clamps to viewport edges.
- Styling uses existing design tokens from `src/index.css` (`--color-bg`,
  `--color-text`, `--color-accent`, etc.); no hardcoded hex.

The popover lives in the preview pane in `ProjectBuilderPage.tsx`, positioned over the
iframe. The iframe reports rects in its own viewport coordinates; the parent offsets by
the iframe's on-screen position (and current device-preview scale, if any) before
anchoring.

**Dependencies:** Unit 2 (selection payloads), Unit 4 (submit handler), design tokens.

### Unit 4 — Agent handoff (scoped instruction)

**What it does:** turns a selection + user text into a single scoped instruction and runs
it through the **existing** agent path used by the chat box.

**How:**
- A pure composer `composeEditInstruction(payload, userText)` (new, in `preview-edit.ts`
  or a small `agent-edit-context.ts`) produces a structured prefix, e.g.:
  > `[Visual edit] Target <h1> at App.tsx:14 (text: "Welcome"; color #111; font-size
  > 48px). Apply this change: make it navy and bigger.`
- `ProjectBuilderPage` passes this string into the **same function the chat input calls**
  to start an agent run. No new tool, no new loop. The agent locates the file from the
  `oeid`, edits it (TSX and/or its CSS Module), and the normal post-iteration rebuild
  refreshes the preview.
- Edit mode auto-disables while the agent is running (toolbar toggle disabled), matching
  the existing "no edits mid-run" behavior.

**Dependencies:** the existing agent-run entry point in `ProjectBuilderPage`.

## Data flow

1. Builder builds the on-screen preview with `instrument: true` → host elements carry
   `data-oeid`; the select-mode script is present but inert.
2. User clicks the toolbar **Edit** toggle → parent posts `enable` to the iframe.
3. User hovers (highlight) and clicks an element → iframe posts `selected` + payload.
4. Parent opens `PreviewEditPopover` anchored to the element.
5. User picks a chip and/or types, submits → `composeEditInstruction` → existing agent run.
6. Agent edits source, loop rebuilds preview (uninstrumented for deploy/screenshot, but
   the live preview rebuilds instrumented), popover closes, edit mode stays available.

## Error / edge handling

- **No `data-oeid` on/above the clicked node** (e.g. a portal or injected node): walk up
  to the nearest ancestor with one; if none, send `oeid: null` and the composer omits the
  location, falling back to tag + text so the agent can still locate it.
- **Iframe rebuilds** (new `srcdoc`) while editing: selection state is cleared and the
  popover closes; edit toggle persists and re-enables on the new frame's load.
- **Device-preview scaling / scroll:** anchor math accounts for iframe offset, scroll, and
  any CSS scale applied to the preview card.
- **Agent already running:** edit toggle disabled; submitting is blocked.
- **Uninstrumented build path unchanged:** deploy/screenshot must remain identical to
  today (guarded by a test).

## Testing

**Unit (`src/lib/__tests__/`):**
- jsx-dev shim: given a host `type` + source, output props include correct `data-oeid`;
  given a component `type`, props are untouched; caller's props object not mutated.
- `composeEditInstruction`: formats the prefix correctly with and without `oeid`/text.
- `anchorPopover`: flips above/below and clamps to viewport edges.

**Integration:**
- Extend `preview-bundle.test.ts`: `buildPreview(files, { instrument: true })` yields HTML
  whose rendered host elements carry `data-oeid` (assert on emitted JS referencing the
  data-URL dev runtime + presence of source args), and `instrument: false` (default)
  produces output with **no** `data-oeid` / dev runtime — byte-compatible with today.

**Manual smoke (documented in plan):**
- `npm run dev`; in a project, toggle Edit, hover (highlight appears), click an element
  (popover anchors correctly), submit a change, confirm it round-trips into a live
  preview update; confirm deploy/export contains no `data-oeid`.

## Files touched (anticipated)

- `src/lib/preview-bundle.ts` — `instrument` option, `jsxDev`, dev-runtime import-map swap,
  inject select-mode script.
- `public/openthorn-jsx-dev.js` — **new** dev-runtime shim (data-URL injected).
- `src/lib/preview-edit.ts` — **new** select-mode injected script + `composeEditInstruction`
  + (optionally) anchor helper.
- `src/components/PreviewEditPopover/` — **new** component + `.module.css`.
- `src/pages/ProjectBuilderPage.tsx` — toolbar toggle, iframe enable/disable messaging,
  selection state, popover rendering, agent handoff wiring; ensure deploy/screenshot
  builds stay uninstrumented.
- Tests as above.

## Open questions

None blocking. The exact `fileName` string esbuild emits for virtual files
(`virtual:/src/App.tsx` vs `/src/App.tsx`) will be normalized in the composer so the
agent sees a clean `App.tsx:14`; confirmed/handled during implementation.
