import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const palette = {
  ink: "#06110f",
  ink2: "#0b1716",
  panel: "rgba(255,255,255,0.085)",
  panelStrong: "rgba(255,255,255,0.13)",
  line: "rgba(231,255,245,0.14)",
  text: "#f5fff9",
  muted: "rgba(226,246,238,0.68)",
  green: "#5cf0ad",
  mint: "#b8ffd8",
  violet: "#a78bfa",
  blue: "#67d7ff",
  amber: "#ffd166",
  coral: "#ff7a6b",
};

const sceneRanges = [
  [0, 120],
  [120, 250],
  [250, 380],
  [380, 500],
  [500, 600],
] as const;

const sceneCuts = [120, 250, 380, 500] as const;

const voiceoverCaptions = [
  { text: "Meet OpenThorn.", start: 0, end: 48 },
  { text: "Prompt to production. No platform tax.", start: 48, end: 120 },
  { text: "Describe your idea. OpenThorn writes real code live.", start: 120, end: 250 },
  { text: "Bring your own AI keys. Keep your code.", start: 250, end: 380 },
  { text: "Export, deploy, or share with the community.", start: 380, end: 500 },
  { text: "OpenThorn is public. Start building.", start: 500, end: 600 },
] as const;

const elevenLabsVoiceoverRate = 1.13;

export const OpenThornLaunchAd = ({ includeAudio = true }: { includeAudio?: boolean }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: palette.ink, overflow: "hidden" }}>
      {includeAudio ? <AudioLayer /> : null}
      <Backplate />
      <SceneLayer range={sceneRanges[0]}>
        <HookScene />
      </SceneLayer>
      <SceneLayer range={sceneRanges[1]}>
        <BuildScene />
      </SceneLayer>
      <SceneLayer range={sceneRanges[2]}>
        <ControlScene />
      </SceneLayer>
      <SceneLayer range={sceneRanges[3]}>
        <ShipScene />
      </SceneLayer>
      <SceneLayer range={sceneRanges[4]} finalScene>
        <FinalScene />
      </SceneLayer>
      <TransitionThread />
      <CaptionLayer />
      <TimelineMark />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: interpolate(frame, [0, 90, 540, 600], [0.16, 0.08, 0.08, 0.18], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.05) 0, transparent 14%, transparent 86%, rgba(255,255,255,0.05) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

