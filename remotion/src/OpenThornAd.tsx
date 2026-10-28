import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  random,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Video,
} from "remotion";
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadRoboto } from "@remotion/google-fonts/Roboto";

const { fontFamily: fraunces } = loadFraunces("normal", {
  weights: ["300", "400"],
  subsets: ["latin"],
});
const { fontFamily: roboto } = loadRoboto("normal", {
  weights: ["400", "500"],
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

const SCENE = {
  logo: 0,
  keys: 125,   // 4.15s
  provider: 218, // 7.25s
  tax: 390,    // 13s
  final: 488,  // 16.25s
} as const;

const SCENE_END = {
  logo: 133,
  keys: 226,
  provider: 398,
  tax: 496,
  final: 660,
} as const;

/** Smooth 0→1 with expo-out easing */
function p(frame: number, start: number, dur: number): number {
  return interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.19, 1, 0.22, 1),
  });
}

/** Scene opacity: fades in at start, fades out near end */
function sceneOpacity(frame: number, start: number, end: number, isLast = false): number {
  if (frame < start) return 0;
  if (!isLast && frame >= end) return 0;
  const fadeIn = p(frame, start, 10);
  const fadeOut = isLast ? 1 : 1 - p(frame, end - 10, 10);
  return fadeIn * fadeOut;
}

/** Gentle settle-in scale for a scene — 1.045 → 1 over the first ~26 frames */
function sceneScale(frame: number, start: number): number {
  const t = p(frame, start, 26);
  return 1.045 - t * 0.045;
}

export const OpenThornAd = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: palette.bg, overflow: "hidden" }}>
      <AudioLayer />

      {/* Ambient depth — drifting aurora + particles, runs under every scene */}
      <AuroraBackground />
      <ParticleField />

      {/* Scene 1 — Logo reveal (0–120f) */}
      <AbsoluteFill
        style={{
          opacity: sceneOpacity(frame, SCENE.logo, SCENE_END.logo),
          transform: `scale(${sceneScale(frame, SCENE.logo)})`,
        }}
      >
        <LogoRevealScene />
      </AbsoluteFill>

      {/* Scene 2 — "Your keys." (112–210f) */}
      <AbsoluteFill
        style={{
          opacity: sceneOpacity(frame, SCENE.keys, SCENE_END.keys),
          transform: `scale(${sceneScale(frame, SCENE.keys)})`,
        }}
      >
        <KeysScene startFrame={SCENE.keys} />
      </AbsoluteFill>

      {/* Scene 3 — "Any provider." (202–300f) */}
      <AbsoluteFill
        style={{
          opacity: sceneOpacity(frame, SCENE.provider, SCENE_END.provider),
          transform: `scale(${sceneScale(frame, SCENE.provider)})`,
        }}
      >
        <ProviderSplitScene startFrame={SCENE.provider} />
      </AbsoluteFill>

      {/* Scene 4 — "No platform tax." (292–390f) */}
      <AbsoluteFill
        style={{
          opacity: sceneOpacity(frame, SCENE.tax, SCENE_END.tax),
          transform: `scale(${sceneScale(frame, SCENE.tax)})`,
        }}
      >
        <TaxScene startFrame={SCENE.tax} />
      </AbsoluteFill>

      {/* Scene 5 — Final (382–510f) */}
      <AbsoluteFill
        style={{
          opacity: sceneOpacity(frame, SCENE.final, SCENE_END.final, true),
          transform: `scale(${sceneScale(frame, SCENE.final)})`,
        }}
      >
        <FinalScene startFrame={SCENE.final} />
      </AbsoluteFill>

      {/* Subtitles */}
      <CaptionLayer />

      {/* Cinematic finish — vignette under grain */}
      <Vignette />
      <GrainOverlay />
    </AbsoluteFill>
  );
};

// ─── Audio ────────────────────────────────────────────────────────────────────

