/**
 * Curated third-party package allowlist (single source of truth).
 *
 * Kept in its own dependency-free module so both the bundler (preview-bundle)
 * and the agent prompt can import it without pulling in esbuild-wasm. Every
 * entry is served from esm.sh, pinned, and (where it depends on React) marked
 * `?external=react,react-dom` so it shares the single React instance — a second
 * React copy breaks hooks with "invalid hook call".
 */

export interface AllowedPackage {
  /** Bare specifier the agent imports, e.g. "lucide-react". */
  name: string
  /** Pinned esm.sh URL. */
  url: string
  /** One-line description shown to the agent. */
  description: string
}

const EXTERNAL = '?external=react,react-dom'

export const ALLOWED_PACKAGES: AllowedPackage[] = [
  {
    name: 'framer-motion',
    url: `https://esm.sh/framer-motion@11.3.19${EXTERNAL}`,
    description: 'Production animation library: `import { motion, AnimatePresence } from "framer-motion"`.',
  },
  {
    name: 'lucide-react',
    url: `https://esm.sh/lucide-react@0.427.0${EXTERNAL}`,
    description: 'Clean SVG icons: `import { Menu, ArrowRight, Check } from "lucide-react"`.',
  },
  {
    name: 'recharts',
    url: `https://esm.sh/recharts@2.12.7${EXTERNAL}`,
    description: 'Composable charts: `import { LineChart, Line, XAxis, Tooltip } from "recharts"`.',
  },
  {
    name: 'clsx',
    url: 'https://esm.sh/clsx@2.1.1',
    description: 'Tiny className builder: `import clsx from "clsx"`.',
  },
  {
    name: 'date-fns',
    url: 'https://esm.sh/date-fns@3.6.0',
    description: 'Date utilities: `import { format, addDays } from "date-fns"`.',
  },
  {
    name: 'nanoid',
    url: 'https://esm.sh/nanoid@5.0.7',
    description: 'Unique id generator: `import { nanoid } from "nanoid"`.',
  },
  {
    name: '@supabase/supabase-js',
    url: 'https://esm.sh/@supabase/supabase-js@2.45.4',
    description: 'Supabase client (database + auth). Prefer the injected `@openthorn/db` over importing this directly.',
  },
]

export const ALLOWED_PACKAGE_NAMES = ALLOWED_PACKAGES.map((p) => p.name)

/** Set of every bare specifier the bundler can resolve (react core + allowlist). */
export const RESOLVABLE_PACKAGES = new Set<string>([
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-router-dom',
  // Injected data-layer client (data URL in the import map, not from esm.sh).
  '@openthorn/db',
  ...ALLOWED_PACKAGE_NAMES,
])
