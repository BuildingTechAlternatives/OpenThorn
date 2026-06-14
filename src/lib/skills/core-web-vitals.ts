// Source: github.com/addyosmani/web-quality-skills (MIT)
const body = `# Core Web Vitals

| Metric | Measures | Good | Poor |
|--------|----------|------|------|
| **LCP** | Loading | ≤ 2.5s | > 4s |
| **INP** | Interactivity | ≤ 200ms | > 500ms |
| **CLS** | Visual Stability | ≤ 0.1 | > 0.25 |

Google measures at the **75th percentile** of all page visits.

## LCP — Largest Contentful Paint

Usually the hero image, large heading, or background image. Common fixes:

\`\`\`html
<!-- ❌ LCP image discovered late, no priority -->
<img src="/hero.jpg" alt="Hero">

<!-- ✅ Preloaded with high priority + dimensions -->
<link rel="preload" href="/hero.webp" as="image" fetchpriority="high">
<img src="/hero.webp" alt="Hero" fetchpriority="high"
     loading="eager" decoding="sync" width="1200" height="600">
\`\`\`

\`\`\`tsx
// ❌ Content JS-rendered — LCP element not in initial HTML
useEffect(() => { fetch('/api/hero').then(setHeroText) }, [])

// ✅ SSR / SSG — content in initial HTML; LCP is instant
\`\`\`

**LCP checklist:**
- [ ] TTFB < 800ms (CDN, edge caching)
- [ ] LCP image preloaded with \`fetchpriority="high"\`
- [ ] LCP element in initial HTML (not JS-rendered)
- [ ] Critical CSS inlined or loaded early (< 14KB)
- [ ] No render-blocking JS in \`<head>\`
- [ ] Fonts use \`font-display: swap\`

**Next.js shortcut:**
\`\`\`tsx
import Image from 'next/image'
<Image src="/hero.jpg" priority fill alt="Hero" />
\`\`\`

## INP — Interaction to Next Paint

Total INP = **Input Delay** + **Processing Time** + **Presentation Delay**
Target each phase: <50ms / <100ms / <50ms

\`\`\`javascript
// ❌ Heavy handler — blocks main thread for entire duration
button.addEventListener('click', () => {
  const result = calculateComplexThing()  // slow
  updateUI(result)
})

// ✅ Immediate visual feedback, then yield before heavy work
button.addEventListener('click', async () => {
  button.classList.add('loading')  // instant visual feedback (<16ms)

  // Yield so browser can paint the loading state
  if ('scheduler' in window && 'yield' in scheduler) {
    await scheduler.yield()
  } else {
    await new Promise(r => setTimeout(r, 0))
  }

  const result = calculateComplexThing()
  updateUI(result)
  button.classList.remove('loading')
})
\`\`\`

\`\`\`tsx
// ❌ Entire tree re-renders on count change
function App() {
  const [count, setCount] = useState(0)
  return <div><Counter count={count} /><ExpensiveComponent /></div>
}

// ✅ Memoize expensive components to skip re-renders
const MemoizedExpensive = React.memo(ExpensiveComponent)

// ✅ useTransition for non-urgent state updates
const [isPending, startTransition] = useTransition()
startTransition(() => setExpensiveFilterState(value))
\`\`\`

**INP checklist:**
- [ ] No tasks > 50ms on main thread
- [ ] Visual feedback provided within 80ms of interaction
- [ ] Heavy work yielded with \`scheduler.yield()\` or deferred
- [ ] Third-party scripts load \`async\`/\`defer\`
- [ ] Input handlers debounced where appropriate

## CLS — Cumulative Layout Shift

CLS formula: impact fraction × distance fraction. Any visible element moving = bad.

\`\`\`html
<!-- ❌ Causes layout shift when image loads -->
<img src="photo.jpg" alt="Photo">

<!-- ✅ Space reserved — no shift -->
<img src="photo.jpg" alt="Photo" width="800" height="600">
\`\`\`

\`\`\`css
/* ✅ Or use aspect-ratio */
img { aspect-ratio: 4/3; width: 100%; }

/* ❌ Animating layout properties → CLS */
.card { transition: height 0.3s; }

/* ✅ Use transform instead (compositor only, no layout) */
.card { transition: transform 0.3s; }
.card.expanded { transform: scale(1.05); }
\`\`\`

\`\`\`css
/* ✅ Fonts: size-adjusted fallback prevents FOUT layout shift */
@font-face {
  font-family: 'Custom';
  src: url('/custom.woff2') format('woff2');
  font-display: optional;  /* no shift: hides if font loads late */
}
\`\`\`

**CLS checklist:**
- [ ] All images/videos have \`width\`/\`height\` or \`aspect-ratio\`
- [ ] Ads/embeds have reserved \`min-height\` containers
- [ ] Fonts use \`font-display: optional\` or size-matched fallback metrics
- [ ] Dynamic content inserted below viewport, not above existing content
- [ ] Animations use only \`transform\`/\`opacity\`

## Measuring

\`\`\`javascript
import { onLCP, onINP, onCLS } from 'web-vitals'

onLCP(({ value, rating }) => console.log('LCP', value, rating))
onINP(({ value, rating }) => console.log('INP', value, rating))
onCLS(({ value, rating }) => console.log('CLS', value, rating))
\`\`\`

\`\`\`bash
npx lighthouse https://example.com --output html --output-path report.html
\`\`\``

export default body
