import { z } from "zod";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import { Scene } from "./Scene";

export const productShowcaseSchema = z.object({
  brandName: z.string(),
  headline: z.string(),
  logoUrl: z.string().nullable(),
  voiceoverUrl: z.string(),
  scenes: z.array(z.object({ photoUrl: z.string(), caption: z.string() })).min(1),
});

export type ProductShowcaseProps = z.infer<typeof productShowcaseSchema>;

const FPS = 30;
const INTRO_SECONDS = 2.2;
const OUTRO_SECONDS = 3;

/** Splits the narrated audio's total duration across scenes proportional to
 * each caption's word count, so longer lines linger a little longer -- a
 * rough but effective way to keep captions roughly in sync with narration
 * without needing per-word timestamps from the TTS provider. */
function sceneDurationsInFrames(scenes: { caption: string }[], middleSeconds: number): number[] {
  const weights = scenes.map((s) => Math.max(s.caption.split(/\s+/).length, 3));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => Math.round(((w / totalWeight) * middleSeconds) * FPS));
}

export const calculateMetadata = async ({ props }: { props: ProductShowcaseProps }) => {
  const audioDurationSeconds = await getAudioDurationInSeconds(props.voiceoverUrl);
  // The scenes get the full narration length (plus a floor so even a very
  // short script still gives each photo a readable moment on screen) --
  // intro/outro are added on top of that, not carved out of it.
  const middleSeconds = Math.max(audioDurationSeconds + 0.6, props.scenes.length * 1.5);
  const totalSeconds = INTRO_SECONDS + middleSeconds + OUTRO_SECONDS;
  const durations = sceneDurationsInFrames(props.scenes, middleSeconds);
  const durationInFrames = Math.round(totalSeconds * FPS);
  return { durationInFrames, fps: FPS, width: 1080, height: 1920, props: { ...props, _sceneDurations: durations } };
};

function TitleCard({ brandName, headline, logoUrl }: { brandName: string; headline: string; logoUrl: string | null }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#111827", justifyContent: "center", alignItems: "center", opacity }}>
      {logoUrl && <Img src={logoUrl} style={{ width: 180, height: 180, objectFit: "contain", marginBottom: 32 }} />}
      <p style={{ color: "#f97316", fontFamily: "Arial, sans-serif", fontWeight: 800, fontSize: 44, margin: 0 }}>
        {brandName}
      </p>
      <p
        style={{
          color: "white",
          fontFamily: "Arial, sans-serif",
          fontWeight: 700,
          fontSize: 60,
          textAlign: "center",
          margin: "24px 60px 0",
          lineHeight: 1.2,
        }}
      >
        {headline}
      </p>
    </AbsoluteFill>
  );
}

function OutroCard({ brandName, logoUrl }: { brandName: string; logoUrl: string | null }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#111827", justifyContent: "center", alignItems: "center", opacity }}>
      {logoUrl && <Img src={logoUrl} style={{ width: 150, height: 150, objectFit: "contain", marginBottom: 28 }} />}
      <p style={{ color: "#f97316", fontFamily: "Arial, sans-serif", fontWeight: 800, fontSize: 40, margin: 0 }}>
        {brandName}
      </p>
      <p style={{ color: "#cbd5e1", fontFamily: "Arial, sans-serif", fontSize: 30, margin: "16px 60px 0", textAlign: "center" }}>
        Custom jerseys, made to order.
      </p>
    </AbsoluteFill>
  );
}

export function ProductShowcase(
  props: ProductShowcaseProps & { _sceneDurations?: number[] }
) {
  const { fps } = useVideoConfig();
  const { brandName, headline, logoUrl, voiceoverUrl, scenes, _sceneDurations } = props;
  const introFrames = Math.round(INTRO_SECONDS * fps);
  const outroFrames = Math.round(OUTRO_SECONDS * fps);
  const durations = _sceneDurations ?? sceneDurationsInFrames(scenes, 10);

  const positioned = scenes.reduce<
    { scene: (typeof scenes)[number]; from: number; duration: number; zoomDirection: "in" | "out" }[]
  >((acc, scene, i) => {
    const from = acc.length === 0 ? introFrames : acc[i - 1].from + acc[i - 1].duration;
    const zoomDirection: "in" | "out" = i % 2 === 0 ? "in" : "out";
    return [...acc, { scene, from, duration: durations[i], zoomDirection }];
  }, []);
  const cursor = positioned.length > 0 ? positioned[positioned.length - 1].from + positioned[positioned.length - 1].duration : introFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Sequence from={introFrames}>
        <Audio src={voiceoverUrl} />
      </Sequence>
      <Sequence from={0} durationInFrames={introFrames}>
        <TitleCard brandName={brandName} headline={headline} logoUrl={logoUrl} />
      </Sequence>
      {positioned.map(({ scene, from, duration, zoomDirection }, i) => (
        <Sequence key={i} from={from} durationInFrames={duration}>
          <Scene
            photoUrl={scene.photoUrl}
            caption={scene.caption}
            durationInFrames={duration}
            fps={fps}
            zoomDirection={zoomDirection}
          />
        </Sequence>
      ))}
      <Sequence from={cursor} durationInFrames={outroFrames}>
        <OutroCard brandName={brandName} logoUrl={logoUrl} />
      </Sequence>
    </AbsoluteFill>
  );
}
