# OpenThorn Introduction Ad — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 15-second, 16:9 typographic manifesto Remotion ad for OpenThorn targeting X and YouTube.

**Architecture:** Single composition (`OpenThornAd`) with 5 scenes rendered as overlapping `AbsoluteFill` layers. Each scene receives its `startFrame` and computes `local = frame - startFrame` for all internal animations. No CSS transitions — all animation via `interpolate()` and `spring()`. Audio fires at specific timeline points via `<Sequence from={N}>` wrapping `<Audio>`.

**Tech Stack:** Remotion 4.x, React 19, `@remotion/google-fonts` (Fraunces + Roboto), TypeScript

---

## File Map

| Action | Path |
|--------|------|
| Create | `remotion/src/OpenThornAd.tsx` |
| Modify | `remotion/src/Root.tsx` |
| Modify | `remotion/package.json` |
| Copy (×7) | `public/assets/*.png/webp` → `remotion/public/` |
| Place (×3) | `remotion/public/audio/openthorn-ad-ambient.wav`, `openthorn-ad-whoosh.wav`, `openthorn-ad-chord.wav` |

---

### Task 1: Install @remotion/google-fonts and copy image assets

**Files:**
- Modify: `remotion/package.json` (via install)
- Copy: 7 image files from `public/assets/` → `remotion/public/`

- [ ] **Step 1: Install @remotion/google-fonts**

Run from the `remotion/` directory:
```bash
cd remotion && npx remotion add @remotion/google-fonts
```
Expected: `@remotion/google-fonts` appears in `remotion/package.json` dependencies.

- [ ] **Step 2: Copy image assets into remotion/public/**

Run from the project root:
```bash
cp public/assets/logo.png remotion/public/logo.png
cp public/assets/openai.png remotion/public/openai.png
cp public/assets/anthropic.png remotion/public/anthropic.png
cp public/assets/google.png remotion/public/google.png
cp public/assets/mistralai.png remotion/public/mistralai.png
cp public/assets/groq.png remotion/public/groq.png
cp public/assets/deepseek.webp remotion/public/deepseek.webp
```

- [ ] **Step 3: Verify assets are present**

```bash
ls remotion/public/
```
Expected: `logo.png  openai.png  anthropic.png  google.png  mistralai.png  groq.png  deepseek.webp` (plus existing files)

- [ ] **Step 4: Commit**

```bash
git add remotion/package.json remotion/node_modules remotion/public/
git commit -m "feat: install @remotion/google-fonts and copy ad image assets"
```

---

### Task 2: Create OpenThornAd.tsx scaffold

**Files:**
- Create: `remotion/src/OpenThornAd.tsx`

- [ ] **Step 1: Create the file with full scaffold**

Create `remotion/src/OpenThornAd.tsx`:

```tsx
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadRoboto } from "@remotion/google-fonts/Roboto";

const { fontFamily: fraunces } = loadFraunces("normal", {
  weights: ["300"],
  subsets: ["latin"],
});
const { fontFamily: roboto } = loadRoboto("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

const palette = {
  bg: "#09070B",
  text: "#F4EFF8",
  muted: "#C9C1D3",
  purple: "#A78BFA",
  teal: "#5EEAD4",
  amber: "#F6C177",
};

// Scene start frames (30fps)
const SCENE = {
  logo: 0,      // 0s
  keys: 60,     // 2s
  provider: 150, // 5s
  tax: 240,     // 8s
  final: 330,   // 11s
} as const;

// Scene end frames (with 8-frame crossfade overlap into next)
const SCENE_END = {
  logo: 68,
  keys: 158,
  provider: 248,
  tax: 338,
  final: 450,   // total duration
} as const;

/** Smooth 0→1 with expo-out easing */
function p(frame: number, start: number, dur: number): number {
  return interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.19, 1, 0.22, 1),
  });
}

/** Scene opacity: fades in at start, fades out near end. Pass isLast=true to skip fade-out. */
function sceneOpacity(
  frame: number,
  start: number,
  end: number,
  isLast = false
): number {
  if (frame < start) return 0;
  if (!isLast && frame >= end) return 0;
  const fadeIn = p(frame, start, 10);
  const fadeOut = isLast ? 1 : 1 - p(frame, end - 10, 10);
  return fadeIn * fadeOut;
}