function SceneLayer({
  range,
  finalScene,
  children,
}: {
  range: readonly [number, number];
  finalScene?: boolean;
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const isActive = frame >= range[0] && (finalScene || frame < range[1]);
  const fadeIn = range[0] === 0 || frame >= range[0] ? 1 : 0;
  const fadeOut = finalScene ? 1 : 1 - progress(frame, range[1] - 8, 8);

  return (
    <AbsoluteFill
      style={{
        opacity: isActive ? fadeIn * fadeOut : 0,
        transform: `translateY(${(1 - fadeIn) * 26 - (1 - fadeOut) * 18}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

function AudioLayer() {
  const { durationInFrames } = useVideoConfig();

  return (
    <>
      <Audio
        src={staticFile("audio/openthorn-bed-sfx.wav")}
        volume={(audioFrame) =>
          interpolate(audioFrame, [0, 24, durationInFrames - 36, durationInFrames], [0, 0.34, 0.34, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
      <Audio
        src={staticFile("audio/openthorn-voiceover-elevenlabs.mp3")}
        playbackRate={elevenLabsVoiceoverRate}
        volume={0.9}
      />
    </>
  );
}

function CaptionLayer() {
  const frame = useCurrentFrame();
  const caption = voiceoverCaptions.find(({ start, end }) => frame >= start && frame < end);

  if (!caption) {
    return null;
  }

  const inAmount = progress(frame, caption.start, 10);
  const outAmount = 1 - progress(frame, caption.end - 10, 10);
  const amount = inAmount * outAmount;

  return (
    <div
      style={{
        position: "absolute",
        left: 360,
        right: 360,
        bottom: 72,
        minHeight: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px 22px",
        borderRadius: 8,
        background: "rgba(4,14,12,0.76)",
        border: `1px solid ${palette.line}`,
        boxShadow: "0 18px 70px rgba(0,0,0,0.28)",
        color: palette.text,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: 25,
        fontWeight: 850,
        lineHeight: 1.18,
        textAlign: "center",
        opacity: amount,
        transform: `translateY(${(1 - amount) * 14}px)`,
        pointerEvents: "none",
      }}
    >
      {caption.text}
    </div>
  );
}

function TransitionThread() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {sceneCuts.map((cut, index) => {
        const move = progress(frame, cut - 14, 28);
        const fadeIn = progress(frame, cut - 14, 8);
        const fadeOut = 1 - progress(frame, cut + 8, 12);
        const opacity = fadeIn * fadeOut;
        const x = interpolate(move, [0, 1], [-420, 2060], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const accent = [palette.green, palette.blue, palette.violet, palette.coral][index];

        return (
          <div key={cut}>
            <div
              style={{
                position: "absolute",
                left: x,
                top: -140,
                width: 220,
                height: 1360,
                transform: "rotate(12deg)",
                background: `linear-gradient(90deg, transparent, ${accent}55, rgba(255,255,255,0.22), transparent)`,
                filter: "blur(12px)",
                opacity: opacity * 0.9,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: x - 96,
                top: 188 + index * 118,
                width: 240,
                height: 3,
                background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
                opacity,
                transform: "rotate(12deg)",
                boxShadow: `0 0 32px ${accent}88`,
              }}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

function Backplate() {
  const frame = useCurrentFrame();
  const sweep = interpolate(frame, [0, 600], [-520, 2260], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, #04100f 0%, #0c1718 42%, #111421 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.48,
          backgroundImage:
            "linear-gradient(rgba(184,255,216,0.105) 1px, transparent 1px), linear-gradient(90deg, rgba(184,255,216,0.08) 1px, transparent 1px)",
          backgroundSize: "96px 96px",
          transform: `translate(${interpolate(frame, [0, 600], [0, -90])}px, ${interpolate(
            frame,
            [0, 600],
            [0, -54],
          )}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -140,
          bottom: -140,
          left: sweep,
          width: 280,
          transform: "rotate(15deg)",
          background:
            "linear-gradient(90deg, transparent, rgba(92,240,173,0.16), rgba(103,215,255,0.12), transparent)",
          filter: "blur(18px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.14) 0%, transparent 38%, rgba(0,0,0,0.34) 100%)",
        }}
      />
    </AbsoluteFill>
  );
}

function HookScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame;
  const logoScale = spring({
    frame: local,
    fps,
    config: { damping: 18, stiffness: 110, mass: 0.9 },
  });
  const promptChars = Math.floor(interpolate(local, [34, 94], [0, promptText.length], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  }));

  return (
    <Stage>
      <div style={{ position: "absolute", left: 132, top: 142, width: 840 }}>
        <BrandMark scale={0.86 + logoScale * 0.14} />
        <div style={{ marginTop: 42 }}>
          <Kicker delay={4}>Public launch</Kicker>
          <Headline delay={10} size={62} maxWidth={820}>
            Prompt to production.
            <br />
            No platform tax.
          </Headline>
        </div>
      </div>
      <div style={{ position: "absolute", right: 132, top: 176 }}>
        <PromptConsole text={promptText.slice(0, promptChars)} cursor={local % 28 < 16} width={690} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 132,
          bottom: 126,
          display: "flex",
          gap: 18,
          opacity: progress(local, 76, 24),
          transform: `translateY(${(1 - progress(local, 76, 24)) * 24}px)`,
        }}
      >
        <ValuePill accent={palette.green}>Prompt in</ValuePill>
        <ValuePill accent={palette.blue}>Production code out</ValuePill>
        <ValuePill accent={palette.amber}>No lock-in</ValuePill>
      </div>
    </Stage>
  );
}

