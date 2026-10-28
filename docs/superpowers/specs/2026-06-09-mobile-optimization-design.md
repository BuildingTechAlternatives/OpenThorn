# Mobile Optimization — Design Spec
**Date:** 2026-06-09  
**Branch:** harden/pre-launch-fixes

---

## Problem

The marketing site is largely mobile-friendly. The **app shell is not**:

- `DashboardSidebar` is `position: fixed; width: 248px` with **zero responsive CSS**. On a 375px phone it covers ~66% of the viewport and overlaps all content.
- `DashboardPage` removes `margin-left` at 768px but the sidebar is still always visible.
- `ProfilePage` has the same sidebar dependency.
- `SettingsPage` has its own custom sidebar with no mobile CSS.
- Minor gaps remain in some marketing sections (MeetOpenThorn, BYOK, Footer grids) and the ProjectBuilder topbar on very small phones.

---

## Approach: Drawer sidebar + targeted fixes

### 1. DashboardSidebar — Mobile Drawer

**Props change:** Add `isOpen: boolean` and `onClose: () => void` to `DashboardSidebar`.

**CSS (≤768px):**
- Sidebar default: `transform: translateX(-100%); transition: transform 0.28s ease`
- Sidebar open: `transform: translateX(0)`
- A full-screen overlay div renders behind the open drawer (semi-transparent dark bg); tapping it calls `onClose`

**Desktop:** Props are accepted but ignored — sidebar is always visible, no `transform` applied. Zero visual change on desktop.

### 2. DashboardPage — Mobile Top Bar

At ≤768px, a sticky top bar renders above the content containing:
- Hamburger button (left) → sets `sidebarOpen = true`
- Bloom logo (center or left of hamburger)
- Manages `sidebarOpen: boolean` state, passes to `DashboardSidebar`

The existing `content` div already has `padding-top: 60px` at ≤768px — the top bar fits cleanly.

### 3. ProfilePage — Same pattern as DashboardPage

ProfilePage also renders `DashboardSidebar`. Apply the same `sidebarOpen` state + mobile top bar.

### 4. SettingsPage — Horizontal Tab Nav on Mobile

SettingsPage has a custom sidebar (4 tabs: Account, Providers, Knowledge, Danger Zone). At ≤768px:
- The fixed left sidebar hides
- A horizontally-scrollable tab strip renders at the top of the content area
- Content goes full-width

No new props needed — it's self-contained CSS + a conditional render class.

### 5. ProjectBuilder — Small-screen topbar tightening

At ≤480px:
- The mode switch (`Chat / Code`) is hidden — users navigate via the existing shell
- The `topbarLeft` cluster (back btn + project name + model badge) wraps with `flex-wrap: wrap` and a smaller font for the project name
- Share/Deploy buttons stay visible (critical actions)

The 860px stacking layout (chat-on-top, preview-below) already works well; no changes needed there.

### 6. Marketing Page Grid Fixes

Files to audit and add mobile column-collapse (≤600px → `grid-template-columns: 1fr`):
- `MeetOpenThornSection.module.css`
- `BYOKSection.module.css`
- `Footer.module.css`

### 7. Global Touch Improvements

**`index.html`:** Confirm `<meta name="viewport" content="width=device-width, initial-scale=1">` is present and correct.

**`index.css`:** Add to the global reset:
```css
button, a, [role="button"] {
  touch-action: manipulation; /* eliminates 300ms tap delay */
}
```
Minimum tap target: ensure interactive elements in the mobile top bar and drawer are ≥44px tall.

---

## Breakpoints Used

| Breakpoint | Purpose |
|---|---|
| ≤960px | Header hides desktop nav, shows hamburger (already exists) |
| ≤860px | ProjectBuilder stacks chat + preview (already exists) |
| ≤768px | App sidebar → drawer; DashboardPage/ProfilePage mobile top bar; SettingsPage tab nav |
| ≤600px | Marketing section grids collapse to single column |
| ≤480px | ProjectBuilder topbar: hide mode switch, tighten project name |

---

## Files Changed

| File | Change |
|---|---|
| `DashboardSidebar/DashboardSidebar.tsx` | Add `isOpen`/`onClose` props; render overlay |
| `DashboardSidebar/DashboardSidebar.module.css` | Mobile drawer CSS |
| `DashboardPage.tsx` | `sidebarOpen` state, mobile top bar |
| `DashboardPage.module.css` | Mobile top bar styles |
| `ProfilePage.tsx` | `sidebarOpen` state, mobile top bar |
| `ProfilePage.module.css` | Mobile top bar styles |
| `SettingsPage.module.css` | Hide sidebar ≤768px, add horizontal tab strip |
| `SettingsPage.tsx` | Conditional tab strip render |
| `ProjectBuilderPage.module.css` | ≤480px topbar tweaks |
| `MeetOpenThornSection.module.css` | Grid collapse ≤600px |
| `BYOKSection.module.css` | Grid collapse ≤600px |
| `Footer.module.css` | Grid collapse ≤600px |
| `index.html` | Confirm viewport meta |
| `index.css` | `touch-action: manipulation`, tap target sizes |

---

## Out of Scope

- Bottom tab bar navigation (Option B — explicitly not chosen)
- Full PWA / app manifest
- Swipe gestures on the sidebar (snap-to-close)
- Any changes to the ProjectBuilder's 860px stacked layout (already works)