export const OpenThornAd = ({ includeAudio = true }: { includeAudio?: boolean }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: palette.bg, overflow: "hidden" }}>
      {/* Scene 1 — Logo reveal (0–68f) */}
      <AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.logo, SCENE_END.logo) }}>
        <LogoRevealScene />
      </AbsoluteFill>

      {/* Scene 2 — "Your keys." (60–158f) */}
      <AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.keys, SCENE_END.keys) }}>
        <StatementScene text="Your keys." accent={palette.purple} startFrame={SCENE.keys} />
      </AbsoluteFill>

      {/* Scene 3 — "Any provider." (150–248f) */}
      <AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.provider, SCENE_END.provider) }}>
        <ProviderScene startFrame={SCENE.provider} />
      </AbsoluteFill>

      {/* Scene 4 — "No platform tax." (240–338f) */}
      <AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.tax, SCENE_END.tax) }}>
        <StatementScene text="No platform tax." accent={palette.amber} startFrame={SCENE.tax} />
      </AbsoluteFill>

      {/* Scene 5 — Final (330–450f) */}
      <AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.final, SCENE_END.final, true) }}>
        <FinalScene startFrame={SCENE.final} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Stubs — implemented in subsequent tasks
function LogoRevealScene() {
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 60, height: 60, borderRadius: "50%", background: palette.purple, opacity: 0.3 }} />
    </AbsoluteFill>
  );
}

function StatementScene(_props: { text: string; accent: string; startFrame: number }) {
  return null;
}

function ProviderScene(_props: { startFrame: number }) {
  return null;

}