function AudioLayer() {
  const { durationInFrames, fps } = useVideoConfig();

  return (
    <>
      {/* Ambient music bed — fades in over 0.8s, out over 1.2s */}
      <Audio
        src={staticFile("audio/openthorn-ad-ambient.wav")}
        loop
        volume={(f) =>
          interpolate(
            f,
            [0, Math.round(fps * 0.8), durationInFrames - Math.round(fps * 1.2), durationInFrames],
            [0, 0.32, 0.32, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />

      {/* Voiceover — fades in over 8 frames, plays to natural end */}
      <Sequence from={8}>
        <Audio
          src={staticFile("audio/openthorn-ad-voice.mp3")}
          volume={(f) =>
            interpolate(f, [0, 8], [0, 0.95], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          }
        />
      </Sequence>

      {/* Chord on logo reveal */}
      <Sequence from={SCENE.logo} durationInFrames={Math.round(fps * 3)}>
        <Audio src={staticFile("audio/openthorn-ad-chord.wav")} volume={0.55} />
      </Sequence>

      {/* Whoosh at each scene cut */}
      <Sequence from={SCENE.keys} durationInFrames={fps}>
        <Audio src={staticFile("audio/openthorn-ad-whoosh.wav")} volume={0.5} />
      </Sequence>
      <Sequence from={SCENE.provider} durationInFrames={fps}>
        <Audio src={staticFile("audio/openthorn-ad-whoosh.wav")} volume={0.5} />
      </Sequence>
      <Sequence from={SCENE.tax} durationInFrames={fps}>
        <Audio src={staticFile("audio/openthorn-ad-whoosh.wav")} volume={0.5} />
      </Sequence>
      <Sequence from={SCENE.final} durationInFrames={fps}>
        <Audio src={staticFile("audio/openthorn-ad-whoosh.wav")} volume={0.4} />
      </Sequence>
    </>
  );
}

// ─── Ambient layers ─────────────────────────────────────────────────────────────

/** Three soft gradient blobs slowly orbiting — adds depth behind every scene */
function AuroraBackground() {
  const frame = useCurrentFrame();

  const blobs = [
    { color: palette.purple, size: 1100, cx: 0.28, cy: 0.3, rx: 160, ry: 110, speed: 0.012, phase: 0, alpha: "30" },
    { color: palette.teal, size: 900, cx: 0.74, cy: 0.66, rx: 140, ry: 130, speed: 0.009, phase: 2.1, alpha: "22" },
    { color: palette.amber, size: 760, cx: 0.52, cy: 0.12, rx: 120, ry: 90, speed: 0.007, phase: 4.4, alpha: "16" },
  ];

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {blobs.map((b, i) => {
        const x = b.cx * 1920 + Math.cos(frame * b.speed + b.phase) * b.rx;
        const y = b.cy * 1080 + Math.sin(frame * b.speed * 1.3 + b.phase) * b.ry;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - b.size / 2,
              top: y - b.size / 2,
              width: b.size,
              height: b.size,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${b.color}${b.alpha} 0%, transparent 68%)`,
              filter: "blur(70px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

/** Sparse dust motes drifting upward */
function ParticleField() {
  const frame = useCurrentFrame();
  const count = 16;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }).map((_, i) => {
        const x = random(`px-${i}`) * 1920;
        const size = 2 + random(`ps-${i}`) * 3;
        const speed = 0.25 + random(`pv-${i}`) * 0.45;
        const offset = random(`po-${i}`) * 1300;
        const cycle = 1300;
        const yRaw = (offset + frame * speed) % cycle;
        const y = 1130 - yRaw;
        // fade in/out near the wrap edges so respawns are invisible
        const edgeFade = interpolate(yRaw, [0, 120, cycle - 120, cycle], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const sway = Math.sin(frame * 0.02 + i * 1.7) * 18;
        const tint = i % 3 === 0 ? palette.teal : i % 3 === 1 ? palette.purple : palette.text;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x + sway,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              background: tint,
              opacity: edgeFade * (0.1 + random(`pa-${i}`) * 0.2),
              filter: "blur(0.5px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

function Vignette() {
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background:
          "radial-gradient(ellipse 78% 68% at 50% 46%, transparent 58%, rgba(0,0,0,0.42) 100%)",
      }}
    />
  );
}

// ─── Typography ─────────────────────────────────────────────────────────────────

/** Word-by-word masked rise — each word slides up out of an overflow-hidden mask */
function MaskedWords({
  text,
  startFrame,
  delayPerWord = 5,
  riseDuration = 26,
  style,
}: {
  text: string;
  startFrame: number;
  delayPerWord?: number;
  riseDuration?: number;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const words = text.split(" ");

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        columnGap: "0.26em",
        userSelect: "none",
        ...style,
      }}
    >
      {words.map((word, i) => {
        const t = p(frame, startFrame + i * delayPerWord, riseDuration);
        return (
          <span
            key={`${word}-${i}`}
            style={{
              display: "inline-block",
              overflow: "hidden",
              // breathing room so descenders aren't clipped by the mask
              paddingBottom: "0.14em",
              marginBottom: "-0.14em",
            }}
          >
            <span
              style={{
                display: "inline-block",
                transform: `translateY(${(1 - t) * 108}%)`,
                opacity: Math.min(1, t * 1.6),
              }}
            >
              {word}
            </span>
          </span>
        );
      })}
    </div>
  );
}

// ─── Scene Components ──────────────────────────────────────────────────────────

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

  const tagIn = p(frame, 34, 20);

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

      {/* Expanding concentric rings behind the logo */}
      {[0, 1, 2].map((i) => {
        const ringT = p(frame, 4 + i * 9, 70);
        const ringSize = 160 + ringT * (420 + i * 140);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              width: ringSize,
              height: ringSize,
              borderRadius: "50%",
              border: `1px solid ${palette.purple}`,
              opacity: (1 - ringT) * 0.35,
            }}
          />
        );
      })}

      <Img
        src={staticFile("logo.png")}
        style={{
          width: 128,
          height: 128,
          objectFit: "contain",
          transform: `scale(${0.5 + scale * 0.5})`,
          position: "relative",
          filter: `drop-shadow(0 0 ${24 * glow}px ${palette.purple}88)`,
        }}
      />

      <div style={{ marginTop: 36, position: "relative" }}>
        <MaskedWords
          text="Meet OpenThorn."
          startFrame={14}
          delayPerWord={7}
          style={{
            fontFamily: fraunces,
            fontSize: 112,
            fontWeight: 300,
            color: palette.text,
            letterSpacing: "-0.02em",
            justifyContent: "center",
          }}
        />
      </div>

      <div
        style={{
          fontFamily: roboto,
          fontSize: 26,
          fontWeight: 500,
          color: palette.muted,
          marginTop: 18,
          letterSpacing: "0.26em",
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

function KeysScene({ startFrame }: { startFrame: number }) {
  return (
    <>
      <SplitHalf side="left">
        <VideoPanel
          src="scene2.mp4"
          startFrame={startFrame}
          durationInFrames={SCENE_END.keys - startFrame + 20}
          slideFrom="left"
          accent={palette.purple}
        />
      </SplitHalf>
      <SplitHalf side="right">
        <SplitTextBlock
          headline="Your keys."
          support="Your data. Your control."
          accent={palette.purple}
          startFrame={startFrame}
        />
      </SplitHalf>
    </>
  );
}

const PROVIDERS = [
  { src: "openai.png", name: "OpenAI" },
  { src: "anthropic.png", name: "Anthropic" },
  { src: "google.png", name: "Google" },
  { src: "mistralai.png", name: "Mistral" },
  { src: "groq.png", name: "Groq" },
  { src: "deepseek.webp", name: "DeepSeek" },
] as const;

function ProviderSplitScene({ startFrame }: { startFrame: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;
  const underlineIn = p(local, 16, 18);

  return (
    <>
      <SplitHalf side="left">
        <div
          style={{
            padding: "0 72px",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            height: "100%",
            width: "100%",
          }}
        >
          <div style={{ position: "relative", display: "inline-block" }}>
            <MaskedWords
              text="Any provider."
              startFrame={startFrame}
              delayPerWord={6}
              style={{
                fontFamily: fraunces,
                fontSize: 150,
                fontWeight: 300,
                color: palette.text,
                lineHeight: 1,
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: -14,
                left: 0,
                height: 3,
                width: `${underlineIn * 100}%`,
                background: `linear-gradient(90deg, ${palette.teal}, ${palette.teal}44)`,
                borderRadius: 99,
                boxShadow: `0 0 20px ${palette.teal}`,
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              gap: 18,
              alignItems: "center",
              marginTop: 56,
              flexWrap: "wrap",
            }}
          >
            {PROVIDERS.map(({ src, name }, i) => {
              const pop = spring({
                frame: local - (30 + i * 6),
                fps,
                config: { damping: 14, stiffness: 160, mass: 0.7 },
              });
              return (
                <div
                  key={name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 22px",
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.055)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    backdropFilter: "blur(12px)",
                    boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
                    opacity: pop,
                    transform: `translateY(${(1 - pop) * 22}px) scale(${0.92 + pop * 0.08})`,
                  }}
                >
                  <Img
                    src={staticFile(src)}
                    alt={name}
                    style={{
                      height: 30,
                      width: "auto",
                      maxWidth: 70,
                      objectFit: "contain",
                      filter: "grayscale(1) brightness(1.6)",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: roboto,
                      fontSize: 21,
                      fontWeight: 500,
                      color: palette.muted,
                      userSelect: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name}
                  </span>
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
          accent={palette.teal}
        />
      </SplitHalf>
    </>
  );
}

function TaxScene({ startFrame }: { startFrame: number }) {
  return (
    <>
      <SplitHalf side="left">
        <VideoPanel
          src="scene4.mp4"
          startFrame={startFrame}
          durationInFrames={SCENE_END.tax - startFrame + 20}
          slideFrom="left"
          accent={palette.amber}
        />
      </SplitHalf>
      <SplitHalf side="right">
        <SplitTextBlock
          headline="No platform tax."
          support="No markup. No lock-in."
          accent={palette.amber}
          startFrame={startFrame}
          fontSize={110}
        />
      </SplitHalf>
    </>
  );
}

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
  const taglineIn = p(local, 38, 22);
  const ctaPop = spring({
    frame: local - 56,
    fps,
    config: { damping: 13, stiffness: 150, mass: 0.8 },
  });

  const glow = interpolate(local, [0, 60, 100], [0, 0.65, 0.45], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // shimmer sweep across the gradient wordmark
  const shimmerX = interpolate(local, [20, 110], [-60, 160], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeToBlack = interpolate(local, [152, 172], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      {/* Low-opacity background footage */}
      <Sequence from={startFrame} durationInFrames={SCENE_END.final - startFrame + 20}>
        <Video
          src={staticFile("scene5.mp4")}
          loop
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.28,
          }}
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

      <Img
        src={staticFile("logo.png")}
        style={{
          width: 128,
          height: 128,
          objectFit: "contain",
          transform: `scale(${0.5 + logoScale * 0.5})`,
          position: "relative",
          zIndex: 1,
          filter: `drop-shadow(0 0 ${22 * glow}px ${palette.purple}88)`,
        }}
      />

      {/* Gradient wordmark with shimmer sweep */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          marginTop: 32,
          fontFamily: fraunces,
          fontSize: 84,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          backgroundImage: `linear-gradient(100deg, ${palette.text} ${shimmerX - 40}%, ${palette.purple} ${shimmerX - 12}%, ${palette.teal} ${shimmerX}%, ${palette.text} ${shimmerX + 28}%)`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          opacity: nameIn,
          transform: `translateY(${(1 - nameIn) * 20}px)`,
          userSelect: "none",
        }}
      >
        OpenThorn
      </div>

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
          letterSpacing: "0.04em",
        }}
      >
        Build for free.
      </div>

      {/* CTA pill */}
      <div
        style={{
          marginTop: 30,
          padding: "16px 44px",
          borderRadius: 999,
          background: `linear-gradient(120deg, ${palette.purple}26, ${palette.teal}1f)`,
          border: `1px solid ${palette.purple}66`,
          boxShadow: `0 0 ${30 * glow}px ${palette.purple}55, inset 0 1px 0 rgba(255,255,255,0.12)`,
          opacity: ctaPop,
          transform: `translateY(${(1 - ctaPop) * 18}px) scale(${0.94 + ctaPop * 0.06})`,
          position: "relative",
          zIndex: 1,
        }}
      >
        <span
          style={{
            fontFamily: roboto,
            fontSize: 26,
            fontWeight: 500,
            color: palette.text,
            letterSpacing: "0.03em",
            userSelect: "none",
          }}
        >
          openthorn.app
        </span>
      </div>

      {/* Fade to black */}
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

// ─── Helper Components ─────────────────────────────────────────────────────────

function SplitHalf({ side, children }: { side: "left" | "right"; children: ReactNode }) {
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

function VideoPanel({
  src,
  startFrame,
  durationInFrames,
  slideFrom,
  accent,
}: {
  src: string;
  startFrame: number;
  durationInFrames: number;
  slideFrom: "left" | "right";
  accent: string;
}) {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const slideIn = p(local, 0, 26);
  const dir = slideFrom === "left" ? -1 : 1;

  // slow Ken Burns push-in across the panel's lifetime
  const kenBurns = interpolate(local, [0, durationInFrames], [1.04, 1.14], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        padding: 1.5,
        borderRadius: 18,
        background: `linear-gradient(145deg, ${accent}66, rgba(255,255,255,0.1) 38%, rgba(255,255,255,0.04) 62%, ${accent}33)`,
        boxShadow: `0 32px 120px rgba(0,0,0,0.6), 0 0 70px ${accent}1f`,
        opacity: slideIn,
        transform: `translateX(${(1 - slideIn) * dir * 70}px) scale(${0.97 + slideIn * 0.03})`,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 820,
          height: 560,
          borderRadius: 16.5,
          overflow: "hidden",
          position: "relative",
          background: palette.bg,
        }}
      >
        <Sequence from={startFrame} durationInFrames={durationInFrames}>
          {/* loop: some clips are shorter than their scene; seeking past the end stalls the render */}
          <Video
            src={staticFile(src)}
            loop
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${kenBurns})`,
            }}
            muted
          />
        </Sequence>
        {/* glass sheen across the top edge */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(165deg, rgba(255,255,255,0.09) 0%, transparent 26%)",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}

function SplitTextBlock({
  headline,
  support,
  accent,
  startFrame,
  fontSize = 150,
}: {
  headline: string;
  support: string;
  accent: string;
  startFrame: number;
  fontSize?: number;
}) {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const supportIn = p(local, 16, 20);
  const underlineIn = p(local, 14, 18);

  return (
    <div
      style={{
        padding: "0 72px",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        height: "100%",
        width: "100%",
      }}
    >
      <div style={{ position: "relative", display: "inline-block" }}>
        <MaskedWords
          text={headline}
          startFrame={startFrame}
          delayPerWord={6}
          style={{
            fontFamily: fraunces,
            fontSize,
            fontWeight: 300,
            color: palette.text,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            whiteSpace: "nowrap",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -14,
            left: 0,
            height: 3,
            width: `${underlineIn * 100}%`,
            background: `linear-gradient(90deg, ${accent}, ${accent}44)`,
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
          transform: `translateY(${(1 - supportIn) * 16}px)`,
          userSelect: "none",
          letterSpacing: "0.02em",
        }}
      >
        {support}
      </div>
    </div>
  );
}

const CAPTIONS = [
  { text: "Meet OpenThorn.", start: 14, end: 72 },
  { text: "An AI website builder that works the way you do.", start: 72, end: 132 },
  { text: "Your keys.", start: 134, end: 180 },
  { text: "Your data. Your control.", start: 180, end: 226 },
  { text: "Connect OpenAI, Anthropic, Gemini.", start: 228, end: 300 },
  { text: "Any provider you already trust.", start: 300, end: 364 },
  { text: "No subscriptions. No markup. No lock-in.", start: 396, end: 494 },
  { text: "OpenThorn.", start: 500, end: 554 },
  { text: "Build for free.", start: 554, end: 630 },
] as const;

function CaptionLayer() {
  const frame = useCurrentFrame();
  const caption = CAPTIONS.find(({ start, end }) => frame >= start && frame < end);

  if (!caption) return null;

  const fadeIn = p(frame, caption.start, 8);
  const fadeOut = 1 - p(frame, caption.end - 8, 8);
  const amount = fadeIn * fadeOut;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 64,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: "rgba(12,9,16,0.66)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: "10px 28px",
          maxWidth: 1200,
          opacity: amount,
          transform: `translateY(${(1 - amount) * 10}px)`,
        }}
      >
        <span
          style={{
            fontFamily: roboto,
            fontSize: 32,
            fontWeight: 400,
            color: palette.text,
            letterSpacing: "0.01em",
            userSelect: "none",
          }}
        >
          {caption.text}
        </span>
      </div>
    </div>
  );
}

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
