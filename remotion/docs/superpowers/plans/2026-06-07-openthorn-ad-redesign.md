# OpenThorn Ad Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `OpenThornAd` to Apple-style cinematic split-screen — video panel on one half, text on the other, with film grain overlay and elevated Scene 1 / Scene 5.

**Architecture:** All changes are confined to `src/OpenThornAd.tsx`. New helper components (`GrainOverlay`, `HairlineSeparator`, `VideoPanel`, `SplitHalf`, `SplitTextBlock`) are added at the bottom of the file. Existing `StatementScene` and `ProviderScene` are replaced by scene-specific components (`KeysScene`, `ProviderSplitScene`, `TaxScene`). `LogoRevealScene` and `FinalScene` are updated in place.

**Tech Stack:** Remotion 4.0.473, React 19, TypeScript — no new dependencies.

---

## File Map

- Modify: `src/OpenThornAd.tsx` — all changes are in this one file

---

### Task 1: Add GrainOverlay and HairlineSeparator

**Files:**
- Modify: `src/OpenThornAd.tsx`

- [ ] **Step 1: Add GrainOverlay component** — paste this near the bottom of the file, above the `p()` helper:

```tsx
function GrainOverlay() {
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23n)' opacity='0.12'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat",
        backgroundSize: "256px 256px",
        opacity: 0.45,
        mixBlendMode: "overlay",
      }}
    />
  );
}
```

- [ ] **Step 2: Add HairlineSeparator component** — paste directly below `GrainOverlay`:

```tsx
function HairlineSeparator({ startFrame, endFrame }: { startFrame: number; endFrame: number }) {
  const frame = useCurrentFrame();
  const fadeIn = p(frame, startFrame, 12);
  const fadeOut = 1 - p(frame, endFrame - 12, 12);
  const opacity = fadeIn * fadeOut;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: 60,
        bottom: 60,
        width: 1,
        transform: "translateX(-0.5px)",
        background: "rgba(255,255,255,0.14)",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
}
```

- [ ] **Step 3: Add GrainOverlay to the main OpenThornAd composition** — it goes as the LAST child inside the outermost `<AbsoluteFill>`, after all scene layers:

