# Auth Overlay — Design Spec

**Date**: 2026-06-01
**Status**: Approved
**Project**: Bloom — BYOK AI Website Builder

## Overview

Add production-ready authentication to the Bloom landing page using Supabase Auth. "Sign in" and "Start free" header buttons open a full-screen overlay with Sign In / Sign Up tabs. Auth state is managed via a React context; after successful auth the overlay closes and the header reflects the logged-in user.

## Architecture

```
main.tsx
└── BrowserRouter
    └── SupabaseAuthProvider   ← NEW (context + session listener)
        └── App
            └── Layout
                ├── Header     ← reads useAuth() for user state
                ├── routes
                ├── Footer
                └── AuthModal  ← NEW (portal, controlled by context)
```

### Components

| Component | Responsibility |
|---|---|
| `SupabaseAuthProvider` | Wraps app, initializes Supabase client, exposes `useAuth()` hook |
| `AuthModal` | Full-screen overlay with tab switching, social buttons, and form |
| `AuthForm` | Email/password form with validation (child of AuthModal) |
| `SocialButton` | Reusable OAuth provider button |
| `Header` (updated) | Reads `useAuth()` to swap buttons for avatar |
| `UserMenu` | Dropdown with user info + sign out (shown on avatar click) |

## Design Details

### Overlay

- Full-screen backdrop: `rgba(7, 5, 10, 0.75)` + `backdrop-filter: blur(16px)`
- Centered card: 420px wide, `--color-surface-overlay` background
- Border: `1px solid var(--color-border-visible)`, radius `--radius-xl` (24px)
- Padding: 32px, gap: 20px between sections
- Entry: `scale(0.95)` → `scale(1)` + fade, framer-motion spring easing (0.25s)
- Exit: reverse, 0.15s
- Close on: backdrop click, Escape key, × button (top-right)

### Tab Switcher (Sign In / Sign Up)

- Pill-style toggle, 36px height, `--radius-full`
- Active tab: `var(--color-accent)` background, white text
- Inactive tab: transparent, `--color-text-secondary`
- Transition: 0.2s ease for background/color

### Social Buttons

- Full-width, 48px height, `--radius-md` (12px)
- `rgba(255,255,255,0.04)` background, `1px solid var(--color-border-visible)` border
- Hover: background → `rgba(255,255,255,0.08)`, border → `var(--color-border-glow)`
- 18px provider logo on left, 14px medium-weight label centered
- Loading state: spinner replaces logo, button disabled
- Providers: Google, GitHub

```
┌──────────────────────────────────┐
│  G  Continue with Google         │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│  ◇  Continue with GitHub         │
└──────────────────────────────────┘
```

### Divider

```
───  or continue with email  ───
```
- Horizontal rule with centered 12px `--color-text-muted` text

### Form Fields

- Always-visible label above each input (13px, `--color-text-secondary`, 500 weight)
- Input: 48px height, full-width, `--radius-md`
- Background: `rgba(255,255,255,0.04)`, border: `1px solid var(--color-border-visible)`
- Placeholder: `--color-text-muted`, 15px
- Focus: border → `var(--color-accent)`, box-shadow glow `0 0 0 3px rgba(139,92,246,0.15)`
- Error: border → `#EF4444`, label → `#FCA5A5`
- Password field: show/hide toggle (eye icon button, absolute right)

**Sign In fields:** Email, Password
**Sign Up fields:** Name, Email, Password, Confirm Password

### CTA Button

- Reuses `SlideInButton` styling: purple accent fill, expand-on-hover circle, arrow icon
- Full-width, 48px height, 15px font, weight 600
- Loading state: text → "Signing in…" / "Creating account…", subtle pulse opacity

### Footer Text

- "By continuing, you agree to our Terms of Service and Privacy Policy"
- 12px, `--color-text-muted`, centered, margin-top 8px
- Sign Up only

## States

### Initial Load
- `SupabaseAuthProvider` reads persisted session from Supabase's local-storage session
- `loading = true` → Header shows nothing (or skeleton) until resolved
- On mount: if valid session exists, `user` is set immediately — no visible flash

### Loading
- Social buttons: centered spinner (18px) replaces logo
- Submit button: `opacity: 0.7`, text swaps to "Signing in…" / "Creating account…"
- All inputs disabled during submission

### Error
- Inline error banner at top of form (below tabs):
  - `rgba(239, 68, 68, 0.1)` background, `1px solid rgba(239, 68, 68, 0.25)` border
  - 14px error text, `--radius-sm`
  - Auto-dismissed on new input or tab switch
- Specific messages: "Invalid login credentials", "An account with this email already exists", "Please check your email for a confirmation link"

### Success
- Brief "Welcome!" text flashes (200ms) or overlay fades out immediately
- Overlay exit animation: 0.3s
- Header: "Sign in" button → 32px user avatar circle, "Start free" → "Dashboard"

### Edge Cases
- OAuth popup blocked by browser: show inline message "Pop-up was blocked. Please allow pop-ups and try again."
- Email already registered (sign up): "An account with this email already exists. Sign in instead?" with link to switch tab
- Weak password: client-side minimum 8 chars validation, server-side Supabase enforces
- Network failure: generic "Something went wrong. Please try again." with retry

## AuthProvider API

```tsx
// src/lib/AuthContext.tsx
interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string }>
  signInWithGoogle: () => Promise<void>
  signInWithGitHub: () => Promise<void>
  signOut: () => Promise<void>
}

function useAuth(): AuthContextValue
function SupabaseAuthProvider({ children }: { children: ReactNode }): JSX.Element
```

## Supabase Setup

- New project: `bloom`, region `eu-central-1`, org `thomastschinkel's Org`
- Enable auth providers: Email, Google, GitHub
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Client file: `src/lib/supabase.ts` (singleton)

## Files

| File | Purpose |
|---|---|
| `src/lib/supabase.ts` | Supabase client singleton |
| `src/lib/AuthContext.tsx` | AuthProvider + useAuth hook |
| `src/components/AuthModal/AuthModal.tsx` | Overlay + tab switching |
| `src/components/AuthModal/AuthModal.module.css` | Overlay styles |
| `src/components/AuthModal/AuthForm.tsx` | Email/password form |
| `src/components/AuthModal/AuthForm.module.css` | Form styles |
| `src/components/AuthModal/SocialButton.tsx` | OAuth button |
| `src/components/AuthModal/SocialButton.module.css` | Social button styles |
| `src/components/Header/Header.tsx` | Updated: auth-aware buttons |
| `src/components/Header/Header.module.css` | Minor updates for avatar |
| `.env` (or `.env.local`) | Supabase keys |

## Open Items
- Terms of Service and Privacy Policy URLs — placeholder `#` links for now
- Avatar/UserMenu dropdown design — deferred to a follow-up (use a simple circle with first initial for now)
