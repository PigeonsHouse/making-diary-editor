export type NormalizableAssetKind = "image" | "video" | "audio";

type ProbeStream = {
  pix_fmt?: unknown;
  tags?: unknown;
};

type ProbeResult = {
  streams?: unknown;
};

const alphaPixelFormatPatterns = [
  /^(?:rgba|argb|bgra|abgr)(?:64(?:be|le))?$/,
  /^yuva\d+p(?:\d+(?:be|le))?$/,
  /^gbrap(?:\d+(?:be|le))?$/,
  /^ya\d+(?:be|le)?$/,
  /^ayuv/,
  /^pal8$/,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function streamHasAlpha(stream: ProbeStream) {
  const pixelFormat = typeof stream.pix_fmt === "string" ? stream.pix_fmt.toLowerCase() : "";
  if (alphaPixelFormatPatterns.some((pattern) => pattern.test(pixelFormat))) return true;
  if (!isRecord(stream.tags)) return false;

  return Object.entries(stream.tags).some(
    ([key, value]) => key.toLowerCase() === "alpha_mode" && (value === 1 || value === "1"),
  );
}

export function probeHasAlpha(probe: unknown) {
  if (!isRecord(probe)) return false;
  const streams = (probe as ProbeResult).streams;
  return Array.isArray(streams) && streams.some((stream) => isRecord(stream) && streamHasAlpha(stream));
}

export function getNormalizedAssetExtension(kind: NormalizableAssetKind, hasAlpha: boolean) {
  if (kind === "video") return hasAlpha ? ".webm" : ".mp4";
  if (kind === "audio") return ".m4a";
  return hasAlpha ? ".png" : ".jpg";
}

export function getAssetNormalizationArgs({
  kind,
  input,
  output,
  fps,
  hasAlpha,
}: {
  kind: NormalizableAssetKind;
  input: string;
  output: string;
  fps: number;
  hasAlpha: boolean;
}) {
  if (kind === "video" && hasAlpha) {
    return [
      "-y",
      "-i",
      input,
      "-map_metadata",
      "0",
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-c:v",
      "libvpx-vp9",
      "-crf",
      "18",
      "-b:v",
      "0",
      "-g",
      String(fps),
      "-pix_fmt",
      "yuva420p",
      "-metadata:s:v:0",
      "alpha_mode=1",
      "-c:a",
      "libopus",
      "-b:a",
      "192k",
      output,
    ];
  }

  if (kind === "video") {
    return [
      "-y",
      "-i",
      input,
      "-map_metadata",
      "0",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-g",
      String(fps),
      "-keyint_min",
      String(fps),
      "-sc_threshold",
      "0",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      output,
    ];
  }

  if (kind === "audio") {
    return ["-y", "-i", input, "-map_metadata", "0", "-vn", "-c:a", "aac", "-b:a", "192k", output];
  }

  if (hasAlpha) {
    return ["-y", "-i", input, "-map_metadata", "0", "-frames:v", "1", "-c:v", "png", output];
  }

  return ["-y", "-i", input, "-map_metadata", "0", "-q:v", "2", output];
}
