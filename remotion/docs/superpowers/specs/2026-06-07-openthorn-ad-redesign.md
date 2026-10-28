# OpenThorn Ad Redesign — Apple Cinematic Split Screen

**Date:** 2026-06-07  
**File:** `src/OpenThornAd.tsx`  
**Duration:** 510 frames @ 30fps (17s), unchanged

---

## Goal

Redesign `OpenThornAd` to feel modern, premium, and cinematic. The current version is all text centered on a dark background. The new version introduces real footage in a split-screen layout with elevated typography and a film grain texture throughout.

---

## Visual Direction

**Apple-style cinematic:** restrained, large serif type, dramatic reveals, breathing room. Not kinetic or hyperactive — every element has weight and purpose.

**Palette:** unchanged — `#09070B` background, `#F4EFF8` text, purple/teal/amber accents.

**Fonts:** unchanged — Fraunces (light 300) for display, Roboto for supporting copy.

---

## Global Changes

### Film Grain Overlay
A full-frame SVG `feTurbulence` noise filter rendered as an overlay at ~4% opacity sits above all content for the entire duration. This makes the video feel physical and premium rather than flat/digital. It does not animate.

### Hairline Separator
In split scenes, a 1px vertical line at the horizontal center (`left: 50%`) runs the full height of the frame. It fades in with each scene transition over ~12 frames. It visually anchors the split composition.

---

## Scene-by-Scene Design

### Scene 1 — Logo Reveal (frames 0–120)
**Layout:** centered, unchanged structure.  
**Upgrades:**
- Glow radius increased from 560px to 720px, max opacity bumped to 0.85
- Logo spring config: higher stiffness (140) for a snappier pop
- `Meet OpenThorn.` font size increased from 96 to 112
- Grain overlay is present from frame 0

### Scene 2 — "Your keys." (frames 112–210)
**Layout:** video-left / text-right split.

**Left half (video panel):**
- `scene2.mp4` in a rounded panel: `border-radius: 14px`, 1px `rgba(255,255,255,0.1)` border, `box-shadow: 0 32px 120px rgba(0,0,0,0.6)`
- Panel occupies roughly `width: 820px, height: 560px` centered vertically in the left half with ~80px padding from edges
- Slides in from the left (`translateX(-60px → 0`) over 22 frames with expo-out easing
- Video `opacity: 1`, `objectFit: cover`, `muted`

**Right half (text):**
- `"Your keys."` in Fraunces 160px, slides in from right (`translateX(60px → 0`) over 22 frames
- Supporting line below: `"Your data. Your control."` in Roboto 28px, muted color, fades in 10 frames after the headline
- Purple underline draws left-to-right starting 14 frames after headline appears
- Text block is vertically centered in the right half

**Separator:** fades in at frame 112 over 12 frames.

### Scene 3 — "Any provider." (frames 202–300)
**Layout:** text-left / video-right split (alternates from Scene 2).

**Right half (video panel):**
- `scene3.mp4`, same panel styling as Scene 2
- Slides in from the right

**Left half (text):**
- `"Any provider."` in Fraunces 160px, slides in from left
- Provider logos row below the headline, staggered fade-in unchanged
- Teal underline

**Separator:** fades in at frame 202.

### Scene 4 — "No platform tax." (frames 292–390)
**Layout:** video-left / text-right split.

**Left half (video panel):**
- `scene4.mp4`, same panel styling
- Slides in from left

**Right half (text):**
- `"No platform tax."` — this phrase is long; reduce to Fraunces 120px so it fits cleanly on one line or wraps to two at ~140px
- Supporting line: `"No markup. No lock-in."` in Roboto 28px
- Amber underline

**Separator:** fades in at frame 292.

### Scene 5 — Final (frames 382–510)
**Layout:** centered, no split. Returns to Scene 1's composition language.

**Upgrades:**
- `scene5.mp4` plays as a full-bleed background at 28% opacity (lower than before — it's atmosphere here, not a feature)
- `rgba(9,7,11,0.6)` overlay on top of the video
- Logo, wordmark, tagline, URL animations unchanged in structure but tightened timing
- Rotating glow is stronger (opacity 0.65 peak)
- Fade to black starts at local frame 105 (slightly earlier for a more cinematic cut)

---

## Animation Principles

- **Slide direction:** video panels always enter from their edge of the screen; text always enters from the center side. They meet at the hairline.
- **Timing:** slide-in over 22 frames, expo-out (`Easing.bezier(0.19, 1, 0.22, 1)`). Same easing as current.
- **Separator:** fades in over 12 frames at scene start, fades out over 12 frames at scene end.
- **No new dependencies** — all achievable with existing Remotion primitives (`interpolate`, `spring`, `Sequence`, `Video`).

---

## Implementation Notes

- The current `sceneOpacity` + stacked `AbsoluteFill` pattern is retained.
- Each split scene renders two child `AbsoluteFill` halves (left: `width: 50%, left: 0` / right: `width: 50%, left: 50%`) inside the scene's wrapper.
- The `Sequence from={SCENE.x}` wrapper around each `Video` is retained from the previous change to ensure clips start at frame 0.
- The grain overlay is a single always-on `<AbsoluteFill>` at the top level, rendered after all scene layers so it sits above everything.
- "No platform tax." text at 140px may need `maxWidth` or `whiteSpace: nowrap` — verify in Studio after implementation.
