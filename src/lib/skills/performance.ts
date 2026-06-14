// Source: github.com/addyosmani/web-quality-skills (MIT)
const body = `# Web Performance Optimization

## Performance Budget

| Resource | Budget | Rationale |
|----------|--------|-----------|
| Total page weight | < 1.5 MB | 3G loads in ~4s |
| JavaScript (compressed) | < 300 KB | Parsing + execution time |
| CSS (compressed) | < 100 KB | Render blocking |
| Images (above-fold) | < 500 KB | LCP impact |
| Fonts | < 100 KB | FOIT/FOUT prevention |

## Resource Loading

\`\`\`html
<!-- Preconnect to required origins -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://cdn.example.com" crossorigin>

<!-- Preload LCP image -->
<link rel="preload" href="/hero.webp" as="image" fetchpriority="high">

<!-- Preload critical font -->
<link rel="preload" href="/font.woff2" as="font" type="font/woff2" crossorigin>
\`\`\`

## JavaScript Optimization

\`\`\`tsx
// Route-based code splitting
const Dashboard = lazy(() => import('./Dashboard'))
const HeavyChart = lazy(() => import('./HeavyChart'))

// Feature-based splitting
if (user.isPremium) {
  const { init } = await import('./PremiumFeatures')
  init()
}

// Tree shaking — import only what you need
import debounce from 'lodash/debounce'   // ✅ single function
import _ from 'lodash'                    // ❌ entire library
\`\`\`

## Image Optimization

\`\`\`html
<!-- Above-fold LCP image: eager, high priority, explicit dimensions -->
<img src="hero.webp" fetchpriority="high" loading="eager" decoding="sync"
     width="1200" height="600" alt="Hero">

<!-- Below-fold: lazy load -->
<img src="product.webp" loading="lazy" decoding="async"
     width="800" height="600" alt="Product">
\`\`\`

**Format selection:**
- AVIF (92%+ browser support) — best compression for photos
- WebP (97%+ support) — safe default fallback
- SVG — icons, logos, illustrations (scales cleanly)
- Always declare \`width\`/\`height\` or \`aspect-ratio\` to prevent CLS

## Font Optimization

\`\`\`css
@font-face {
  font-family: 'Custom Font';
  src: url('/fonts/custom.woff2') format('woff2');
  font-display: swap;           /* prevents invisible text (FOIT) */
  unicode-range: U+0000-00FF;  /* subset to Latin only */
}

/* Variable fonts: one file for all weights */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-Variable.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-display: swap;
}
\`\`\`

## Runtime Performance

\`\`\`javascript
// Avoid layout thrashing — batch reads then writes
const heights = elements.map(el => el.offsetHeight)       // all reads
elements.forEach((el, i) => { el.style.height = heights[i] + 10 + 'px' })  // all writes

// Debounce high-frequency events
window.addEventListener('scroll', debounce(handleScroll, 100))
window.addEventListener('resize', debounce(handleResize, 150))

// Virtualize long lists (>100 items)
// react-window, or CSS content-visibility:
.virtual-list { content-visibility: auto; contain-intrinsic-size: 0 50px; }
\`\`\`

## React-Specific

\`\`\`tsx
// Memoize expensive child components
const MemoizedExpensive = React.memo(ExpensiveComponent)

// Defer expensive state updates to keep UI responsive
const [isPending, startTransition] = useTransition()
startTransition(() => setExpensiveState(newValue))

// Avoid unnecessary re-renders: stable references
const handleClick = useCallback(() => { ... }, [deps])
const computed = useMemo(() => expensiveCalc(data), [data])
\`\`\`

## Caching Headers

\`\`\`
# HTML (always revalidate)
Cache-Control: no-cache, must-revalidate

# Static assets with content hash (immutable)
Cache-Control: public, max-age=31536000, immutable

# API responses
Cache-Control: private, max-age=0, must-revalidate
\`\`\`

## Key Metrics

| Metric | Good | Tool |
|--------|------|------|
| LCP | < 2.5s | Lighthouse, CrUX |
| FCP | < 1.8s | Lighthouse |
| TBT | < 200ms | Lighthouse |
| TTI | < 3.8s | Lighthouse |`

export default body
