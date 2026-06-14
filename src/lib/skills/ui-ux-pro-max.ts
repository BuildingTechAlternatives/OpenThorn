// Source: github.com/nextlevelbuilder/ui-ux-pro-max-skill (MIT)
// Trimmed: removed §3 Performance (separate skill), §10 Charts,
// Python script workflows, and iOS/Android-only app rules.
const body = `# UI/UX Pro Max — Design Intelligence

## Rule Priority

| Priority | Category | Impact | Key Checks | Anti-Patterns |
|----------|----------|--------|------------|---------------|
| 1 | Accessibility | CRITICAL | Contrast 4.5:1, alt text, keyboard nav, aria-labels | Removing focus rings, icon-only buttons without labels |
| 2 | Touch & Interaction | CRITICAL | Min 44×44px, 8px spacing, loading feedback | Hover-only interactions, instant state changes |
| 3 | Style Selection | HIGH | Match product type, consistency, SVG icons | Mixing styles randomly, emoji as icons |
| 4 | Layout & Responsive | HIGH | Mobile-first, no horizontal scroll, viewport meta | Fixed px containers, disabled zoom |
| 5 | Typography & Color | MEDIUM | Base 16px, line-height 1.5, semantic tokens | Text <12px body, gray-on-gray, raw hex in components |
| 6 | Animation | MEDIUM | 150–300ms, transform/opacity only, reduced-motion | Decorative-only, animating width/height |
| 7 | Forms & Feedback | MEDIUM | Visible labels, error near field, progressive disclosure | Placeholder-only labels, errors only at top |
| 8 | Navigation | HIGH | Predictable back, breadcrumbs on deep hierarchies | Overloaded nav, broken back behavior |

## §1 Accessibility (CRITICAL)

- **color-contrast** — min 4.5:1 for normal text, 3:1 for large text (18px+ bold or 24px+ regular)
- **focus-states** — visible focus rings on all interactive elements (2–4px outline); never \`outline: none\` without a replacement
- **alt-text** — descriptive alt for meaningful images; \`aria-hidden\` for decorative ones
- **aria-labels** — \`aria-label\` for icon-only buttons; never a clickable \`<div>\` without a role
- **keyboard-nav** — tab order matches visual order; every action reachable by keyboard alone
- **form-labels** — every \`<input>\`, \`<select>\`, \`<textarea>\` needs an associated \`<label>\`
- **heading-hierarchy** — sequential h1→h6, no skipped levels
- **color-not-only** — don't convey information by color alone; add icon or text
- **reduced-motion** — wrap animations in \`@media (prefers-reduced-motion: no-preference)\`
- **skip-links** — "Skip to main content" as first focusable element on complex pages

## §2 Touch & Interaction (web-relevant rules)

- **touch-target-size** — min 44×44px interactive area; extend hit area beyond visual bounds if needed
- **touch-spacing** — minimum 8px gap between interactive elements
- **loading-buttons** — disable button during async operations; show spinner or "Loading…"
- **error-feedback** — clear error messages near the problem element
- **cursor-pointer** — \`cursor: pointer\` on all clickable non-button elements
- **tap-delay** — use \`touch-action: manipulation\` to eliminate 300ms tap delay on mobile

## §3 Style Selection (HIGH)

- **style-match** — match style to product: SaaS→clean/minimal, portfolio→editorial, e-commerce→warm, gaming→bold/dark
- **consistency** — same visual style across all pages; don't mix glass + flat + clay
- **no-emoji-icons** — use SVG icons (Lucide, Heroicons), not emojis
- **effects-match-style** — shadows, blur, border-radius aligned with chosen style
- **state-clarity** — hover/pressed/disabled states visually distinct while staying on-style
- **elevation-consistent** — consistent shadow scale for cards/modals; no random shadow values
- **dark-mode-pairing** — dark mode uses desaturated tonal variants, not inverted colors
- **icon-style-consistent** — one icon set/stroke weight across the product
- **primary-action** — one primary CTA per screen; secondary actions visually subordinate

## §4 Layout & Responsive (HIGH)

- **viewport-meta** — \`width=device-width, initial-scale=1\`; never disable zoom
- **mobile-first** — design 390px first, scale up to 768px and 1280px+
- **breakpoint-consistency** — systematic breakpoints: 390 / 768 / 1024 / 1440
- **readable-font-size** — minimum 16px body on mobile (prevents iOS auto-zoom)
- **line-length-control** — 35–60 chars/line on mobile; 60–75 on desktop
- **horizontal-scroll** — no horizontal scroll on mobile
- **spacing-scale** — 4/8/12/16/24/32/48/64px system; no arbitrary values
- **container-width** — consistent max-width on desktop (e.g. 1200px / \`max-w-6xl\`)
- **z-index-management** — explicit z-index scale (0 / 10 / 20 / 40 / 100 / 1000)
- **viewport-units** — prefer \`min-h-dvh\` over \`100vh\` on mobile
- **visual-hierarchy** — hierarchy via size, spacing, contrast — not color alone

## §5 Typography & Color (MEDIUM)

- **line-height** — 1.5–1.75 for body text; 1.1–1.3 for headings
- **font-scale** — consistent type scale (e.g. 12/14/16/20/24/32/48px)
- **font-pairing** — match heading and body personalities; avoid Inter/Roboto/Arial for distinctive work
- **weight-hierarchy** — Bold headings (600–700), Regular body (400), Medium labels (500)
- **color-semantic** — CSS custom properties (--color-primary, --color-error, --color-surface), not raw hex
- **color-dark-mode** — test dark mode contrast independently; desaturated tonal variants only
- **color-accessible-pairs** — every foreground/background pair must meet 4.5:1 (WCAG AA)
- **color-not-decorative-only** — functional color (error red) must also use icon/text
- **whitespace-balance** — intentional whitespace to group items; avoid clutter and over-padding
- **number-tabular** — monospaced figures for prices, data columns, timers

## §6 Animation (MEDIUM)

- **duration-timing** — 150–300ms for micro-interactions; ≤400ms for complex; never >500ms
- **transform-performance** — animate \`transform\` and \`opacity\` only; never width/height/top/left
- **easing** — \`ease-out\` entering; \`ease-in\` exiting; never \`linear\` for UI transitions
- **motion-meaning** — every animation expresses cause-effect; no purely decorative motion
- **exit-faster-than-enter** — exit ~65% of enter duration (feels more responsive)
- **stagger-sequence** — stagger list/grid entrances 30–50ms apart; not all-at-once
- **spring-physics** — spring curves for natural feel (stiffness 300–400, damping 20)
- **loading-states** — skeleton/shimmer when loading >300ms; never blank-then-pop
- **reduced-motion** — \`@media (prefers-reduced-motion: no-preference) { ... }\` around all animations
- **no-blocking-animation** — never block user input during animation

## §7 Forms & Feedback (MEDIUM)

- **input-labels** — visible \`<label>\` per input; never placeholder-only
- **error-placement** — error message directly below the offending field
- **inline-validation** — validate on blur, not on every keystroke
- **submit-feedback** — loading → success/error state on submit; disable button while pending
- **progressive-disclosure** — reveal complex options progressively; don't overwhelm upfront
- **empty-states** — helpful message + action when no content exists
- **confirmation-dialogs** — confirm before destructive actions (delete, overwrite)
- **focus-management** — after submit error, auto-focus first invalid field
- **error-clarity** — error messages state cause + how to fix; not just "Invalid input"
- **touch-friendly-input** — mobile input height ≥44px

## §8 Navigation (HIGH)

- **back-behavior** — predictable and consistent; preserves scroll position and state
- **nav-state-active** — current location visually highlighted in navigation
- **nav-label-icon** — navigation items have both icon and text label
- **breadcrumb-web** — breadcrumbs for hierarchies 3+ levels deep
- **modal-escape** — modals have clear close affordance (× button + Escape key)
- **adaptive-navigation** — ≥1024px: sidebar; <1024px: top/bottom nav
- **focus-on-route-change** — move focus to main content after page transition (screen readers)
- **navigation-consistency** — navigation placement identical across all pages`

export default body