```tsx
export const OpenThornAd = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: palette.bg, overflow: "hidden" }}>
      {/* ... all existing scene layers ... */}
      <GrainOverlay />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 4: Verify grain is visible** — run a still render at frame 60 and check the PNG for subtle texture:

```bash
npx remotion still OpenThornAd --frame=60 --scale=0.5 out/still-grain-check.png
```

Expected: PNG renders without error, grain texture is faintly visible over the dark background.

- [ ] **Step 5: Commit**

```bash
git add src/OpenThornAd.tsx
git commit -m "feat: add film grain overlay and hairline separator components"
```

---

### Task 2: Add VideoPanel and SplitHalf helpers

**Files:**
- Modify: `src/OpenThornAd.tsx`

- [ ] **Step 1: Add SplitHalf layout helper** — paste below `HairlineSeparator`:

```tsx
function SplitHalf({
  side,
  children,
}: {
  side: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        [side]: 0,
        width: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Add VideoPanel component** — paste below `SplitHalf`. It wraps the clip in a `<Sequence>` so it always starts from its first frame when its scene begins:

```tsx
function VideoPanel({
  src,
  startFrame,
  durationInFrames,
  slideFrom,
}: {
  src: string;
  startFrame: number;
  durationInFrames: number;
  slideFrom: "left" | "right";
}) {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const slideIn = p(local, 0, 22);
  const dir = slideFrom === "left" ? -1 : 1;

  return (
    <div
      style={{
        width: 820,
        height: 560,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 32px 120px rgba(0,0,0,0.6)",
        overflow: "hidden",
        opacity: slideIn,
        transform: `translateX(${(1 - slideIn) * dir * 60}px)`,
        flexShrink: 0,
      }}
    >
      <Sequence from={startFrame} durationInFrames={durationInFrames}>
        <Video
          src={staticFile(src)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          muted
        />
      </Sequence>
    </div>
  );
}
```

- [ ] **Step 3: Add SplitTextBlock component** — paste below `VideoPanel`. Used for scenes 2 and 4:

```tsx
function SplitTextBlock({
  headline,
  support,
  accent,
  startFrame,
  slideFrom,
  fontSize = 150,
}: {
  headline: string;
  support: string;
  accent: string;
  startFrame: number;
  slideFrom: "left" | "right";
  fontSize?: number;
}) {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const textIn = p(local, 0, 22);
  const supportIn = p(local, 12, 18);
  const underlineIn = p(local, 14, 18);
  const dir = slideFrom === "left" ? -1 : 1;

  return (
    <div style={{ padding: "0 72px", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", height: "100%" }}>
      <div style={{ position: "relative", display: "inline-block" }}>
        <div
          style={{
            fontFamily: fraunces,
            fontSize,
            fontWeight: 300,
            color: palette.text,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            whiteSpace: "nowrap",
            opacity: textIn,
            transform: `translateX(${(1 - textIn) * dir * -60}px)`,
            userSelect: "none",
          }}
        >
          {headline}
        </div>
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
      <div
        style={{
          fontFamily: roboto,
          fontSize: 28,
          fontWeight: 400,
          color: palette.muted,
          marginTop: 36,
          opacity: supportIn,
          transform: `translateX(${(1 - supportIn) * dir * -40}px)`,
          userSelect: "none",
        }}
      >
        {support}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/OpenThornAd.tsx
git commit -m "feat: add VideoPanel, SplitHalf, SplitTextBlock helper components"
```

---

### Task 3: Elevate LogoRevealScene (Scene 1)

**Files:**
- Modify: `src/OpenThornAd.tsx` — update `LogoRevealScene`

- [ ] **Step 1: Replace the `LogoRevealScene` function** with this upgraded version (larger glow, snappier spring, 112px headline):

```tsx
function LogoRevealScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 140, mass: 0.8 },
  });

  const glow = interpolate(frame, [0, 36, 120], [0, 0.85, 0.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const nameIn = p(frame, 14, 22);
  const tagIn = p(frame, 28, 20);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <div
        style={{
          position: "absolute",
          width: 720,
          height: 720,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${palette.purple}55 0%, transparent 70%)`,
          opacity: glow,
          filter: "blur(80px)",
        }}
      />
      <Img
        src={staticFile("logo.png")}
        style={{
          width: 128,
          height: 128,
          objectFit: "contain",
          transform: `scale(${0.5 + scale * 0.5})`,
          position: "relative",
        }}
      />
      <div
        style={{
          fontFamily: fraunces,
          fontSize: 112,
          fontWeight: 300,
          color: palette.text,
          letterSpacing: "-0.02em",
          marginTop: 36,
          opacity: nameIn,
          transform: `translateY(${(1 - nameIn) * 20}px)`,
          userSelect: "none",
          position: "relative",
        }}
      >
        Meet OpenThorn.
      </div>
      <div
        style={{
          fontFamily: roboto,
          fontSize: 28,
          fontWeight: 400,
          color: palette.muted,
          marginTop: 16,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          opacity: tagIn,
          transform: `translateY(${(1 - tagIn) * 12}px)`,
          userSelect: "none",
          position: "relative",
        }}
      >
        AI Website Builder
      </div>
    </AbsoluteFill>
  );
}
```

- [ ] **Step 2: Verify Scene 1 renders correctly** at frames 0, 30, and 90:

```bash
npx remotion still OpenThornAd --frame=0 --scale=0.5 out/s1-f0.png
npx remotion still OpenThornAd --frame=30 --scale=0.5 out/s1-f30.png
npx remotion still OpenThornAd --frame=90 --scale=0.5 out/s1-f90.png
```

Expected: frame 0 shows logo mid-spring, frame 30 shows logo settled with "Meet OpenThorn." fully in, frame 90 shows full Scene 1 at peak glow.

- [ ] **Step 3: Commit**

```bash
git add src/OpenThornAd.tsx
git commit -m "feat: elevate Scene 1 logo reveal (stronger glow, snappier spring, 112px headline)"
```

---

### Task 4: KeysScene — Scene 2 split layout

**Files:**
- Modify: `src/OpenThornAd.tsx`

- [ ] **Step 1: Add KeysScene component** — paste above `LogoRevealScene`:

```tsx
function KeysScene({ startFrame }: { startFrame: number }) {
  return (
    <>
      <SplitHalf side="left">
        <VideoPanel
          src="scene2.mp4"
          startFrame={startFrame}
          durationInFrames={SCENE_END.keys - startFrame + 20}
          slideFrom="left"
        />
      </SplitHalf>
      <SplitHalf side="right">
        <SplitTextBlock
          headline="Your keys."
          support="Your data. Your control."
          accent={palette.purple}
          startFrame={startFrame}
          slideFrom="right"
        />
      </SplitHalf>
    </>
  );
}
```

- [ ] **Step 2: Replace Scene 2 in the main OpenThornAd render** — find the Scene 2 block and replace it. Also remove the old `<Sequence>` + `<Video>` + overlay `<div>` that were added previously:

Old block:
```tsx
{/* Scene 2 — "Your keys." (112–210f) */}
<AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.keys, SCENE_END.keys) }}>
  <Sequence from={SCENE.keys} durationInFrames={SCENE_END.keys - SCENE.keys + 20}>
    <Video src={staticFile("scene2.mp4")} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.38 }} muted />
  </Sequence>
  <div style={{ position: "absolute", inset: 0, background: "rgba(9,7,11,0.5)" }} />
  <StatementScene text="Your keys." accent={palette.purple} startFrame={SCENE.keys} />