function BuildScene() {
  const frame = useCurrentFrame();
  const local = frame - sceneRanges[1][0];
  const fileProgress = progress(local, 28, 76);

  return (
    <Stage>
      <div style={{ position: "absolute", left: 132, top: 136, width: 530 }}>
        <Kicker delay={0}>From prompt to production</Kicker>
        <Headline delay={8} size={62} maxWidth={520}>Real app files appear live.</Headline>
        <BodyCopy delay={24}>
          Watch real React, CSS, and project structure appear as a live preview compiles beside it.
        </BodyCopy>
      </div>
      <div style={{ position: "absolute", right: 118, top: 118 }}>
        <BuilderMockup fileProgress={fileProgress} local={local} compact />
      </div>
      <div
        style={{
          position: "absolute",
          left: 132,
          bottom: 126,
          width: 560,
          opacity: progress(local, 92, 28),
        }}
      >
        <MetricStrip
          items={[
            ["01", "Describe the site"],
            ["02", "Inspect generated code"],
            ["03", "Refine with chat"],
          ]}
        />
      </div>
    </Stage>
  );
}

function ControlScene() {
  const frame = useCurrentFrame();
  const local = frame - sceneRanges[2][0];

  return (
    <Stage>
      <div style={{ position: "absolute", left: 132, top: 136, width: 720 }}>
        <Kicker delay={0}>Bring your own keys</Kicker>
        <Headline delay={8}>Use the AI stack you already trust.</Headline>
        <BodyCopy delay={28}>
          Connect OpenAI, Anthropic, Gemini, Mistral, or your favorite provider. You pay them directly.
        </BodyCopy>
      </div>
      <div style={{ position: "absolute", right: 150, top: 116 }}>
        <ProviderConstellation local={local} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 132,
          bottom: 128,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          width: 800,
        }}
      >
        <FeatureTile delay={62} accent={palette.green} title="No markup" body="Provider pricing only" />
        <FeatureTile delay={74} accent={palette.violet} title="Your keys" body="Stored in your account" />
        <FeatureTile delay={86} accent={palette.blue} title="Your code" body="Export any time" />
      </div>
    </Stage>
  );
}

function ShipScene() {
  const frame = useCurrentFrame();
  const local = frame - sceneRanges[3][0];
  const deploy = progress(local, 52, 66);

  return (
    <Stage>
      <div style={{ position: "absolute", right: 132, top: 144, width: 660 }}>
        <Kicker delay={0}>When it is ready</Kicker>
        <Headline delay={8}>Ship it from your workspace.</Headline>
        <BodyCopy delay={26}>
          Push to GitHub, deploy to Netlify, download a ZIP, or publish to the OpenThorn community.
        </BodyCopy>
      </div>
      <div style={{ position: "absolute", left: 130, top: 118 }}>
        <DeployMap local={local} deploy={deploy} />
      </div>
      <div
        style={{
          position: "absolute",
          right: 132,
          bottom: 124,
          display: "flex",
          gap: 18,
          opacity: progress(local, 90, 24),
        }}
      >
        <ValuePill accent={palette.blue}>GitHub</ValuePill>
        <ValuePill accent={palette.green}>Deploy</ValuePill>
        <ValuePill accent={palette.coral}>Community</ValuePill>
      </div>
    </Stage>
  );
}

function FinalScene() {
  const frame = useCurrentFrame();
  const local = frame - sceneRanges[4][0];
  const glow = interpolate(local, [0, 82, 124], [0.12, 0.28, 0.2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 120,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 980,
          height: 980,
          background:
            "conic-gradient(from 210deg, rgba(92,240,173,0.0), rgba(92,240,173,0.20), rgba(103,215,255,0.14), rgba(167,139,250,0.18), rgba(92,240,173,0.0))",
          opacity: glow,
          filter: "blur(70px)",
          transform: `rotate(${local * 0.35}deg)`,
        }}
      />
      <div style={{ transform: `scale(${0.88 + spring({ frame: local, fps: 30 }) * 0.12})` }}>
        <BrandMark scale={1.2} centered />
      </div>
      <div
        style={{
          marginTop: 42,
          fontSize: 96,
          fontWeight: 900,
          lineHeight: 1,
          color: palette.text,
          opacity: progress(local, 18, 22),
          transform: `translateY(${(1 - progress(local, 18, 22)) * 26}px)`,
        }}
      >
        OpenThorn is public.
      </div>
      <div
        style={{
          marginTop: 30,
          color: palette.muted,
          fontSize: 34,
          lineHeight: 1.35,
          maxWidth: 980,
          opacity: progress(local, 44, 24),
        }}
      >
        Prompt to production. Your keys. Your code.
      </div>
      <div
        style={{
          marginTop: 48,
          opacity: progress(local, 74, 22),
          display: "inline-flex",
          alignItems: "center",
          gap: 18,
          padding: "24px 34px",
          borderRadius: 8,
          background: "rgba(92,240,173,0.16)",
          border: `1px solid rgba(92,240,173,0.48)`,
          color: palette.mint,
          fontSize: 28,
          fontWeight: 850,
          boxShadow: "0 20px 90px rgba(92,240,173,0.18)",
        }}
      >
        Start building with OpenThorn
      </div>
    </AbsoluteFill>
  );
}

