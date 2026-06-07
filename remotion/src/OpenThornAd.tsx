import type { ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
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

const SCENE = {
  logo: 0,
  keys: 112,
  provider: 202,
  tax: 292,
  final: 382,
} as const;

const SCENE_END = {
  logo: 120,
  keys: 210,
  provider: 300,
  tax: 390,
  final: 510,
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

export const OpenThornAd = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: palette.bg, overflow: "hidden" }}>
      {/* Scene 1 — Logo reveal (0–120f) */}
      <AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.logo, SCENE_END.logo) }}>
        <LogoRevealScene />
      </AbsoluteFill>

      {/* Scene 2 — "Your keys." (112–210f) */}
      <AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.keys, SCENE_END.keys) }}>
        <KeysScene startFrame={SCENE.keys} />
      </AbsoluteFill>

      {/* Scene 3 — "Any provider." (202–300f) */}
      <AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.provider, SCENE_END.provider) }}>
        <ProviderSplitScene startFrame={SCENE.provider} />
      </AbsoluteFill>

      {/* Scene 4 — "No platform tax." (292–390f) */}
      <AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.tax, SCENE_END.tax) }}>
        <TaxScene startFrame={SCENE.tax} />
      </AbsoluteFill>

      {/* Scene 5 — Final (382–510f) */}
      <AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.final, SCENE_END.final, true) }}>
        <FinalScene startFrame={SCENE.final} />
      </AbsoluteFill>

      {/* Hairline separators for split scenes — rendered above scene layers */}
      <HairlineSeparator startFrame={SCENE.keys} endFrame={SCENE_END.keys} />
      <HairlineSeparator startFrame={SCENE.provider} endFrame={SCENE_END.provider} />
      <HairlineSeparator startFrame={SCENE.tax} endFrame={SCENE_END.tax} />

      {/* Film grain — topmost layer */}
      <GrainOverlay />
    </AbsoluteFill>
  );
};

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
  const local = frame - startFrame;
  const textIn = p(local, 0, 22);
  const underlineIn = p(local, 14, 18);

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
                transform: `translateY(${(1 - textIn) * 24}px)`,
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
          <div
            style={{
              display: "flex",
              gap: 36,
              alignItems: "center",
              marginTop: 52,
              flexWrap: "wrap",
            }}
          >
            {PROVIDERS.map(({ src, name }, i) => {
              const logoIn = p(local, 28 + i * 7, 16);
              return (
                <div
                  key={name}
                  style={{
                    opacity: logoIn * 0.55,
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
        }}
      />
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
  const textIn = p(local, 0, 22);
  const supportIn = p(local, 12, 18);
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
            transform: `translateY(${(1 - textIn) * 24}px)`,
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
          transform: `translateY(${(1 - supportIn) * 16}px)`,
          userSelect: "none",
        }}
      >
        {support}
      </div>
    </div>
  );
}

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