function FinalScene(_props: { startFrame: number }) {
  return null;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd remotion && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add remotion/src/OpenThornAd.tsx
git commit -m "feat: scaffold OpenThornAd composition with scene structure"
```

---

### Task 3: Implement LogoRevealScene

**Files:**
- Modify: `remotion/src/OpenThornAd.tsx` — replace `LogoRevealScene`

- [ ] **Step 1: Replace the LogoRevealScene stub**

In `remotion/src/OpenThornAd.tsx`, replace:
```tsx
function LogoRevealScene() {
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 60, height: 60, borderRadius: "50%", background: palette.purple, opacity: 0.3 }} />
    </AbsoluteFill>
  );
}
```

With:
```tsx
function LogoRevealScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 100, mass: 0.9 },
  });

  const glow = interpolate(frame, [0, 40, 68], [0, 0.72, 0.52], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {/* Radial purple glow behind logo */}
      <div
        style={{
          position: "absolute",
          width: 560,
          height: 560,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${palette.purple}55 0%, transparent 70%)`,
          opacity: glow,
          filter: "blur(60px)",
        }}
      />
      {/* Logo mark */}
      <Img
        src={staticFile("logo.png")}
        style={{
          width: 128,
          height: 128,
          objectFit: "contain",
          transform: `scale(${0.6 + scale * 0.4})`,
          position: "relative",
        }}
      />
    </AbsoluteFill>
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd remotion && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add remotion/src/OpenThornAd.tsx
git commit -m "feat: implement LogoRevealScene with spring scale and purple glow"
```

---

### Task 4: Implement StatementScene

**Files:**
- Modify: `remotion/src/OpenThornAd.tsx` — replace `StatementScene`

This component is shared by Scene 2 ("Your keys.", purple) and Scene 4 ("No platform tax.", amber).

- [ ] **Step 1: Replace the StatementScene stub**

In `remotion/src/OpenThornAd.tsx`, replace:
```tsx
function StatementScene(_props: { text: string; accent: string; startFrame: number }) {
  return null;
}
```

With:
```tsx
function StatementScene({
  text,
  accent,
  startFrame,
}: {
  text: string;
  accent: string;
  startFrame: number;
}) {
  const frame = useCurrentFrame();
  const local = frame - startFrame;

  const textIn = p(local, 0, 18);
  const underlineIn = p(local, 14, 18);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", display: "inline-block" }}>
        {/* Statement text */}
        <div
          style={{
            fontFamily: fraunces,
            fontSize: 180,
            fontWeight: 300,
            color: palette.text,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            opacity: textIn,
            transform: `translateY(${(1 - textIn) * 24}px)`,
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          {text}
        </div>
        {/* Underline draws left-to-right */}
        <div
          style={{
            position: "absolute",
            bottom: -14,
            left: 0,
            height: 3,
            width: `${underlineIn * 100}%`,
            background: accent,
            borderRadius: 99,
            boxShadow: `0 0 20px ${accent}`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd remotion && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add remotion/src/OpenThornAd.tsx
git commit -m "feat: implement StatementScene with text reveal and underline draw"
```

---

### Task 5: Implement ProviderScene

**Files:**
- Modify: `remotion/src/OpenThornAd.tsx` — replace `ProviderScene`

- [ ] **Step 1: Replace the ProviderScene stub**

In `remotion/src/OpenThornAd.tsx`, replace:
```tsx
function ProviderScene(_props: { startFrame: number }) {
  return null;

}
```

With:
```tsx
const PROVIDERS = [
  { src: "openai.png", name: "OpenAI" },
  { src: "anthropic.png", name: "Anthropic" },
  { src: "google.png", name: "Google" },
  { src: "mistralai.png", name: "Mistral" },
  { src: "groq.png", name: "Groq" },
  { src: "deepseek.webp", name: "DeepSeek" },
] as const;

function ProviderScene({ startFrame }: { startFrame: number }) {
  const frame = useCurrentFrame();
  const local = frame - startFrame;

  const textIn = p(local, 0, 18);
  const underlineIn = p(local, 14, 18);

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 64,
      }}
    >
      {/* Statement text + teal underline */}
      <div style={{ position: "relative", display: "inline-block" }}>
        <div
          style={{
            fontFamily: fraunces,
            fontSize: 180,
            fontWeight: 300,
            color: palette.text,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            opacity: textIn,
            transform: `translateY(${(1 - textIn) * 24}px)`,
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          Any provider.
        </div>
        <div
          style={{
            position: "absolute",
            bottom: -14,
            left: 0,
            height: 3,
            width: `${underlineIn * 100}%`,
            background: palette.teal,
            borderRadius: 99,
            boxShadow: `0 0 20px ${palette.teal}`,
          }}
        />
      </div>

      {/* Provider logos — staggered fade-in, grayscale */}
      <div style={{ display: "flex", gap: 48, alignItems: "center" }}>
        {PROVIDERS.map(({ src, name }, i) => {
          const logoIn = p(local, 28 + i * 7, 16);
          return (
            <div
              key={name}
              style={{
                opacity: logoIn * 0.5,
                transform: `translateY(${(1 - logoIn) * 14}px)`,
              }}
            >
              <Img
                src={staticFile(src)}
                alt={name}
                style={{
                  height: 44,
                  width: "auto",
                  maxWidth: 100,
                  objectFit: "contain",
                  filter: "grayscale(1) brightness(1.4)",
                }}
              />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd remotion && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add remotion/src/OpenThornAd.tsx
git commit -m "feat: implement ProviderScene with staggered grayscale logo row"
```

---

### Task 6: Implement FinalScene

**Files:**
- Modify: `remotion/src/OpenThornAd.tsx` — replace `FinalScene`

- [ ] **Step 1: Replace the FinalScene stub**

In `remotion/src/OpenThornAd.tsx`, replace:
```tsx
function FinalScene(_props: { startFrame: number }) {
  return null;
}
```

With:
```tsx
function FinalScene({ startFrame }: { startFrame: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;

  const logoScale = spring({
    frame: local,
    fps,
    config: { damping: 18, stiffness: 100, mass: 0.9 },
  });

  const nameIn = p(local, 18, 22);
  const taglineIn = p(local, 36, 22);
  const urlIn = p(local, 54, 22);

  const glow = interpolate(local, [0, 60, 100], [0, 0.6, 0.42], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fade entire scene to black in final 20 frames
  const fadeToBlack = interpolate(local, [100, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}
    >
      {/* Rotating tri-color glow */}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          opacity: glow,
          background: `conic-gradient(from 0deg, ${palette.purple}44, ${palette.teal}33, ${palette.amber}33, ${palette.purple}44)`,
          filter: "blur(90px)",
          transform: `rotate(${local * 0.4}deg)`,
        }}
      />

      {/* Logo mark */}
      <Img
        src={staticFile("logo.png")}
        style={{
          width: 128,
          height: 128,
          objectFit: "contain",
          transform: `scale(${0.6 + logoScale * 0.4})`,
          position: "relative",
          zIndex: 1,
        }}
      />

      {/* Wordmark */}
      <div
        style={{
          fontFamily: fraunces,
          fontSize: 72,
          fontWeight: 300,
          color: palette.text,
          letterSpacing: "-0.02em",
          marginTop: 32,
          opacity: nameIn,
          transform: `translateY(${(1 - nameIn) * 20}px)`,
          position: "relative",
          zIndex: 1,
          userSelect: "none",
        }}
      >
        OpenThorn
      </div>

      {/* Tagline */}
      <div
        style={{
          fontFamily: roboto,
          fontSize: 28,
          fontWeight: 400,
          color: palette.muted,
          marginTop: 20,
          opacity: taglineIn,
          transform: `translateY(${(1 - taglineIn) * 14}px)`,
          position: "relative",
          zIndex: 1,
          userSelect: "none",
        }}
      >
        Build for free.
      </div>

      {/* URL */}
      <div
        style={{
          fontFamily: roboto,
          fontSize: 24,
          fontWeight: 400,
          color: palette.purple,
          marginTop: 12,
          opacity: urlIn,
          transform: `translateY(${(1 - urlIn) * 12}px)`,
          position: "relative",
          zIndex: 1,
          userSelect: "none",
        }}
      >
        openthorn.app
      </div>

      {/* Black fade overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#000",
          opacity: fadeToBlack,
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
    </AbsoluteFill>
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd remotion && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add remotion/src/OpenThornAd.tsx
git commit -m "feat: implement FinalScene with tri-color glow and fade to black"
```

---

### Task 7: Add AudioLayer and register composition

**Files:**
- Modify: `remotion/src/OpenThornAd.tsx` — add AudioLayer + wire into OpenThornAd
- Modify: `remotion/src/Root.tsx` — add OpenThornAd composition
- Modify: `remotion/package.json` — add render script

**Note:** AudioLayer references three files in `remotion/public/audio/`. They do not need to exist yet — Remotion only errors on missing audio during playback, not compilation. Place them before doing a final render (Task 8).

- [ ] **Step 1: Add imports for Audio and Sequence at the top of OpenThornAd.tsx**

At the top of `remotion/src/OpenThornAd.tsx`, update the remotion import line to add `Audio` and `Sequence`:

```tsx
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
```

- [ ] **Step 2: Add the AudioLayer function**

Add this function anywhere before `OpenThornAd` in `remotion/src/OpenThornAd.tsx`:

```tsx
function AudioLayer() {
  const { durationInFrames } = useVideoConfig();
  return (
    <>
      {/* Ambient pad — full duration, fades in/out */}
      <Audio
        src={staticFile("audio/openthorn-ad-ambient.wav")}
        volume={(f) =>
          interpolate(
            f,
            [0, 20, durationInFrames - 30, durationInFrames],
            [0, 0.25, 0.25, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          )
        }
      />
      {/* Whoosh SFX fires at each statement scene entry */}
      <Sequence from={SCENE.keys}>
        <Audio src={staticFile("audio/openthorn-ad-whoosh.wav")} volume={0.65} />
      </Sequence>
      <Sequence from={SCENE.provider}>
        <Audio src={staticFile("audio/openthorn-ad-whoosh.wav")} volume={0.65} />
      </Sequence>
      <Sequence from={SCENE.tax}>
        <Audio src={staticFile("audio/openthorn-ad-whoosh.wav")} volume={0.65} />
      </Sequence>
      {/* Chord fires on final scene entry */}
      <Sequence from={SCENE.final}>
        <Audio src={staticFile("audio/openthorn-ad-chord.wav")} volume={0.8} />
      </Sequence>
    </>
  );
}
```

- [ ] **Step 3: Wire AudioLayer into OpenThornAd**

Inside the `OpenThornAd` component return, add `{includeAudio && <AudioLayer />}` as the first child of the outer `AbsoluteFill`:

```tsx
export const OpenThornAd = ({ includeAudio = true }: { includeAudio?: boolean }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: palette.bg, overflow: "hidden" }}>
      {includeAudio && <AudioLayer />}   {/* ← add this line */}

      {/* Scene 1 — Logo reveal (0–68f) */}
      // ... rest unchanged
```

- [ ] **Step 4: Update Root.tsx to register OpenThornAd**

Replace `remotion/src/Root.tsx` with:

```tsx
import { Composition } from "remotion";
import { OpenThornLaunchAd } from "./OpenThornLaunchAd";
import { OpenThornAd } from "./OpenThornAd";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="OpenThornLaunchAd"
        component={OpenThornLaunchAd}
        durationInFrames={600}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="OpenThornAd"
        component={OpenThornAd}
        durationInFrames={450}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ includeAudio: true }}
      />
    </>
  );
};
```

- [ ] **Step 5: Add render script to package.json**

In `remotion/package.json`, add to the `"scripts"` section:
```json
"render:ad": "remotion render OpenThornAd out/openthorn-ad.mp4"
```

- [ ] **Step 6: Verify compilation**

```bash
cd remotion && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add remotion/src/OpenThornAd.tsx remotion/src/Root.tsx remotion/package.json
git commit -m "feat: add AudioLayer, register OpenThornAd composition, add render script"
```

---

### Task 8: Source audio files and do a full preview

**Files:**
- Place: `remotion/public/audio/openthorn-ad-ambient.wav`
- Place: `remotion/public/audio/openthorn-ad-whoosh.wav`
- Place: `remotion/public/audio/openthorn-ad-chord.wav`

- [ ] **Step 1: Create the audio directory**

```bash
mkdir -p remotion/public/audio
```

- [ ] **Step 2: Source three audio files**

Find and place these files in `remotion/public/audio/`:

| Filename | Description | Where to find |
|----------|-------------|---------------|
| `openthorn-ad-ambient.wav` | Sparse dark ambient electronic pad, 15–20s, low drone | Freesound.org: search "dark ambient drone minimal" |
| `openthorn-ad-whoosh.wav` | Short (~0.4s) high-frequency UI sweep | Freesound.org: search "ui whoosh" or "interface swoosh" |
| `openthorn-ad-chord.wav` | Single warm cinematic chord, 2–3s with natural decay | Freesound.org: search "cinematic chord hit" |

- [ ] **Step 3: Launch Remotion Studio and preview the full ad**

```bash
cd remotion && npm run dev
```

Open `http://localhost:3000`. Select `OpenThornAd`. Scrub through and verify:

| Frame range | Expected |
|-------------|----------|
| 0–60 | Logo spring-scales in, purple glow blooms behind it |
| 60–68 | Logo fades out as Scene 2 fades in (crossfade) |
| 60–158 | "Your keys." fades up, purple underline draws right |
| 150–158 | "Your keys." fades out as Scene 3 fades in |
| 150–248 | "Any provider." + 6 grayscale logos stagger in |
| 240–338 | "No platform tax." fades up, amber underline draws right |
| 330–450 | Logo springs in, "OpenThorn", "Build for free.", "openthorn.app" stagger, then fades to black |
| ~430–450 | Black fade-out complete |

- [ ] **Step 4: Render a single still at key frames to verify layout**

```bash
cd remotion && npx remotion still OpenThornAd --scale=0.5 --frame=90 out/still-scene2.png
npx remotion still OpenThornAd --scale=0.5 --frame=195 out/still-scene3.png
npx remotion still OpenThornAd --scale=0.5 --frame=390 out/still-final.png
```

- [ ] **Step 5: Commit audio files**

```bash
git add remotion/public/audio/
git commit -m "feat: add audio files for OpenThorn ad"
```

- [ ] **Step 6: Render final MP4 (optional — requires Remotion license or free quota)**

```bash
cd remotion && npm run render:ad
```
Expected: `out/openthorn-ad.mp4` created, 15 seconds, 1920×1080.