const promptText = "Build a polished SaaS landing page and deploy it today.";

function Stage({ children }: { children: ReactNode }) {
  return (
    <AbsoluteFill
      style={{
        padding: "118px 132px",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

function BrandMark({ scale, centered }: { scale: number; centered?: boolean }) {
  const logoSrc = staticFile("openthorn-logo-128.png");

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: centered ? "center" : "flex-start",
        gap: 22,
        transform: `scale(${scale})`,
        transformOrigin: centered ? "center" : "left center",
      }}
    >
      <div
        style={{
          width: 112,
          height: 112,
          borderRadius: 28,
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.18)",
          display: "grid",
          placeItems: "center",
          boxShadow: "0 26px 90px rgba(92,240,173,0.18)",
        }}
      >
        <OpenThornLogoMark size={88} />
        <Img
          src={logoSrc}
          alt="OpenThorn"
          style={{
            position: "absolute",
            width: 88,
            height: 88,
            objectFit: "contain",
            filter: "drop-shadow(0 12px 28px rgba(167,139,250,0.28))",
          }}
        />
      </div>
      <span style={{ color: palette.text, fontSize: 42, fontWeight: 900 }}>OpenThorn</span>
    </div>
  );
}

function Kicker({ children, delay }: { children: ReactNode; delay: number }) {
  const frame = useCurrentFrame();
  const amount = progress(frame, delay, 20);
  return (
    <div
      style={{
        opacity: amount,
        transform: `translateY(${(1 - amount) * 18}px)`,
        color: palette.green,
        fontWeight: 850,
        fontSize: 22,
        textTransform: "uppercase",
        letterSpacing: 0,
        marginBottom: 24,
      }}
    >
      {children}
    </div>
  );
}

function Headline({
  children,
  delay,
  size = 92,
  maxWidth = 860,
}: {
  children: ReactNode;
  delay: number;
  size?: number;
  maxWidth?: number;
}) {
  const frame = useCurrentFrame();
  const amount = progress(frame, delay, 24);
  return (
    <h1
      style={{
        opacity: amount,
        transform: `translateY(${(1 - amount) * 26}px)`,
        margin: 0,
        color: palette.text,
        fontSize: size,
        lineHeight: 0.98,
        fontWeight: 950,
        letterSpacing: 0,
        maxWidth,
      }}
    >
      {children}
    </h1>
  );
}

function BodyCopy({ children, delay }: { children: ReactNode; delay: number }) {
  const frame = useCurrentFrame();
  const amount = progress(frame, delay, 24);
  return (
    <p
      style={{
        opacity: amount,
        transform: `translateY(${(1 - amount) * 16}px)`,
        marginTop: 30,
        color: palette.muted,
        fontSize: 30,
        lineHeight: 1.38,
        maxWidth: 780,
      }}
    >
      {children}
    </p>
  );
}

