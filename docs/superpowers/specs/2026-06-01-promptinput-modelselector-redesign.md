# PromptInput & ModelSelector Redesign

**Date:** 2026-06-01
**Status:** approved

## Overview

Redesign the PromptInput component to move action buttons inside the input card, and redesign the ModelSelector dropdown from horizontal provider pills to a vertical list with slide-out sub-overlays for models.

## 1. PromptInput Layout

### Current
- Toolbar sits **above** the card with + upload button, divider, and Model button with "Model" text
- Generate button on the right
- Typing animation overlays textarea

### New Layout
Single unified card containing everything:

```
┌─────────────────────────────────────────────┐
│  Typing animation (top, left-aligned)        │
│                                              │
│  [textarea — taller, fills the space]        │
│                                              │
│  [+ upload]  [✦ model icon]      [Generate]  │
│  └─ bottom-left ──────────┘  └─ bottom-right┘
└─────────────────────────────────────────────┘
```

- **+ button**: icon only, positioned bottom-left inside the card
- **Model button**: icon only (no text label "Model"), next to + button
- **Generate button**: stays bottom-right
- **Typing animation**: positioned at top of textarea area, padded so it doesn't touch buttons
- **Card is taller**: more vertical padding, larger default textarea height
- Upload & model buttons are smaller (28-30px), sitting in the bottom-left corner

## 2. ModelSelector Dropdown Redesign

### Current
- Horizontal provider pills at top row
- Divider
- Model list below with header "● ProviderName models"

### New Layout
Vertical provider list with right-side sub-overlay:

```
┌──────────────────┐  ┌──────────────────┐
│  Anthropic  ─────│──│▸  ● Anthropic     │
│  OpenAI           │  │   models          │
│  Google           │  │                   │
│                  │  │   Claude Opus 4    │
│                  │  │   Claude Sonnet 4  │
│                  │  │   Claude Haiku 4   │
└──────────────────┘  └──────────────────┘
   main dropdown       sub-overlay (slides right)
```

- Providers listed **vertically**, each taking full dropdown width
- Each row: logo + provider name + subtle chevron (▸)
- Hovered provider gets brand-color accent + background highlight
- On hover, a **sub-overlay slides out from the right side**, showing that provider's models
- Sub-overlay has header with provider dot + name, then model list below
- Sub-overlay is positioned absolutely to the right of the main dropdown
- Model items behave same as current: clickable, show checkmark if selected

### Behavior
- Mouse enter on provider row → clear any close timer, show sub-overlay with models
- Mouse leave from entire dropdown → delayed close (150ms)
- Click model → select it, close dropdown
- Sub-overlay slides in/out with framer-motion animations (fade + slide from right)

## 3. Dashboard Model Button

- Icon only (same cube/hexagon SVG), positioned inside input box per layout above
- On click → opens same redesigned dropdown
- Only shows user's activated providers (already filtered for `page="dashboard"`)
- If no activated providers → button is hidden

## 4. Landing Page

- HeroSection passes `page="landing"` — shows Anthropic, OpenAI, Google providers
- Dropdown shows all three with their system default models

## 5. Files to Change

| File | Changes |
|------|---------|
| `src/components/PromptInput/PromptInput.tsx` | Remove toolbar, move + and model button inside card, remove text from model button |
| `src/components/PromptInput/PromptInput.module.css` | New unified card layout, bottom button bar, larger textarea |
| `src/components/ModelSelector/ModelSelector.tsx` | Vertical provider layout, sub-overlay on hover, icon-only trigger option |
| `src/components/ModelSelector/ModelSelector.module.css` | Vertical provider rows, sub-overlay positioning, animations |

## 6. Non-Goals

- Not changing the data fetching logic
- Not changing the submit/generate behavior
- Not changing the HeroSection structure
- Not changing the DashboardPage layout (only the PromptInput inside it)
