// Source: claude-plugins-official/vercel shadcn skill (adapted — agent writes files directly, no CLI)
const body = `# shadcn/ui — Component Patterns & Theming

shadcn/ui is a collection of accessible, customizable React components built on Radix UI primitives and Tailwind CSS. Components live as source files in the project — write them directly, don't import from a package.

## Key Concept

**Not a package you import.** Components are source code in \`components/ui/\`. Write them directly into the project as .tsx files. They depend on Radix UI primitives (available via esm.sh) and use CSS variables for theming.

## Required Utilities

Every project using shadcn components needs the \`cn()\` helper:

\`\`\`ts
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
\`\`\`

Dependencies: \`clsx\`, \`tailwind-merge\`, \`class-variance-authority\` (cva), \`radix-ui\` (or individual \`@radix-ui/react-*\` packages).

## Theming — CSS Variables

Define in \`src/index.css\` or \`globals.css\`. shadcn uses semantic color tokens, never raw hex in components:

\`\`\`css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.396 0.141 25.723);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: oklch(0.488 0.243 264.376);
}
\`\`\`

Apply to elements using Tailwind classes that map to these tokens: \`bg-background\`, \`text-foreground\`, \`bg-card\`, \`text-muted-foreground\`, \`border-border\`, etc.

## Most Common Components

| Component | Use Case |
|-----------|----------|
| \`button\` | Actions, form submission |
| \`card\` | Content containers |
| \`dialog\` | Modals, confirmation prompts |
| \`alert-dialog\` | Destructive confirmations (use this, not dialog) |
| \`input\` / \`textarea\` | Form fields |
| \`select\` | Dropdowns |
| \`table\` | Data display |
| \`tabs\` | View switching |
| \`command\` | Command palette (Cmd+K) |
| \`dropdown-menu\` | Context menus |
| \`popover\` | Floating content |
| \`tooltip\` | Hover hints |
| \`badge\` | Status indicators |
| \`avatar\` | User profile images |
| \`scroll-area\` | Scrollable containers |
| \`sheet\` | Slide-out panels |
| \`skeleton\` | Loading placeholders |
| \`separator\` | Visual dividers |
| \`label\` | Form labels |
| \`alert\` | Inline notifications |

## Design Direction

### Default aesthetic

- Prefer \`new-york\` style (sharp radius, subtle shadows) for product, dashboard, and admin surfaces
- Default to dark mode for dashboards, AI apps, developer-facing products; light for content/editorial
- Use Geist Sans for interface text, Geist Mono for code/metrics/IDs/timestamps
- Base palette: zinc, neutral, or slate — one accent color via \`--primary\`
- Build surfaces from semantic tokens: \`bg-background\`, \`bg-card\`, \`text-foreground\`, \`text-muted-foreground\`, \`border-border\`
- No ad-hoc hex values — semantic tokens only
- Icons: Lucide at \`h-4 w-4\` or \`h-5 w-5\`; keep them quiet and consistent

### Composition recipes

| Use case | Components | Why |
|----------|------------|-----|
| Settings page | \`Tabs\` + \`Card\` + form fields | Clear grouping with predictable save flows |
| Data dashboard | \`Card\` + \`Badge\` + \`Table\` + \`DropdownMenu\` | Summary, status, dense data, row actions |
| CRUD table | \`Table\` + \`DropdownMenu\` + \`Sheet\` + \`AlertDialog\` | Browse, act, edit, destructive confirmation |
| Auth screen | \`Card\` + \`Label\` + \`Input\` + \`Button\` + \`Alert\` | Focused entry with proper error treatment |
| Global search | \`Command\` + \`Dialog\` | Fast keyboard-first discovery |
| Mobile nav | \`Sheet\` + \`Button\` + \`Separator\` | Compact navigation shell |
| Detail page | header + \`Badge\` + \`Separator\` + \`Card\` | Hierarchy, metadata, supporting content |
| Filters (desktop) | \`Card\` sidebar + \`Select\` | Persistent filter panel |
| Filters (mobile) | \`Sheet\` + \`Select\` | Collapsible mobile controls |
| Empty/loading/error | \`Card\` + \`Skeleton\` + \`Alert\` | Designed non-happy paths |

### Anti-patterns to avoid

- Raw \`button\` / \`input\` / \`select\` / \`div\` when shadcn components exist
- Repeated \`div rounded-xl border p-6\` instead of proper \`Card\`/\`Sheet\`/\`Dialog\`
- Multiple accent colors fighting each other
- Nested cards inside cards inside cards
- Large gradient backgrounds and glassmorphism on every surface
- Mixing arbitrary spacing and radius values
- Using \`Dialog\` for destructive confirmation instead of \`AlertDialog\`
- Shipping empty/loading/error states without design treatment
- Ad-hoc Tailwind palette classes (\`bg-gray-900\`) instead of semantic tokens (\`bg-background\`)

## Component Gotchas

### Avatar Has No \`size\` Prop

\`\`\`tsx
// WRONG
<Avatar size="lg" />

// CORRECT
<Avatar className="h-12 w-12">
  <AvatarImage src={user.image} />
  <AvatarFallback>JD</AvatarFallback>
</Avatar>
\`\`\`

Most shadcn components use Tailwind classes for sizing, not variant props.

### TooltipProvider Required at Root

\`\`\`tsx
import { TooltipProvider } from '@/components/ui/tooltip'

export default function App() {
  return (
    <TooltipProvider>
      {/* rest of app */}
    </TooltipProvider>
  )
}
\`\`\`

### Extending Components

Since you own the source, extend directly with \`cva\`:

\`\`\`tsx
// components/ui/button.tsx
const buttonVariants = cva('...', {
  variants: {
    variant: {
      default: '...',
      destructive: '...',
      success: 'bg-green-600 text-white hover:bg-green-700',
    },
  },
})
\`\`\`

### Radius Tokens

\`\`\`css
--radius: 0.625rem;
--radius-sm: calc(var(--radius) * 0.75);
--radius-md: calc(var(--radius) * 0.875);
--radius-lg: var(--radius);
--radius-xl: calc(var(--radius) * 1.5);
\`\`\`

Use \`rounded-[--radius-md]\` etc. to stay consistent with the design system.
`

export default body