</AbsoluteFill>
```

New block:
```tsx
{/* Scene 2 — "Your keys." (112–210f) */}
<AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.keys, SCENE_END.keys) }}>
  <KeysScene startFrame={SCENE.keys} />
</AbsoluteFill>
```

- [ ] **Step 3: Add HairlineSeparator for Scene 2** — in the main `OpenThornAd` render, between the scene layers and before `<GrainOverlay />`, add a separator for each split scene:

```tsx
<HairlineSeparator startFrame={SCENE.keys} endFrame={SCENE_END.keys} />
```

- [ ] **Step 4: Verify Scene 2** at frames 120, 150, and 200:

```bash
npx remotion still OpenThornAd --frame=120 --scale=0.5 out/s2-f120.png
npx remotion still OpenThornAd --frame=150 --scale=0.5 out/s2-f150.png
npx remotion still OpenThornAd --frame=200 --scale=0.5 out/s2-f200.png
```

Expected: video panel slides in from left, "Your keys." slides in from right, hairline separator visible between halves. Frame 200 should show slight fade-out beginning.

- [ ] **Step 5: Commit**

```bash
git add src/OpenThornAd.tsx
git commit -m "feat: Scene 2 split screen layout — video left, 'Your keys.' right"
```

---

### Task 5: ProviderSplitScene — Scene 3 split layout

**Files:**
- Modify: `src/OpenThornAd.tsx`

- [ ] **Step 1: Add ProviderSplitScene component** — paste above `KeysScene`:

```tsx
function ProviderSplitScene({ startFrame }: { startFrame: number }) {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const textIn = p(local, 0, 22);
  const underlineIn = p(local, 14, 18);

  return (
    <>
      <SplitHalf side="left">
        <div style={{ padding: "0 72px", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", height: "100%" }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <div
              style={{
                fontFamily: fraunces,
                fontSize: 150,
                fontWeight: 300,
                color: palette.text,
                lineHeight: 1,
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
                opacity: textIn,
                transform: `translateX(${(1 - textIn) * 60}px)`,
                userSelect: "none",
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
          <div style={{ display: "flex", gap: 36, alignItems: "center", marginTop: 52, flexWrap: "wrap" }}>
            {PROVIDERS.map(({ src, name }, i) => {
              const logoIn = p(local, 28 + i * 7, 16);
              return (
                <div key={name} style={{ opacity: logoIn * 0.55, transform: `translateY(${(1 - logoIn) * 14}px)` }}>
                  <Img
                    src={staticFile(src)}
                    alt={name}
                    style={{ height: 44, width: "auto", maxWidth: 100, objectFit: "contain", filter: "grayscale(1) brightness(1.4)" }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </SplitHalf>
      <SplitHalf side="right">
        <VideoPanel
          src="scene3.mp4"
          startFrame={startFrame}
          durationInFrames={SCENE_END.provider - startFrame + 20}
          slideFrom="right"
        />
      </SplitHalf>
    </>
  );
}
```

- [ ] **Step 2: Replace Scene 3 in the main OpenThornAd render:**

Old block:
```tsx
{/* Scene 3 — "Any provider." (202–300f) */}
<AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.provider, SCENE_END.provider) }}>
  <Sequence from={SCENE.provider} durationInFrames={SCENE_END.provider - SCENE.provider + 20}>
    <Video src={staticFile("scene3.mp4")} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.38 }} muted />
  </Sequence>
  <div style={{ position: "absolute", inset: 0, background: "rgba(9,7,11,0.5)" }} />
  <ProviderScene startFrame={SCENE.provider} />
</AbsoluteFill>
```

New block:
```tsx
{/* Scene 3 — "Any provider." (202–300f) */}
<AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.provider, SCENE_END.provider) }}>
  <ProviderSplitScene startFrame={SCENE.provider} />
</AbsoluteFill>
```

- [ ] **Step 3: Add HairlineSeparator for Scene 3** — next to the Scene 2 separator:

```tsx
<HairlineSeparator startFrame={SCENE.provider} endFrame={SCENE_END.provider} />
```

- [ ] **Step 4: Verify Scene 3** at frames 210, 250, and 295:

```bash
npx remotion still OpenThornAd --frame=210 --scale=0.5 out/s3-f210.png
npx remotion still OpenThornAd --frame=250 --scale=0.5 out/s3-f250.png
npx remotion still OpenThornAd --frame=295 --scale=0.5 out/s3-f295.png
```

Expected: "Any provider." text left, provider logos staggered below, video panel right. Hairline separator visible.

- [ ] **Step 5: Commit**

```bash
git add src/OpenThornAd.tsx
git commit -m "feat: Scene 3 split screen layout — 'Any provider.' left, video right"
```

---

### Task 6: TaxScene — Scene 4 split layout

**Files:**
- Modify: `src/OpenThornAd.tsx`

- [ ] **Step 1: Add TaxScene component** — paste above `ProviderSplitScene`. Use `fontSize={110}` because "No platform tax." is longer:

```tsx
function TaxScene({ startFrame }: { startFrame: number }) {
  return (
    <>
      <SplitHalf side="left">
        <VideoPanel
          src="scene4.mp4"
          startFrame={startFrame}
          durationInFrames={SCENE_END.tax - startFrame + 20}
          slideFrom="left"
        />
      </SplitHalf>
      <SplitHalf side="right">
        <SplitTextBlock
          headline="No platform tax."
          support="No markup. No lock-in."
          accent={palette.amber}
          startFrame={startFrame}
          slideFrom="right"
          fontSize={110}
        />
      </SplitHalf>
    </>
  );
}
```

- [ ] **Step 2: Replace Scene 4 in the main OpenThornAd render:**

Old block:
```tsx
{/* Scene 4 — "No platform tax." (292–390f) */}
<AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.tax, SCENE_END.tax) }}>
  <Sequence from={SCENE.tax} durationInFrames={SCENE_END.tax - SCENE.tax + 20}>
    <Video src={staticFile("scene4.mp4")} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.38 }} muted />
  </Sequence>
  <div style={{ position: "absolute", inset: 0, background: "rgba(9,7,11,0.5)" }} />
  <StatementScene text="No platform tax." accent={palette.amber} startFrame={SCENE.tax} />
