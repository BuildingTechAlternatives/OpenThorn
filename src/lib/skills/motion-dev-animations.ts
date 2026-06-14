// Source: github.com/199-biotechnologies/motion-dev-animations-skill (MIT)
const body = `# Motion Dev Animations

> **Motion.dev** — 10M+ downloads/month, successor to Framer Motion. \`npm install motion\`

## When to Use

✅ React 19+/Next.js 15+/Svelte 5+/Astro 4+ animation implementation
✅ Scroll effects (parallax, reveal), gestures (hover, drag, tap), layout animations
✅ Hero sections, cards, micro-interactions requiring 60fps+ performance
❌ CSS-only transitions (use native \`transition\` property instead)
❌ Vue projects (use \`motion-v\` package — different API)
❌ Complex SVG/Canvas animations (GSAP is better suited)

## Animation Pattern Decision Tree

\`\`\`
What should animate?

├─ ENTRANCE (page load, mount)
│   → initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}}
│   → duration: 0.6–0.8s, ease: [0.22, 1, 0.36, 1]
│   → stagger: 0.1–0.2s between elements
│
├─ GESTURE (hover, tap, drag)
│   → whileHover={{scale: 1.05}}, whileTap={{scale: 0.95}}
│   → Spring physics (stiffness: 300–400, damping: 20)
│   → Instant response (no duration on spring)
│
├─ SCROLL (reveal, parallax)
│   → whileInView + viewport={{once: true, amount: 0.3}}
│   → OR useScroll + useTransform for parallax
│   → transform/opacity only for performance
│
└─ LAYOUT (reorder, expand, shared element)
    → layout prop (auto FLIP animation)
    → layoutId="id" for shared element morphing between screens
\`\`\`

## API Quick Reference

| Component/Hook | Usage | When |
|----------------|-------|------|
| \`motion.div\` | \`<motion.div animate={{x: 100}}>\` | Basic animations |
| \`whileHover\` | \`whileHover={{scale: 1.05}}\` | Hover states (0.2–0.3s) |
| \`whileTap\` | \`whileTap={{scale: 0.95}}\` | Click feedback |
| \`whileInView\` | \`whileInView={{opacity: 1}}\` | Scroll reveal |
| \`drag\` | \`drag="x"\` + \`dragConstraints\` | Draggable elements |
| \`layout\` | \`<motion.div layout />\` | Auto FLIP animation |
| \`layoutId\` | \`layoutId="hero"\` | Shared element transitions |
| \`useScroll\` | Track scroll progress | Parallax, progress bars |
| \`useTransform\` | Map scroll values | Scroll-linked effects |
| \`useSpring\` | Spring physics on a value | Smooth follower effects |
| \`AnimatePresence\` | Wrap conditional renders | Exit animations |

## Import

\`\`\`tsx
// React / Next.js
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from 'motion/react'
\`\`\`

## Common Patterns (copy-paste ready)

\`\`\`tsx
// Fade up entrance
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
/>

// Hover card lift
<motion.div
  whileHover={{ y: -8, boxShadow: "0 20px 40px rgba(0,0,0,0.12)" }}
  transition={{ type: "spring", stiffness: 300, damping: 20 }}
/>

// Scroll reveal
<motion.div
  initial={{ opacity: 0, y: 50 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.3 }}
/>

// Staggered list
const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
}
const item = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }
<motion.ul variants={container} initial="hidden" animate="visible">
  {items.map(i => <motion.li key={i} variants={item}>{i}</motion.li>)}
</motion.ul>

// Exit animation
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    />
  )}
</AnimatePresence>

// Tab indicator (shared layout)
{tabs.map(tab => (
  <button key={tab} onClick={() => setActive(tab)} style={{ position: 'relative' }}>
    {tab}
    {active === tab && (
      <motion.div
        layoutId="tab-indicator"
        style={{ position: 'absolute', inset: 0, background: 'var(--color-accent)', borderRadius: 6, zIndex: -1 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />
    )}
  </button>
))}
\`\`\`

## Quality Standards

| Category | Requirement |
|----------|-------------|
| Performance | ≥60fps — animate \`transform\`/\`opacity\` only; never width/height/top/left |
| Bundle | motion adds ~30–50KB; worth it for spring physics and FLIP |
| Accessibility | Always wrap in \`@media (prefers-reduced-motion: no-preference)\` or check via \`useReducedMotion()\` |
| Exit timing | ~65% of enter duration (feels more responsive) |
| Spring feel | stiffness 300–400, damping 20 for snappy; lower stiffness for bouncier |

## Design Principles

- **Purposeful** — every animation serves a function: reveals hierarchy, confirms action, guides attention
- **Natural physics** — prefer spring transitions over tween; avoid linear easing for UI
- **Elegant restraint** — 1–2 animated elements per view; staggered reveals beat simultaneous motion
- **Accessible** — always support \`prefers-reduced-motion\`; provide instant fallback`

export default body
