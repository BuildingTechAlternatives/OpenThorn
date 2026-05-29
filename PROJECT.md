# Bloom — BYOK Vibe Coding

Bloom is a vibe-coding website builder where users describe what they want in natural language and an AI generates the complete website in real time.

## What makes it different

**BYOK (Bring Your Own Key).** Users use their own API keys from providers like OpenAI, Anthropic, or Google. There are no platform fees, no server-side AI costs, and no subscriptions — Bloom is just the interface. The user's keys stay on their device; all AI calls happen client-side.

## How it works

1. You type what you want to build in the chat — e.g. "Build me a landing page for a SaaS startup"
2. The AI generates the full code (HTML, CSS, JS) and it appears live in the preview panel
3. You can switch between **Plan** mode (architecture-first) and **Build** mode (generate working code)
4. Every generated project has a file tree you can browse, with syntax-highlighted code
5. When you're done, publish or share the result

## Current state

The UI is fully designed and partially functional — a polished dark-interface builder with:

- **Left panel**: AI chat with markdown rendering, Plan/Build mode toggle, voice input, and quick-access menu
- **Right panel**: Live website preview with device switching (phone/tablet/desktop), route navigation, and a code viewer with file tree
- **Design**: Dark glass aesthetic with custom design tokens (CSS custom properties)

The AI integration (actual code generation) is not yet wired up — the UI shows demo content.

## Tech stack

React 19, TypeScript, Vite 8, CSS Modules. Fully client-side. No backend.
