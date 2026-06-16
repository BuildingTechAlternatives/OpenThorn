// Source: claude-plugins-official/ui-ux-pro-max skill (full version)
const body = `# UI/UX Pro Max — Design Intelligence

Comprehensive design guide for web and mobile applications. Contains 50+ styles, 161 color palettes, 57 font pairings, 161 product types with reasoning rules, 99 UX guidelines, and 25 chart types. Priority-based recommendations across all major domains.

## When to Apply

Use when the task involves **UI structure, visual design decisions, interaction patterns, or user experience quality control**:
- Designing new pages (Landing Page, Dashboard, Admin, SaaS, E-commerce)
- Creating or refactoring UI components (buttons, modals, forms, tables, charts)
- Choosing color schemes, typography systems, spacing standards, or layout systems
- Reviewing UI code for UX, accessibility, or visual consistency
- Implementing navigation structures, animations, or responsive behavior
- Making product-level design decisions (style, information hierarchy, brand expression)
- Improving perceived quality, clarity, or usability of interfaces

Skip only for: pure backend logic, API/database design, infrastructure/DevOps, non-visual automation.

## Rule Categories by Priority

| Priority | Category | Impact | Key Checks | Anti-Patterns |
|----------|----------|--------|------------|---------------|
| 1 | Accessibility | CRITICAL | Contrast 4.5:1, alt text, keyboard nav, aria-labels | Removing focus rings, icon-only buttons without labels |
| 2 | Touch & Interaction | CRITICAL | Min 44×44px, 8px+ spacing, loading feedback | Hover-only interactions, instant state changes (0ms) |
| 3 | Performance | HIGH | WebP/AVIF, lazy loading, reserve space (CLS < 0.1) | Layout thrashing, Cumulative Layout Shift |
| 4 | Style Selection | HIGH | Match product type, consistency, SVG icons (no emoji) | Mixing flat & skeuomorphic randomly, emoji as icons |
| 5 | Layout & Responsive | HIGH | Mobile-first breakpoints, viewport meta, no horizontal scroll | Horizontal scroll, fixed px container widths, disable zoom |
| 6 | Typography & Color | MEDIUM | Base 16px, line-height 1.5, semantic color tokens | Text < 12px body, gray-on-gray, raw hex in components |
| 7 | Animation | MEDIUM | 150–300ms, motion conveys meaning, spatial continuity | Decorative-only animation, animating width/height, no reduced-motion |
| 8 | Forms & Feedback | MEDIUM | Visible labels, error near field, helper text, progressive disclosure | Placeholder-only label, errors only at top, overwhelm upfront |
| 9 | Navigation Patterns | HIGH | Predictable back, breadcrumbs on deep hierarchies, deep linking | Overloaded nav, broken back behavior, no deep links |
| 10 | Charts & Data | LOW | Legends, tooltips, accessible colors | Relying on color alone to convey meaning |

---

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
- **dynamic-type** — support system text scaling; avoid truncation as text grows
- **voiceover-sr** — meaningful aria labels/hints; logical reading order for screen readers
- **escape-routes** — provide cancel/back in modals and multi-step flows
- **keyboard-shortcuts** — preserve system and a11y shortcuts; offer keyboard alternatives for drag-and-drop

## §2 Touch & Interaction (CRITICAL)

- **touch-target-size** — min 44×44px interactive area; extend hit area beyond visual bounds if needed
- **touch-spacing** — minimum 8px gap between interactive elements
- **hover-vs-tap** — use click/tap for primary interactions; don't rely on hover alone
- **loading-buttons** — disable button during async operations; show spinner or "Loading…"
- **error-feedback** — clear error messages near the problem element
- **cursor-pointer** — \`cursor: pointer\` on all clickable non-button elements
- **tap-delay** — use \`touch-action: manipulation\` to eliminate 300ms tap delay on mobile
- **press-feedback** — visual feedback on press within 80–150ms
- **gesture-alternative** — don't rely on gesture-only interactions; always provide visible controls for critical actions
- **no-precision-required** — avoid requiring pixel-perfect taps on small icons or thin edges

## §3 Performance (HIGH)

- **image-optimization** — use WebP/AVIF, responsive images (srcset/sizes), lazy load non-critical assets
- **image-dimension** — declare width/height or use aspect-ratio to prevent layout shift (CLS)
- **font-loading** — use \`font-display: swap\` to avoid invisible text (FOIT); reserve space to reduce layout shift
- **font-preload** — preload only critical fonts; avoid overusing preload on every variant
- **critical-css** — prioritize above-the-fold CSS (inline critical CSS or early-loaded stylesheet)
- **lazy-loading** — lazy load non-hero components via dynamic import / route-level splitting
- **bundle-splitting** — split code by route/feature to reduce initial load and TTI
- **third-party-scripts** — load third-party scripts async/defer; audit and remove unnecessary ones
- **reduce-reflows** — avoid frequent layout reads/writes; batch DOM reads then writes
- **content-jumping** — reserve space for async content to avoid layout jumps (CLS)
- **virtualize-lists** — virtualize lists with 50+ items for memory efficiency and scroll performance
- **main-thread-budget** — keep per-frame work under ~16ms for 60fps
- **progressive-loading** — use skeleton screens / shimmer instead of long blocking spinners for >1s operations
- **input-latency** — keep input latency under ~100ms for taps/scrolls
- **debounce-throttle** — use debounce/throttle for high-frequency events (scroll, resize, input)
- **offline-support** — provide offline state messaging and basic fallback

## §4 Style Selection (HIGH)

- **style-match** — match style to product: SaaS→clean/minimal, portfolio→editorial, e-commerce→warm, gaming→bold/dark, fintech→trustworthy
- **consistency** — same visual style across all pages; don't mix glass + flat + clay
- **no-emoji-icons** — use SVG icons (Lucide, Heroicons, Phosphor), not emojis
- **effects-match-style** — shadows, blur, border-radius aligned with chosen style
- **state-clarity** — hover/pressed/disabled states visually distinct while staying on-style
- **elevation-consistent** — consistent shadow scale for cards/modals; no random shadow values
- **dark-mode-pairing** — dark mode uses desaturated tonal variants, not inverted colors
- **icon-style-consistent** — one icon set/stroke weight across the product
- **primary-action** — one primary CTA per screen; secondary actions visually subordinate
- **blur-purpose** — use blur to indicate background dismissal (modals, sheets), not as decoration

## §5 Layout & Responsive (HIGH)

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
- **fixed-element-offset** — fixed navbar/bottom bar must reserve safe padding for underlying content
- **scroll-behavior** — avoid nested scroll regions that interfere with the main scroll experience
- **orientation-support** — keep layout readable and operable in landscape mode
- **content-priority** — show core content first on mobile; fold or hide secondary content

## §6 Typography & Color (MEDIUM)

- **line-height** — 1.5–1.75 for body text; 1.1–1.3 for headings
- **font-scale** — consistent type scale (e.g. 12/14/16/20/24/32/48px)
- **font-pairing** — match heading and body personalities; avoid Inter/Roboto/Arial for distinctive work
- **weight-hierarchy** — Bold headings (600–700), Regular body (400), Medium labels (500)
- **color-semantic** — CSS custom properties (--color-primary, --color-error, --color-surface), not raw hex in components
- **color-dark-mode** — test dark mode contrast independently; desaturated tonal variants only
- **color-accessible-pairs** — every foreground/background pair must meet 4.5:1 (WCAG AA)
- **color-not-decorative-only** — functional color (error red) must also use icon/text
- **whitespace-balance** — intentional whitespace to group items; avoid clutter and over-padding
- **number-tabular** — monospaced figures for prices, data columns, timers
- **truncation-strategy** — prefer wrapping over truncation; when truncating use ellipsis + tooltip with full text
- **letter-spacing** — avoid tight tracking on body text; respect natural letterfit

## §7 Animation (MEDIUM)

- **duration-timing** — 150–300ms for micro-interactions; ≤400ms for complex; never >500ms
- **transform-performance** — animate \`transform\` and \`opacity\` only; never width/height/top/left
- **easing** — \`ease-out\` entering; \`ease-in\` exiting; never \`linear\` for UI transitions
- **motion-meaning** — every animation expresses cause-effect; no purely decorative motion
- **exit-faster-than-enter** — exit ~65% of enter duration (feels more responsive)
- **stagger-sequence** — stagger list/grid entrances 30–50ms apart; not all-at-once
- **spring-physics** — spring curves for natural feel over rigid cubic-bezier
- **loading-states** — skeleton/shimmer when loading >300ms; never blank-then-pop
- **reduced-motion** — \`@media (prefers-reduced-motion: no-preference) { ... }\` around all animations
- **no-blocking-animation** — never block user input during animation
- **interruptible** — animations must be interruptible by user tap/gesture immediately
- **state-transition** — state changes (hover/active/expanded) should animate smoothly, not snap
- **scale-feedback** — subtle scale (0.95–1.05) on press for tappable cards/buttons
- **layout-shift-avoid** — animations must not cause layout reflow; use transform for position changes

## §8 Forms & Feedback (MEDIUM)

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
- **required-indicators** — mark required fields (asterisk + screen-reader text)
- **input-type-keyboard** — use semantic input types (email, tel, number) to trigger correct mobile keyboard
- **password-toggle** — provide show/hide toggle for password fields
- **autofill-support** — use autocomplete attributes so the system can autofill
- **undo-support** — allow undo for destructive or bulk actions ("Undo delete" toast)
- **success-feedback** — confirm completed actions with brief visual feedback (checkmark, toast, color flash)
- **error-recovery** — error messages must include a clear recovery path (retry, edit, help link)
- **multi-step-progress** — multi-step flows show step indicator or progress bar; allow back navigation
- **disabled-states** — disabled elements use reduced opacity (0.38–0.5) + cursor change + semantic attribute
- **toast-dismiss** — auto-dismiss toasts in 3–5s; accessible via aria-live="polite"
- **destructive-emphasis** — destructive actions use danger color (red) and are visually separated from primary actions

## §9 Navigation Patterns (HIGH)

- **back-behavior** — predictable and consistent; preserves scroll position and state
- **nav-state-active** — current location visually highlighted in navigation
- **nav-label-icon** — navigation items have both icon and text label; icon-only nav harms discoverability
- **breadcrumb-web** — breadcrumbs for hierarchies 3+ levels deep
- **modal-escape** — modals have clear close affordance (× button + Escape key); dismiss on backdrop click
- **adaptive-navigation** — ≥1024px: sidebar; <1024px: top/bottom nav
- **focus-on-route-change** — move focus to main content after page transition (screen readers)
- **navigation-consistency** — navigation placement identical across all pages
- **deep-linking** — all key screens must be reachable via URL for sharing
- **search-accessible** — search easily reachable (top bar or prominent); provide recent/suggested queries
- **state-preservation** — navigating back restores previous scroll position, filter state, and input
- **nav-hierarchy** — primary nav vs secondary nav (drawer/settings) must be clearly separated
- **persistent-nav** — core navigation must remain reachable from deep pages; don't hide in sub-flows
- **avoid-mixed-patterns** — don't mix Tab + Sidebar + Bottom Nav at the same hierarchy level
- **modal-vs-navigation** — modals must not be used for primary navigation flows; they break the user's path

## §10 Charts & Data (LOW)

- **chart-type** — match chart type to data: trend → line, comparison → bar, proportion → pie/donut (max 5 segments)
- **color-guidance** — accessible palettes; avoid red/green-only pairs for colorblind users
- **data-table** — provide table alternative for accessibility; charts alone aren't screen-reader friendly
- **pattern-texture** — supplement color with patterns/shapes so data is distinguishable without color
- **legend-visible** — always show legend near the chart, not detached below a scroll fold
- **tooltip-on-interact** — show tooltips on hover (web) or tap (mobile) with exact values
- **axis-labels** — label axes with units and readable scale; avoid truncated or rotated labels on mobile
- **responsive-chart** — charts reflow or simplify on small screens
- **empty-data-state** — meaningful empty state ("No data yet" + guidance), not a blank chart
- **loading-chart** — skeleton/shimmer while chart data loads; not empty axis frame
- **animation-optional** — chart entrance animations must respect prefers-reduced-motion
- **no-pie-overuse** — avoid pie/donut for >5 categories; switch to bar chart for clarity
- **tooltip-keyboard** — tooltip content must be keyboard-reachable, not hover-only
- **sortable-table** — data tables support sorting with aria-sort indicating current state
- **gridline-subtle** — grid lines should be low-contrast (gray-100/200) so they don't compete with data

---

## Icons & Visual Elements

| Rule | Do | Avoid |
|------|----|----|
| **No emoji as icons** | SVG icons (Lucide, Heroicons, Phosphor) | 🎨 🚀 ⚙️ in navigation or system controls |
| **Vector-only assets** | SVG icons that scale and support theming | Raster PNG icons that blur at high DPI |
| **Consistent icon set** | One family, one stroke weight | Mixing outline + filled icons at the same level |
| **Stable interaction states** | Opacity/color/elevation transitions | Layout-shifting transforms that move surrounding content |
| **Consistent icon sizing** | Design tokens (icon-sm=16px, icon-md=24px, icon-lg=32px) | Mixing 20/24/28px arbitrarily |
| **Icon contrast** | 4.5:1 for small, 3:1 minimum for larger UI glyphs | Low-contrast icons blending into background |

## Layout & Spacing Rules

| Rule | Do | Don't |
|------|----|----|
| **8px spacing rhythm** | 4/8/12/16/24/32/48/64px consistent spacing | Random spacing increments with no rhythm |
| **Container width** | Consistent max-width per breakpoint | Mixing arbitrary widths between pages |
| **Readable text measure** | Max-w for prose to keep line length under 75 chars | Full-width paragraphs on widescreen that hurt readability |
| **Section spacing hierarchy** | Tiers: 16/24/32/48px by content importance | Same spacing for all sections regardless of hierarchy |

## Light/Dark Mode

| Rule | Do | Don't |
|------|----|----|
| **Semantic tokens** | CSS custom properties mapped per theme | Hardcoded hex values per component |
| **Text contrast (light)** | Body text ≥4.5:1 against light surfaces | Low-contrast gray body text |
| **Text contrast (dark)** | Primary ≥4.5:1, secondary ≥3:1 on dark surfaces | Dark mode text that blends into background |
| **Border visibility** | Separators visible in both themes | Theme-specific borders disappearing in one mode |
| **State contrast parity** | Pressed/focused/disabled states equally distinguishable in both themes | Defining interaction states for one theme only |
| **Scrim legibility** | Modal scrim 40–60% black opacity | Weak scrim leaving background competing with foreground |

---

## Pre-Delivery Checklist

### Visual Quality
- [ ] No emojis used as icons (SVG only)
- [ ] All icons come from a consistent family and stroke weight
- [ ] Semantic theme tokens used consistently (no ad-hoc hardcoded colors)
- [ ] Pressed-state visuals do not shift layout bounds or cause jitter

### Interaction
- [ ] All tappable elements provide clear pressed feedback
- [ ] Touch targets meet minimum size (≥44×44px)
- [ ] Micro-interaction timing stays in the 150–300ms range
- [ ] Disabled states are visually clear and non-interactive
- [ ] Screen reader labels are descriptive and logical

### Light/Dark Mode
- [ ] Primary text contrast ≥4.5:1 in both modes
- [ ] Secondary text contrast ≥3:1 in both modes
- [ ] Dividers/borders and interaction states visible in both modes
- [ ] Both themes tested before delivery

### Layout
- [ ] No horizontal scroll on mobile
- [ ] Content not hidden behind fixed/sticky bars
- [ ] 4/8px spacing rhythm maintained
- [ ] Long-form text measure readable on larger viewports

### Accessibility
- [ ] All meaningful images/icons have accessible labels
- [ ] Form fields have labels, hints, and clear error messages
- [ ] Color is not the only indicator of meaning
- [ ] Reduced motion respected (animations gated behind prefers-reduced-motion)
- [ ] Focus order matches visual order
`

export default body
