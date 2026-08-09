"use client";

import { AbsoluteFill, Audio, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { getSupportCreditsGroups, type SupportCreditsGroup } from "@/domain/support-credits";
import type { Character, ProjectDocument, SupportCreditsCache } from "@/domain/types";
import { GridBackground } from "./AssetBackground";
import { getSupportNameLayout, SUPPORT_LIST_VIEWPORT_HEIGHT } from "./support-name-layout";

const secondsToFrames = (seconds: number, fps: number) => Math.max(1, Math.ceil(seconds * fps));

export function SupportCreditsScene({
  project,
  characters,
  defaultEndHold,
}: {
  project: ProjectDocument;
  characters: Character[];
  defaultEndHold?: number;
}) {
  const { fps } = useVideoConfig();
  const groups = getSupportCreditsGroups(project.supportCredits, characters, defaultEndHold);
  let cursor = 0;
  return (
    <AbsoluteFill className="video-support-scene">
      <GridBackground />
      {groups.map((group) => {
        const from = cursor;
        const duration = secondsToFrames(group.timing.duration, fps);
        cursor += duration;
        return (
          <Sequence key={group.key} from={from} durationInFrames={duration}>
            <SupportGroup group={group} cache={project.supportCredits.cache!} fps={fps} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

function SupportGroup({ group, cache, fps }: { group: SupportCreditsGroup; cache: SupportCreditsCache; fps: number }) {
  const frame = useCurrentFrame();
  const narrationKeyById = new Map(group.narrations.map((item) => [item.id, item.key]));
  const audio = group.timing.dialogues.map((item) =>
    item.dialogue.audio.url ? (
      <Sequence
        key={item.dialogue.id}
        from={Math.round(item.start * fps)}
        durationInFrames={secondsToFrames(item.audioEnd - item.start, fps)}
      >
        <Audio src={item.dialogue.audio.url} />
      </Sequence>
    ) : null,
  );
  if (group.scope === "intro") {
    return (
      <AbsoluteFill className="video-support-bookend" style={{ alignItems: "center", justifyContent: "center" }}>
        {audio}
        <div className="video-support-bookend-card">
          <h1>広告・ギフト紹介のコーナー</h1>
          <p>これまでの動画にニコニ広告・ギフトを投げてくれた方の紹介（敬称略）</p>
        </div>
      </AbsoluteFill>
    );
  }
  if (group.scope === "outro") {
    return (
      <AbsoluteFill className="video-support-bookend" style={{ alignItems: "center", justifyContent: "center" }}>
        {audio}
        <div className="video-support-bookend-card">
          <h1>
            支援いただき
            <br />
            ありがとうございます！
          </h1>
        </div>
      </AbsoluteFill>
    );
  }
  const video = cache.videos.find((item) => item.videoId === group.videoId)!;
  const giftTimings = group.timing.dialogues.filter((item) =>
    narrationKeyById.get(item.dialogue.id)?.includes(":gift:"),
  );
  const seconds = frame / fps;
  const lastStartedGift = giftTimings.filter((item) => seconds >= item.start).at(-1);
  const currentGiftIndex = lastStartedGift ? giftTimings.indexOf(lastStartedGift) : 0;
  const giftLayout = getSupportNameLayout(video.gifts.length, "gift");
  const adLayout = getSupportNameLayout(video.advertisers.length, "ad");
  const giftOverflow = Math.max(0, video.gifts.length * giftLayout.rowHeight - SUPPORT_LIST_VIEWPORT_HEIGHT);
  const giftScrollTarget = (index: number) =>
    Math.min(
      giftOverflow,
      Math.max(0, (index + 1) * giftLayout.rowHeight - SUPPORT_LIST_VIEWPORT_HEIGHT + giftLayout.rowHeight * 0.5),
    );
  const giftScroll =
    lastStartedGift && giftLayout.scroll
      ? interpolate(
          seconds,
          [lastStartedGift.start, lastStartedGift.start + 0.3],
          [giftScrollTarget(Math.max(0, currentGiftIndex - 1)), giftScrollTarget(currentGiftIndex)],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      : 0;
  const adOverflow = Math.max(0, video.advertisers.length * adLayout.rowHeight - SUPPORT_LIST_VIEWPORT_HEIGHT);
  const durationFrames = secondsToFrames(group.timing.duration, fps);
  const adScroll =
    adLayout.scroll && adOverflow
      ? interpolate(frame, [0, Math.max(1, durationFrames - 1)], [0, adOverflow], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const columnCount = Number(video.gifts.length > 0) + Number(video.advertisers.length > 0);
  return (
    <AbsoluteFill className="video-support-video">
      {audio}
      <div className="video-support-header">
        <Img src={video.thumbnailUrl} />
        <div className="video-support-header-copy">
          <h2>{video.title}</h2>
          <div className="video-support-header-meta">
            <span>{video.videoId}</span>
          </div>
        </div>
      </div>
      <div className={`video-support-columns ${columnCount === 1 ? "single" : ""}`}>
        {video.gifts.length ? (
          <SupportList
            label="ギフト"
            kind="gift"
            names={video.gifts.map((item) => item.supporterName)}
            scroll={giftScroll}
            fontSize={giftLayout.fontSize}
            rowHeight={giftLayout.rowHeight}
          />
        ) : null}
        {video.advertisers.length ? (
          <SupportList
            label="ニコニ広告"
            kind="ad"
            names={video.advertisers.map((item) => item.supporterName)}
            scroll={adScroll}
            fontSize={adLayout.fontSize}
            rowHeight={adLayout.rowHeight}
          />
        ) : null}
      </div>
    </AbsoluteFill>
  );
}

function SupportList({
  label,
  kind,
  names,
  scroll,
  fontSize,
  rowHeight,
}: {
  label: string;
  kind: "gift" | "ad";
  names: string[];
  scroll: number;
  fontSize: number;
  rowHeight: number;
}) {
  return (
    <div className={`video-support-column video-support-${kind}`}>
      <div className="video-support-label">{label}</div>
      <div className="video-support-list-viewport">
        <div className="video-support-list" style={{ transform: `translateY(${-scroll}px)` }}>
          {names.map((name, index) => (
            <div
              className="video-support-name"
              key={`${index}-${name}`}
              style={{ height: rowHeight, fontSize, lineHeight: `${rowHeight}px` }}
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