function PromptConsole({ text, cursor, width = 820 }: { text: string; cursor: boolean; width?: number }) {
  return (
    <div
      style={{
        width,
        minHeight: 336,
        borderRadius: 8,
        background: "rgba(245,255,249,0.92)",
        color: "#10201d",
        boxShadow: "0 34px 120px rgba(0,0,0,0.42)",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.36)",
      }}
    >
      <div
        style={{
          height: 58,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 22px",
          background: "#e8f4ee",
          borderBottom: "1px solid rgba(16,32,29,0.08)",
        }}
      >
        <Dot color={palette.coral} />
        <Dot color={palette.amber} />
        <Dot color={palette.green} />
        <span style={{ marginLeft: 18, color: "rgba(16,32,29,0.55)", fontWeight: 800, fontSize: 18 }}>
          prompt
        </span>
      </div>
      <div style={{ padding: 34 }}>
        <div style={{ color: "#58716b", fontSize: 20, fontWeight: 800, marginBottom: 20 }}>
          Tell OpenThorn what to build
        </div>
        <div style={{ fontSize: 34, lineHeight: 1.35, fontWeight: 760 }}>
          {text}
          <span style={{ opacity: cursor ? 1 : 0, color: "#0f5139" }}>|</span>
        </div>
        <div
          style={{
            marginTop: 34,
            display: "inline-flex",
            alignItems: "center",
            padding: "15px 24px",
            borderRadius: 8,
            background: "#0f5139",
            color: "#effff7",
            fontSize: 20,
            fontWeight: 900,
          }}
        >
          Generate project
        </div>
      </div>
    </div>
  );
}

