"use client";

import { useMemo } from "react";
import { Video } from "@remotion/media";
import { AbsoluteFill, Freeze, Img, Loop, OffthreadVideo, Sequence, interpolate, useCurrentFrame } from "remotion";
import { EDITOR_CONSTANTS } from "@/domain/defaults";
import { resolveAssetVolume, type AssetVolumeMap } from "@/domain/audio";
import type { AssetTransparencyMap } from "@/domain/asset-transparency";
import type { AssetSettings, ContentBlock } from "@/domain/types";
import { getVideoAssetTiming, getVideoPlaybackRateError } from "@/domain/video-asset";
import { ChromaKeyFilter } from "./ChromaKeyFilter";

type Props = {
  block?: ContentBlock;
  blockStartFrame: number;
  blockDurationSeconds: number;
  blockDurationInFrames: number;
  assetVolumes?: AssetVolumeMap;
  assetTransparency?: AssetTransparencyMap;
};

export function AssetBackground({
  block,
  blockStartFrame,
  blockDurationSeconds,
  blockDurationInFrames,
  assetVolumes = {},
  assetTransparency = {},
}: Props) {
  const asset = block?.asset;
  if (!asset) return <GridBackground />;

  return (
    <>
      <GridBackground />
      <Sequence key={block.id} from={blockStartFrame} durationInFrames={blockDurationInFrames}>
        <AssetFrame
          asset={asset}
          blockDurationSeconds={blockDurationSeconds}
          assetVolumes={assetVolumes}
          assetTransparency={assetTransparency}
        />
      </Sequence>
    </>
  );
}

export function GridBackground() {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f8fafc",
        backgroundImage:
          "linear-gradient(#dce1e7 2px, transparent 2px), linear-gradient(90deg, #dce1e7 2px, transparent 2px)",
        backgroundSize: "48px 48px",
      }}
    />
  );
}

function AssetFrame({
  asset,
  blockDurationSeconds,
  assetVolumes,
  assetTransparency,
}: {
  asset: AssetSettings;
  blockDurationSeconds: number;
  assetVolumes: AssetVolumeMap;
  assetTransparency: AssetTransparencyMap;
}) {
  const crop = asset.trim;
  const chromaKeyFilterId = `chroma-key-${asset.assetId}`;
  const frameStyle: React.CSSProperties = {
    position: "absolute",
    inset: asset.displayArea === "above-dialogue" ? "0 0 23%" : 0,
    boxSizing: "border-box",
    padding: EDITOR_CONSTANTS.mediaMarginPx,
  };
  const mediaStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    objectPosition: "center",
    clipPath: `inset(${crop.top}px ${crop.right}px ${crop.bottom}px ${crop.left}px)`,
    filter: asset.chromaKey.enabled ? `url(#${chromaKeyFilterId})` : undefined,
  };

  return (
    <>
      <ChromaKeyFilter id={chromaKeyFilterId} settings={asset.chromaKey} />
      <div style={frameStyle}>
        {asset.type === "image" ? (
          <Img src={asset.url} style={mediaStyle} />
        ) : (
          <VideoAsset
            asset={asset}
            blockDurationSeconds={blockDurationSeconds}
            style={mediaStyle}
            assetVolumes={assetVolumes}
            transparent={assetTransparency[asset.assetId] === true}
          />
        )}
      </div>
    </>
  );
}

function VideoAsset({
  asset,
  blockDurationSeconds,
  style,
  assetVolumes,
  transparent,
}: {
  asset: AssetSettings;
  blockDurationSeconds: number;
  style: React.CSSProperties;
  assetVolumes: AssetVolumeMap;
  transparent: boolean;
}) {
  const frame = useCurrentFrame();
  const timing = useMemo(
    () => getVideoAssetTiming(asset, blockDurationSeconds, EDITOR_CONSTANTS.fps),
    [asset, blockDurationSeconds],
  );
  const playbackRateError = useMemo(
    () => getVideoPlaybackRateError(asset, blockDurationSeconds, EDITOR_CONSTANTS.fps),
    [asset, blockDurationSeconds],
  );
  if (playbackRateError) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "grid",
          placeItems: "center",
          padding: 48,
          boxSizing: "border-box",
          color: "#b42318",
          background: "#fff1f0",
          fontSize: 32,
          fontWeight: 700,
          textAlign: "center",
        }}
      >
        {playbackRateError}
      </div>
    );
  }
  const mediaProps = {
    src: asset.url,
    trimBefore: timing.trimBefore,
    trimAfter: timing.trimAfter,
    playbackRate: timing.playbackRate,
    volume: resolveAssetVolume(asset.assetId, asset.volumeOverride, assetVolumes),
  };
  const video = transparent ? (
    <OffthreadVideo {...mediaProps} transparent style={style} />
  ) : (
    <Video {...mediaProps} objectFit="contain" style={{ ...style, objectFit: undefined, objectPosition: undefined }} />
  );

  if (asset.shortageMode === "loop" && timing.clipDurationInFrames !== null) {
    return <Loop durationInFrames={timing.clipDurationInFrames}>{video}</Loop>;
  }
  if (asset.shortageMode === "freeze" && timing.clipDurationInFrames !== null) {
    return (
      <Freeze frame={timing.clipDurationInFrames - 1} active={frame >= timing.clipDurationInFrames}>
        {video}
      </Freeze>
    );
  }
  if (asset.shortageMode === "fade-out" && timing.clipDurationInFrames !== null) {
    const fadeFrames = Math.max(
      1,
      Math.round((asset.fadeOutSeconds ?? EDITOR_CONSTANTS.defaultFadeOutSeconds) * EDITOR_CONSTANTS.fps),
    );
    const opacity = interpolate(
      frame,
      [Math.max(0, timing.clipDurationInFrames - fadeFrames), timing.clipDurationInFrames],
      [1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    return <div style={{ width: "100%", height: "100%", opacity }}>{video}</div>;
  }
  return video;
}
