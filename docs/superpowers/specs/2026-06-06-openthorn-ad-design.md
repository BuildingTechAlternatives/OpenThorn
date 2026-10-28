# OpenThorn Introduction Ad — Design Spec

**Date:** 2026-06-06  
**Format:** 1920×1080, 16:9, 30fps, 450 frames (15 seconds)  
**Platforms:** X (Twitter) feed, YouTube pre-roll  
**Audience:** Developers and non-technical founders  
**Tone:** Sleek, minimal, confident (Apple-style)  
**Approach:** Typographic Manifesto — full-screen statement-by-statement reveal  

---

## Core Message

> No platform tax. Connect your own AI keys from any provider.

The ad makes three sequential trust claims, then lands the brand. Designed to work fully muted.

---

## Brand Tokens

| Token | Value |
|-------|-------|
| Background | `#09070B` |
| Text | `#F4EFF8` |
| Text muted | `#C9C1D3` |
| Accent purple | `#A78BFA` |
| Accent teal | `#5EEAD4` |
| Accent amber | `#F6C177` |
| Font display | Fraunces (serif) |
| Font body | Roboto |

---

## Scene Breakdown

### Scene 1 — Logo Reveal (frames 0–60, 0–2s)

- Pure `#09070B` background
- OpenThorn logo mark (`public/assets/logo.png`) spring-scales in from center
- Soft radial purple glow (`#A78BFA`, blur ~120px) blooms behind the logo
- No text — identity only
- Audio: soft ambient pad rises in

---

### Scene 2 — "Your keys." (frames 60–150, 2–5s)

- Logo fades out
- **"Your keys."** slides up 20px and fades in — Fraunces, ~180px, font-weight 300, `#F4EFF8`
- A slim purple (`#A78BFA`) underline draws in left-to-right beneath the text over ~18 frames
- Held for ~2s
- Nothing else on screen
- Audio: subtle high-frequency UI whoosh on text enter

---

### Scene 3 — "Any provider." (frames 150–240, 5–8s)

- Previous fades out
- **"Any provider."** slides up in same Fraunces style
- Teal (`#5EEAD4`) underline draws in
- Below the text, provider logos fade in as a horizontal row:
  - OpenAI, Anthropic, Google, Mistral, Groq, DeepSeek (from `public/assets/`)
  - ~48px tall, grayscale (`filter: grayscale(1) opacity(0.55)`), evenly spaced
  - Row fades in ~10 frames after the text settles
- Audio: subtle whoosh on text enter

---

### Scene 4 — "No platform tax." (frames 240–330, 8–11s)

- Previous fades out
- **"No platform tax."** — same Fraunces style, punchline statement
- Amber (`#F6C177`) underline draws in
- No supporting elements — statement stands alone
- Slightly longer hold than previous scenes
- Audio: subtle whoosh on text enter, slightly deeper tone

---

### Scene 5 — Final (frames 330–450, 11–15s)

- 8-frame black pause (deliberate breath after punchline)
- OpenThorn logo mark + wordmark **"OpenThorn"** spring-scale in from center
- Soft tri-color glow behind logo: purple + teal + amber, slowly rotating
- Below wordmark, in small Roboto (~28px), `#C9C1D3`:  
  **"Build for free. openthorn.app"**
- Both text elements fade in staggered (~20 frames apart)
- Hold for ~3s
- Gentle fade to black over final 20 frames
- Audio: resonant ambient chord hit on logo reveal, fade out to silence

---

## Animation Principles

- **Entry:** fade + translateY(-20px → 0) with expo-out easing (`cubic-bezier(0.19, 1, 0.22, 1)`)
- **Logo spring:** `spring({ damping: 18, stiffness: 100, mass: 0.9 })`
- **Underline draw:** width 0% → 100%, left-aligned, over 18 frames, expo-out
- **Transitions between scenes:** crossfade only, no wipes or slides — 8-frame overlap
- **No motion graphics or decorative elements** — typography and glow only

---

## Audio

| Cue | Timing | Description |
|-----|--------|-------------|
| Ambient pad | 0–450f | Sparse, dark electronic texture, low volume (~0.25) |
| UI whoosh × 3 | Scene 2, 3, 4 entry | Subtle high-frequency sweep, short (~0.3s) |
| Chord hit | Scene 5 logo in | Resonant, warm, single note, fades naturally |

Audio files to source/place in `remotion/public/audio/`:
- `openthorn-ad-ambient.wav` — background pad
- `openthorn-ad-whoosh.wav` — statement entry SFX (reused across scenes)
- `openthorn-ad-chord.wav` — final logo chord

---

## Assets Required

All image assets must be placed in `remotion/public/` so Remotion's `staticFile()` can access them. Copy from the main app's `public/assets/` folder.

| Remotion path | Source |
|------|--------|
| `remotion/public/logo.png` | Copy from `public/assets/logo.png` |
| `remotion/public/openai.png` | Copy from `public/assets/openai.png` |
| `remotion/public/anthropic.png` | Copy from `public/assets/anthropic.png` |
| `remotion/public/google.png` | Copy from `public/assets/google.png` |
| `remotion/public/mistralai.png` | Copy from `public/assets/mistralai.png` |
| `remotion/public/groq.png` | Copy from `public/assets/groq.png` |
| `remotion/public/deepseek.webp` | Copy from `public/assets/deepseek.webp` |
| `remotion/public/audio/openthorn-ad-ambient.wav` | To source |
| `remotion/public/audio/openthorn-ad-whoosh.wav` | To source |
| `remotion/public/audio/openthorn-ad-chord.wav` | To source |

---

## Remotion Composition

- **ID:** `OpenThornAd`
- **File:** `remotion/src/OpenThornAd.tsx`
- **durationInFrames:** 450
- **fps:** 30
- **width:** 1920
- **height:** 1080
- **Prop:** `includeAudio?: boolean` (default `true`) for rendering without audio during preview
