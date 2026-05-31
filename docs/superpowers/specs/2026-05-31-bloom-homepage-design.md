# Bloom Homepage Design Spec

**Date**: 2026-05-31
**Status**: Approved
**Design Direction**: Organic Modern

---

## Overview

Build the Bloom marketing homepage — a BYOK (Bring Your Own Key) AI website builder. The page communicates Bloom's value proposition through a warm, organic-modern aesthetic centered on a purple/blue flower brand identity.

---

## Visual Design System

### Color Palette

| Token | Hex | Role |
|-------|-----|------|
| Bloom Primary | `#7C3AED` | Primary buttons, accents, active states |
| Bloom Deep | `#4C1D95` | Headings, strong emphasis |
| Bloom Petal Blue | `#6366F1` | Secondary accent, links, icon highlights |
| Surface Warm | `#FCFAF7` | Page background — warm off-white |
| Surface Card | `#FFFFFF` | Cards, elevated surfaces |
| Surface Muted | `#F5F0EB` | Subtle section backgrounds |
| Ink | `#1A1225` | Body text — deep warm charcoal |
| Ink Soft | `#6B6278` | Secondary text, captions |
| Border Subtle | `#E8E0D8` | Card borders, dividers |
| Success Mint | `#10B981` | Success states, trust badges |
| Glow | `rgba(124, 58, 237, 0.15)` | Gradient glows, hover halos |

### Typography

| Token | Font | Weight |
|-------|------|--------|
| Display | Fraunces (Google Fonts) | 700–800 |
| Body | DM Sans (Google Fonts) | 400–500 |
| Mono | JetBrains Mono | 400 |

- **Hero headline**: 72px/1.05, clamped to 48px on mobile
- **Section headers**: 40px/1.15
- **Body text**: 18px/1.6
- **Input text**: 16px

### Effects

- Background: Warm white with subtle radial purple glow (top-right)
- Cards: White + 1px warm border + soft shadow, hover lifts 4-6px with purple halo
- Input: rounded-2xl, subtle inner glow on focus
- Buttons: Gradient from Bloom Primary → Petal Blue, spring-scale on hover
- Decorative: Low-opacity organic blob shapes as background elements

### Motion Strategy

- Hero: Staggered reveal (headline → subtitle → input → trust bar, 50ms delays)
- Scroll reveals: Fade-slide-up on viewport entry
- Input focus: Scale 1.01 + glow expansion (spring physics)
- Meet Bloom: Cards stagger 150ms, connector lines draw on scroll (SVG stroke-dashoffset), icons float gently
- Hover: Buttons lift 2px, cards lift 6px with shadow deepen
- All animations respect `prefers-reduced-motion` → collapse to opacity fades

---

## Page Sections

### 1. Header

Fixed glass-morphism header with backdrop-blur:
- Left: Bloom logo + flower icon
- Nav: Solutions▾ (For Designers, For Developers, For Startups, For Agencies), GitHub, Resources▾ (Documentation, API Reference, Templates, Blog)
- Right: "Login" (ghost text) + "Get Started" (purple gradient pill)
- Semi-transparent background, content scrolls behind

### 2. Hero Section

- **Headline**: "Build with Bloom" — Fraunces 800, ~72px, deep purple (#4C1D95)
- **Subtitle**: "Create beautiful websites just by talking to AI. No coding required." — DM Sans 400, 20px, Ink Soft
- **Input Box**: Large rounded-2xl white card with:
  - Sparkle icon (left) + paperclip icon (right)
  - Placeholder: "Describe the app or website you want to create..."
  - "Build" gradient button inside, overlapping card edge
  - Text-shimmer animation on placeholder
- **Trust Bar**: Three pills below input — "Configure your own API keys", "No hidden costs, no ads", "Full control, full privacy" — each with icon

### 3. Meet Bloom Section

Section title "✦ Meet Bloom ✦" centered.

Three-step horizontal flow with animated connectors:

| Step 1: Start with an idea | Step 2: Watch it come to life | Step 3: Refine and ship |
|---|---|---|
| Describe the app or website you want to create or drop in screenshots and docs | See your vision transform into a working prototype in real-time as AI builds it for you | Iterate on your creation with simple feedback and deploy it to the world with one click |

- Cards enter with fade-up + 2deg→0 rotation, staggered 150ms
- SVG connector arrows between steps animate stroke-dashoffset on scroll
- Icons float gently with different delays
- Hover: card lifts 6px, icon scales 1.15, purple glow behind icon

### 4. BYOK Detail Section

- Warm muted background (#F5F0EB)
- Heading: "Your Keys, Your Control"
- Body: Explains BYOK model — configure OpenAI/Anthropic/Google keys, pay only for what you use, no platform markup
- Three feature cards: "Bring your own API keys", "Zero platform markup", "Full data privacy"
- Subtle market positioning mention

### 5. Bottom CTA Section

- "Ready to build something great?"
- Same input box design as hero (slightly smaller)
- Direct call to action button

### 6. Footer

- Dark background (#1A1225 ink)
- Single row: Logo + "Build with AI. Ship with confidence." + link columns + social
- Clean and minimal

---

## Technical Decisions

### Stack
- **React + TypeScript** (matching existing project structure from prior commits)
- **CSS Modules** for component-scoped styling
- **Framer Motion** for animations (already in project history)

### Component Tree
```
HomePage
├── Header
│   ├── Logo
│   ├── NavLink (Solutions, GitHub, Resources)
│   ├── SolutionsDropdown
│   ├── ResourcesDropdown
│   └── AuthButtons (Login, Get Started)
├── HeroSection
│   ├── HeroHeadline
│   ├── HeroSubtitle
│   ├── PromptInput
│   └── TrustBar
├── MeetBloomSection
│   ├── SectionHeader
│   ├── StepCard × 3
│   └── ConnectorArrows (SVG)
├── BYOKSection
│   ├── SectionHeader
│   ├── FeatureCard × 3
│   └── BYOKBody
├── BottomCTASection
│   └── PromptInput
└── Footer
    ├── Logo
    ├── LinkColumn × 3
    └── SocialLinks
```

### States Per Component
- **Header**: Default, scrolled (adds subtle border), dropdown open
- **PromptInput**: Default, focused, typing, loading, error, disabled
- **StepCard**: Default, hovered, in-view (animation trigger)
- **Buttons**: Default, hover, active/pressed, loading, disabled
- **TrustBar pills**: Default, hover

### Accessibility
- All icons have aria-labels
- Focus rings visible (2-4px, purple, high contrast)
- Keyboard navigable dropdown menus
- Skip-to-content link
- Respect prefers-reduced-motion
- Heading hierarchy: h1 (hero) → h2 (sections) → h3 (cards)
- Touch targets ≥ 44x44px
- Color contrast ≥ 4.5:1 for all body text

### Responsive Breakpoints
- Mobile: 375px+
- Tablet: 768px+
- Desktop: 1024px+
- Wide: 1440px+ (max-width container)

### Performance
- Google Fonts with display:swap
- CSS animations use transform/opacity only
- Lazy-load below-fold content
- WebP images where possible

---

## Scope Boundaries

### In Scope (This Implementation)
- Full homepage with all 6 sections
- Responsive layout (mobile → desktop)
- All animations and interactions
- Dropdown menus (Solutions, Resources)
- Glass-morphism header
- Animated Meet Bloom connector lines
- Trust badges and BYOK messaging
- Footer

### Out of Scope (Future)
- Authentication pages (Login, Sign Up)
- Settings/API key configuration page
- Actual chat/agent functionality
- Preview/rendering system
- Documentation, Templates, Blog pages
- GitHub integration
