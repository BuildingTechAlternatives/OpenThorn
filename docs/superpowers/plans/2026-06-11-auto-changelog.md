# Auto-generated Changelog page (2026-06-11)

## Goal

A public `/changelog` page, linked from the Resources navbar dropdown, the mobile menu, and the footer, whose content regenerates automatically with every GitHub push.

## How it works

- **Generation**: `scripts/generate-changelog.mjs` runs first in `npm run build`. It fetches up to 300 commits from the public GitHub API (`/repos/BuildingTechAlternatives/OpenThorn/commits`) and writes `src/data/changelog.json`. Every push triggers a Vercel build, so the changelog refreshes on each push with no workflow or token required.
- **Resilience**: the JSON snapshot is committed to the repo. If the GitHub API fails during a build (e.g. unauthenticated rate limit on shared Vercel build IPs), the script warns and keeps the existing snapshot — builds never fail because of the changelog. Optional `GITHUB_TOKEN` env var raises the rate limit.
- **Processing** (`scripts/changelog-core.mjs`, pure/unit-tested):
  - noise filter drops merge/revert/WIP commits, typo fixes, lockfile/dependency bumps, and conventional-commit housekeeping prefixes (`chore:`, `ci:`, …)
  - leading-verb categorization: Add/Implement/Create/… → **New**, Fix/Resolve/Prevent/… → **Fix**, everything else → **Improved**
  - grouped by committer-date day (UTC), newest first
- **Page**: `src/pages/ChangelogPage.tsx` (lazy-loaded route in `App.tsx`) renders date sections with category badges and per-entry commit links to GitHub.
- **SEO**: `/changelog` added to `scripts/prerender.mjs` (static HTML snapshot of the 10 most recent days + sitemap entry with `lastmod`) and to `public/llms.txt`.

## Touched files

`scripts/changelog-core.mjs` (new), `scripts/generate-changelog.mjs` (new), `src/data/changelog.json` (new, generated), `src/pages/ChangelogPage.tsx` + `.module.css` (new), `src/lib/__tests__/changelog-core.test.mjs` (new), `src/App.tsx`, `src/components/Header/Header.tsx`, `src/components/Footer/Footer.tsx`, `src/components/MobileMenu/MobileMenu.tsx`, `scripts/prerender.mjs`, `package.json`, `vitest.config.ts` (include `.test.mjs`), `public/llms.txt`.
