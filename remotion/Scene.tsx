import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";

/** One photo held on screen with a slow Ken Burns zoom/pan and a caption
 * fading in under it, plus a cross-fade in/out at the scene's edges so
 * cuts between photos aren't jarring. */
export function Scene({
  photoUrl,
  caption,
  durationInFrames,
  fps,
  zoomDirection,
}: {
  photoUrl: string;
  caption: string;
  durationInFrames: number;
  fps: number;
  zoomDirection: "in" | "out";
}) {
  const frame = useCurrentFrame();
  const crossfadeFrames = Math.min(Math.round(fps * 0.4), Math.floor(durationInFrames / 4));

  const opacity = interpolate(
    frame,
    [0, crossfadeFrames, durationInFrames - crossfadeFrames, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const progress = frame / durationInFrames;
  const scale =
    zoomDirection === "in" ? interpolate(progress, [0, 1], [1, 1.15]) : interpolate(progress, [0, 1], [1.15, 1]);

  const captionOpacity = interpolate(frame, [fps * 0.3, fps * 0.7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity, backgroundColor: "#0f172a" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        <Img src={photoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 35%)",
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 140,
          paddingLeft: 60,
          paddingRight: 60,
        }}
      >
        <p
          style={{
            opacity: captionOpacity,
            color: "white",
            fontFamily: "Arial, sans-serif",
            fontWeight: 700,
            fontSize: 56,
            lineHeight: 1.25,
            textAlign: "center",
            textShadow: "0 2px 12px rgba(0,0,0,0.8)",
            margin: 0,
          }}
        >
          {caption}
        </p>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
