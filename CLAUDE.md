# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Bloom is a BYOK (Bring Your Own Key) vibe-coding website builder — users bring their own provider API keys, so there are no server-side AI costs. It's a client-side React 19 + TypeScript + Vite single-page application with a two-panel layout: AI chat on the left, live website preview on the right.

## Commands

```bash
npm run dev        # Start dev server (HMR)
npm run build      # Type-check (tsc -b) then production build (vite build)
npm run preview    # Preview production build locally
npm run lint       # ESLint on all files
```

Type-check without building: `npx tsc --noEmit` (or `npx tsc -b` to check with project references).

## Architecture

```
App
 └─ ResizablePanel (layout/)
      ├─ ChatPanel (chat/)          ← left side
      │    ├─ ChatMessage           ← markdown bubbles + copy/like/dislike
      │    ├─ ChatInput             ← textarea + Build/Plan dropdown + voice + send
      │    └─ PlusMenu              ← + button dropdown (grouped menu items)
      └─ PreviewPanel (preview/)    ← right side
           ├─ PreviewToolbar        ← route bar, device switcher, 3-dot menu, share/publish
           ├─ PreviewFrame          ← rendered website (iframe-like demo content)
           └─ CodePanel             ← file tree + syntax-highlighted code viewer
```

- **State**: React `useState`/`useRef` in each component — no global state library yet. The `ChatPanel` defines the `Message` interface (`id`, `role`, `text`).
- **Resizable divider**: `ResizablePanel` manages a drag handle that splits left/right between 30%–70%. State is local mouse-event driven.
- **PreviewPanel** toggles between `PreviewFrame` (normal) and `CodePanel` (when Code/Files is selected from the 3-dot menu) via a `codeView: CodeView | null` state lifted from the toolbar.
- **Sample data**: `src/data/sampleFiles.ts` holds demo project files (HTML, CSS, JS, JSON) shown in the CodePanel.

## Design system

All tokens are CSS custom properties in `src/styles/globals.css`:

| Category | Key variables |
|----------|--------------|
| Backgrounds | `--bg-root`, `--bg-panel`, `--bg-elevated`, `--bg-field`, `--bg-hover` |
| Accent | `--accent` (#4f8fff), `--accent-glow`, `--accent-soft` |
| Text | `--text-primary` (#e8e8ed), `--text-secondary`, `--text-tertiary`, `--text-disabled` |
| Borders | `--border-subtle` (rgba white 0.04), `--border-default` (0.07), `--border-strong` (0.11) |
| Typography | `--font-display` (Syne), `--font-body` (Manrope), `--font-mono` (Fira Code) |
| Radii | `--radius-xs` through `--radius-2xl` |
| Shadows | `--shadow-sm`, `--shadow-panel`, `--shadow-elevated`, `--shadow-glow`, `--shadow-input` |

Every component uses **CSS Modules** (`*.module.css`), importing design tokens from the global `:root`. The aesthetic is dark glass with a subtle dot-grid and grain texture overlay on `body::after`.

## Key dependencies

- **react-markdown** + **remark-gfm**: Renders AI chat responses as markdown
- **rehype-sanitize**: Strips unsafe HTML from markdown to prevent XSS
- **react-syntax-highlighter**: Code viewer with Atom One Dark theme and line numbers (CodePanel)
- **Vite 8** with `@vitejs/plugin-react` (Oxc-based)

## Patterns

- **CSS Modules**: One `.module.css` per component, co-located. Tokens accessed via `var(--name)` from globals.css.
- **Click-outside handling**: Dropdowns use a `useEffect` that adds a window `click` listener when open, checking `ref.current.contains(e.target)`.
- **No router**: Single-page builder — routing will be added later.
- **BYOK architecture**: All AI provider calls will happen client-side using the user's own API keys. No backend server is planned.