function BuilderMockup({
  fileProgress,
  local,
  compact,
}: {
  fileProgress: number;
  local: number;
  compact?: boolean;
}) {
  const files = [
    ["src/App.tsx", palette.green],
    ["src/components/Hero.tsx", palette.blue],
    ["src/styles/theme.css", palette.violet],
    ["src/lib/deploy.ts", palette.amber],
  ];
  const lines = Math.floor(interpolate(fileProgress, [0, 1], [0, 11], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }));

  return (
    <div style={{ position: "relative", display: "flex", gap: 20, alignItems: "stretch", width: compact ? 1030 : 1154 }}>
      <div
        style={{
          width: compact ? 320 : 430,
          borderRadius: 8,
          background: "rgba(6,17,15,0.88)",
          border: `1px solid ${palette.line}`,
          boxShadow: "0 30px 110px rgba(0,0,0,0.44)",
          overflow: "hidden",
        }}
      >
        <MockHeader label="Explorer" />
        <div style={{ padding: "26px 24px" }}>
          {files.map((file, index) => {
            const appear = progress(local, 16 + index * 16, 18);
            return (
              <div
                key={file[0]}
                style={{
                  opacity: appear,
                  transform: `translateX(${(1 - appear) * -22}px)`,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  height: 56,
                  color: palette.text,
                  fontSize: compact ? 17 : 21,
                  fontWeight: 750,
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    background: file[1],
                    boxShadow: `0 0 22px ${file[1]}`,
                  }}
                />
                {file[0]}
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          width: compact ? 600 : 700,
          borderRadius: 8,
          background: "#edf9f2",
          color: "#10201d",
          border: "1px solid rgba(255,255,255,0.36)",
          boxShadow: "0 30px 110px rgba(0,0,0,0.38)",
          overflow: "hidden",
        }}
      >
        <MockHeader label="Live preview" light />
        <div style={{ padding: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
            <div style={{ width: 180, height: 24, borderRadius: 4, background: "#10201d" }} />
            <div style={{ display: "flex", gap: 14 }}>
              <Bar width={60} />
              <Bar width={72} />
              <Bar width={68} />
            </div>
          </div>
          <div
            style={{
              height: 212,
              borderRadius: 8,
              background:
                "linear-gradient(135deg, #103e35 0%, #1d6d51 45%, #76d4ff 100%)",
              padding: 30,
              color: "#f6fff9",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 850, opacity: 0.72 }}>Generated hero</div>
            <div style={{ marginTop: 18, width: 420, height: 22, borderRadius: 4, background: "rgba(255,255,255,0.86)" }} />
            <div style={{ marginTop: 14, width: 320, height: 16, borderRadius: 4, background: "rgba(255,255,255,0.5)" }} />
            <div
              style={{
                position: "absolute",
                right: 28,
                bottom: 28,
                width: 138,
                height: 70,
                borderRadius: 8,
                background: "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.3)",
              }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginTop: 22 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ height: 104, borderRadius: 8, background: "#dceee6", padding: 18 }}>
                <Bar width={82} dark />
                <Bar width={130} dark top={16} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <CodeLines count={lines} compact={compact} />
    </div>
  );
}

function ProviderConstellation({ local }: { local: number }) {
  const logoSrc = staticFile("openthorn-logo-128.png");
  const providers = [
    ["openai.png", "OpenAI", -230, -156, palette.green],
    ["anthropic.png", "Anthropic", 212, -126, palette.violet],
    ["google.png", "Gemini", -232, 158, palette.blue],
    ["mistralai.png", "Mistral", 222, 150, palette.amber],
  ] as const;

  return (
    <div style={{ position: "relative", width: 720, height: 620 }}>
      <div
        style={{
          position: "absolute",
          left: 244,
          top: 190,
          width: 232,
          height: 232,
          borderRadius: 8,
          background: palette.panelStrong,
          border: `1px solid ${palette.line}`,
          display: "grid",
          placeItems: "center",
          boxShadow: "0 34px 120px rgba(0,0,0,0.36)",
          transform: `scale(${0.88 + spring({ frame: local, fps: 30 }) * 0.12})`,
        }}
      >
        <OpenThornLogoMark size={154} />
        <Img
          src={logoSrc}
          alt="OpenThorn"
          style={{
            position: "absolute",
            width: 154,
            height: 154,
            objectFit: "contain",
            filter: "drop-shadow(0 18px 40px rgba(167,139,250,0.26))",
          }}
        />
      </div>
      {providers.map(([src, name, x, y, accent], index) => {
        const appear = progress(local, 18 + index * 12, 22);
        const drift = Math.sin((local + index * 28) / 34) * 8;
        const left = 320 + x + drift;
        const top = 270 + y - drift * 0.5;
        return (
          <div key={name}>
            <Connector x1={360} y1={306} x2={left + 70} y2={top + 70} opacity={appear * 0.55} color={accent} />
            <div
              style={{
                position: "absolute",
                left,
                top,
                width: 140,
                height: 140,
                borderRadius: 8,
                background: "rgba(247,255,251,0.94)",
                border: `1px solid ${accent}`,
                display: "grid",
                placeItems: "center",
                opacity: appear,
                transform: `scale(${0.82 + appear * 0.18}) translateY(${(1 - appear) * 18}px)`,
                boxShadow: `0 24px 80px rgba(0,0,0,0.28), 0 0 44px ${accent}33`,
              }}
            >
              <Img src={staticFile(src)} alt={name} style={{ maxWidth: 86, maxHeight: 68, objectFit: "contain" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DeployMap({ local, deploy }: { local: number; deploy: number }) {
  const nodes = [
    ["Code", 48, 160, palette.blue],
    ["GitHub", 344, 84, palette.violet],
    ["Netlify", 344, 252, palette.green],
    ["Community", 650, 168, palette.coral],
  ] as const;

  return (
    <div
      style={{
        width: 920,
        height: 610,
        borderRadius: 8,
        border: `1px solid ${palette.line}`,
        background: "rgba(255,255,255,0.07)",
        boxShadow: "0 34px 120px rgba(0,0,0,0.38)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <MockHeader label="Launch controls" />
      <Connector x1={182} y1={280} x2={452} y2={198} opacity={0.32 + deploy * 0.6} color={palette.violet} />
      <Connector x1={182} y1={280} x2={452} y2={364} opacity={0.32 + deploy * 0.6} color={palette.green} />
      <Connector x1={480} y1={282} x2={724} y2={282} opacity={0.18 + deploy * 0.64} color={palette.coral} />
      {nodes.map(([label, left, top, accent], index) => {
        const appear = progress(local, 12 + index * 18, 22);
        return (
          <div
            key={label}
            style={{
              position: "absolute",
              left,
              top,
              width: label === "Community" ? 224 : 188,
              height: 112,
              borderRadius: 8,
              background: "rgba(245,255,249,0.93)",
              color: "#10201d",
              border: `1px solid ${accent}`,
              boxShadow: `0 24px 70px rgba(0,0,0,0.26), 0 0 ${Math.round(24 + deploy * 30)}px ${accent}44`,
              opacity: appear,
              transform: `translateY(${(1 - appear) * 22}px)`,
              padding: 20,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 900 }}>{label}</div>
            <div style={{ marginTop: 14, width: "82%", height: 10, borderRadius: 4, background: "#cbddd4" }} />
            <div style={{ marginTop: 10, width: "60%", height: 10, borderRadius: 4, background: "#dfece6" }} />
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 52,
          bottom: 46,
          right: 52,
          height: 26,
          borderRadius: 8,
          background: "rgba(255,255,255,0.09)",
          overflow: "hidden",
          border: `1px solid ${palette.line}`,
        }}
      >
        <div
          style={{
            width: `${18 + deploy * 82}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${palette.blue}, ${palette.green})`,
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 52,
          bottom: 88,
          color: palette.muted,
          fontSize: 22,
          fontWeight: 800,
        }}
      >
        {deploy < 0.95 ? "Bundling project..." : "Ready to share"}
      </div>
    </div>
  );
}

function CodeLines({ count, compact }: { count: number; compact?: boolean }) {
  const snippets = [
    "export default function App() {",
    "  return <LandingPage />",
    "}",
    ".hero { display: grid; }",
    "deploy({ target: 'netlify' })",
    "syncFiles(repo, files)",
    "buildPreview(project)",
    "publishToCommunity()",
    "const provider = byok()",
    "ship()",
    "done",
  ];

  return (
    <div
      style={{
        position: "absolute",
        left: compact ? 346 : 478,
        top: compact ? 492 : 544,
        width: compact ? 440 : 520,
        borderRadius: 8,
        padding: 22,
        background: "rgba(4,14,12,0.9)",
        border: `1px solid ${palette.line}`,
        boxShadow: "0 22px 90px rgba(0,0,0,0.4)",
      }}
    >
      {snippets.slice(0, count).map((snippet, index) => (
        <div
          key={snippet}
          style={{
            height: 27,
            color: index % 3 === 0 ? palette.green : index % 3 === 1 ? palette.blue : "rgba(245,255,249,0.72)",
            fontSize: 18,
            fontFamily: 'ui-monospace, "SFMono-Regular", Consolas, monospace',
          }}
        >
          {snippet}
        </div>
      ))}
    </div>
  );
}

function TimelineMark() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const width = interpolate(frame, [0, durationInFrames], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 132,
        right: 132,
        bottom: 54,
        height: 4,
        borderRadius: 99,
        background: "rgba(255,255,255,0.12)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${width}%`,
          height: "100%",
          background: `linear-gradient(90deg, ${palette.green}, ${palette.blue}, ${palette.violet})`,
        }}
      />
    </div>
  );
}

function FeatureTile({
  delay,
  accent,
  title,
  body,
}: {
  delay: number;
  accent: string;
  title: string;
  body: string;
}) {
  const frame = useCurrentFrame();
  const local = frame - sceneRanges[2][0];
  const appear = progress(local, delay, 18);
  return (
    <div
      style={{
        minHeight: 132,
        borderRadius: 8,
        background: palette.panel,
        border: `1px solid ${accent}66`,
        padding: 22,
        opacity: appear,
        transform: `translateY(${(1 - appear) * 24}px)`,
      }}
    >
      <div style={{ width: 32, height: 5, borderRadius: 999, background: accent, marginBottom: 20 }} />
      <div style={{ color: palette.text, fontSize: 25, fontWeight: 900 }}>{title}</div>
      <div style={{ color: palette.muted, fontSize: 18, fontWeight: 650, marginTop: 8 }}>{body}</div>
    </div>
  );
}

function MetricStrip({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: "flex", gap: 14 }}>
      {items.map(([num, label]) => (
        <div
          key={label}
          style={{
            flex: 1,
            padding: "18px 20px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.08)",
            border: `1px solid ${palette.line}`,
          }}
        >
          <div style={{ color: palette.green, fontSize: 18, fontWeight: 950 }}>{num}</div>
          <div style={{ color: palette.text, fontSize: 22, fontWeight: 850, marginTop: 8 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function ValuePill({ accent, children }: { accent: string; children: ReactNode }) {
  return (
    <div
      style={{
        padding: "14px 20px",
        borderRadius: 8,
        color: palette.text,
        border: `1px solid ${accent}66`,
        background: "rgba(255,255,255,0.08)",
        fontSize: 22,
        fontWeight: 850,
      }}
    >
      <span style={{ color: accent, marginRight: 10 }}>+</span>
      {children}
    </div>
  );
}

function Connector({
  x1,
  y1,
  x2,
  y2,
  opacity,
  color,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  opacity: number;
  color: string;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  return (
    <div
      style={{
        position: "absolute",
        left: x1,
        top: y1,
        width: length,
        height: 2,
        background: `linear-gradient(90deg, ${color}, transparent)`,
        opacity,
        transformOrigin: "left center",
        transform: `rotate(${angle}deg)`,
      }}
    />
  );
}

function MockHeader({ label, light }: { label: string; light?: boolean }) {
  return (
    <div
      style={{
        height: 58,
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "0 20px",
        borderBottom: light ? "1px solid rgba(16,32,29,0.1)" : `1px solid ${palette.line}`,
        background: light ? "#e4f1ea" : "rgba(255,255,255,0.06)",
      }}
    >
      <Dot color={palette.coral} />
      <Dot color={palette.amber} />
      <Dot color={palette.green} />
      <span
        style={{
          marginLeft: 14,
          color: light ? "rgba(16,32,29,0.55)" : "rgba(245,255,249,0.58)",
          fontWeight: 850,
          fontSize: 17,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function Bar({ width, dark, top = 0 }: { width: number; dark?: boolean; top?: number }) {
  return (
    <div
      style={{
        width,
        height: 10,
        borderRadius: 999,
        marginTop: top,
        background: dark ? "rgba(16,32,29,0.2)" : "rgba(16,32,29,0.14)",
      }}
    />
  );
}

function Dot({ color }: { color: string }) {
  return <span style={{ width: 12, height: 12, borderRadius: 99, background: color }} />;
}

function OpenThornLogoMark({ size }: { size: number }) {
  const petal =
    "M256 224C211 202 163 178 137 128C111 78 130 28 176 10C212 -4 241 10 256 40C271 10 300 -4 336 10C382 28 401 78 375 128C349 178 301 202 256 224Z";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden="true"
      style={{
        position: "absolute",
        filter: "drop-shadow(0 12px 28px rgba(167,139,250,0.22))",
      }}
    >
      <defs>
        <linearGradient id="openthorn-top" x1="130" y1="10" x2="382" y2="224">
          <stop offset="0" stopColor="#f46cff" />
          <stop offset="1" stopColor="#ff9ad9" />
        </linearGradient>
        <linearGradient id="openthorn-left" x1="10" y1="130" x2="224" y2="382">
          <stop offset="0" stopColor="#a331ff" />
          <stop offset="1" stopColor="#756bff" />
        </linearGradient>
        <linearGradient id="openthorn-bottom" x1="130" y1="502" x2="382" y2="288">
          <stop offset="0" stopColor="#7a79ff" />
          <stop offset="1" stopColor="#9e82ff" />
        </linearGradient>
        <linearGradient id="openthorn-right" x1="502" y1="130" x2="288" y2="382">
          <stop offset="0" stopColor="#eba5ff" />
          <stop offset="1" stopColor="#b984ff" />
        </linearGradient>
      </defs>
      <path d={petal} fill="url(#openthorn-top)" />
      <path d={petal} fill="url(#openthorn-right)" transform="rotate(90 256 256)" />
      <path d={petal} fill="url(#openthorn-bottom)" transform="rotate(180 256 256)" />
      <path d={petal} fill="url(#openthorn-left)" transform="rotate(270 256 256)" />
      <path
        d="M256 186L279 232L330 256L279 280L256 326L233 280L182 256L233 232Z"
        fill={palette.ink}
      />
    </svg>
  );
}

function progress(frame: number, start: number, duration: number) {
  return interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
}

export const safeArea: CSSProperties = {
  position: "absolute",
  left: 120,
  right: 120,
  top: 90,
  bottom: 90,
};