</AbsoluteFill>
```

New block:
```tsx
{/* Scene 4 — "No platform tax." (292–390f) */}
<AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.tax, SCENE_END.tax) }}>
  <TaxScene startFrame={SCENE.tax} />
</AbsoluteFill>
```

- [ ] **Step 3: Add HairlineSeparator for Scene 4:**

```tsx
<HairlineSeparator startFrame={SCENE.tax} endFrame={SCENE_END.tax} />
```

- [ ] **Step 4: Verify Scene 4** at frames 300, 340, and 385:

```bash
npx remotion still OpenThornAd --frame=300 --scale=0.5 out/s4-f300.png
npx remotion still OpenThornAd --frame=340 --scale=0.5 out/s4-f340.png
npx remotion still OpenThornAd --frame=385 --scale=0.5 out/s4-f385.png
```

Expected: video left, "No platform tax." right at 110px, amber underline, "No markup. No lock-in." support copy visible.

- [ ] **Step 5: Commit**

```bash
git add src/OpenThornAd.tsx
git commit -m "feat: Scene 4 split screen layout — video left, 'No platform tax.' right"
```

---

### Task 7: Elevate FinalScene (Scene 5)

**Files:**
- Modify: `src/OpenThornAd.tsx` — update `FinalScene`

- [ ] **Step 1: Replace the FinalScene function** with this version (low-opacity background video, stronger glow, earlier fade):

```tsx
function FinalScene({ startFrame }: { startFrame: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;

  const logoScale = spring({
    frame: local,
    fps,
    config: { damping: 16, stiffness: 140, mass: 0.8 },
  });

  const nameIn = p(local, 18, 22);
  const taglineIn = p(local, 36, 22);
  const urlIn = p(local, 54, 22);

  const glow = interpolate(local, [0, 60, 100], [0, 0.65, 0.45], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeToBlack = interpolate(local, [100, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      {/* Low-opacity background footage */}
      <Sequence from={startFrame} durationInFrames={SCENE_END.final - startFrame + 20}>
        <Video
          src={staticFile("scene5.mp4")}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.28 }}
          muted
        />
      </Sequence>
      <div style={{ position: "absolute", inset: 0, background: "rgba(9,7,11,0.6)" }} />

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
          transform: `scale(${0.5 + logoScale * 0.5})`,
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

- [ ] **Step 2: Replace Scene 5 in the main OpenThornAd render** — remove the old Sequence/Video/overlay pattern:

Old block:
```tsx
{/* Scene 5 — Final (382–510f) */}
<AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.final, SCENE_END.final, true) }}>
  <Sequence from={SCENE.final} durationInFrames={SCENE_END.final - SCENE.final + 20}>
    <Video src={staticFile("scene5.mp4")} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.38 }} muted />
  </Sequence>
  <div style={{ position: "absolute", inset: 0, background: "rgba(9,7,11,0.5)" }} />
  <FinalScene startFrame={SCENE.final} />
</AbsoluteFill>
```

New block:
```tsx
{/* Scene 5 — Final (382–510f) */}
<AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.final, SCENE_END.final, true) }}>
  <FinalScene startFrame={SCENE.final} />
</AbsoluteFill>
```

- [ ] **Step 3: Verify Scene 5** at frames 400, 440, and 490:

```bash
npx remotion still OpenThornAd --frame=400 --scale=0.5 out/s5-f400.png
npx remotion still OpenThornAd --frame=440 --scale=0.5 out/s5-f440.png
npx remotion still OpenThornAd --frame=490 --scale=0.5 out/s5-f490.png
```

Expected: frame 400 shows logo springing in over subtle footage, frame 440 has full wordmark + tagline, frame 490 is nearly black from fade.

- [ ] **Step 4: Commit**

```bash
git add src/OpenThornAd.tsx
git commit -m "feat: elevate Scene 5 final (stronger glow, background footage at 28%, earlier fade)"
```

---

### Task 8: Cleanup — remove now-unused StatementScene and ProviderScene

**Files:**
- Modify: `src/OpenThornAd.tsx`

- [ ] **Step 1: Delete the `StatementScene` function** — it is no longer used anywhere. Remove the entire function.

- [ ] **Step 2: Delete the `ProviderScene` function** — it is no longer used anywhere. Remove the entire function.

- [ ] **Step 3: Run TypeScript check** to confirm no remaining references:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Full still verification** — render one frame per scene to confirm the complete video:

```bash
npx remotion still OpenThornAd --frame=60 --scale=0.5 out/final-s1.png
npx remotion still OpenThornAd --frame=160 --scale=0.5 out/final-s2.png
npx remotion still OpenThornAd --frame=250 --scale=0.5 out/final-s3.png
npx remotion still OpenThornAd --frame=340 --scale=0.5 out/final-s4.png
npx remotion still OpenThornAd --frame=440 --scale=0.5 out/final-s5.png
```

Expected: all five render without errors.

- [ ] **Step 5: Commit**

```bash
git add src/OpenThornAd.tsx
git commit -m "chore: remove unused StatementScene and ProviderScene"
```
