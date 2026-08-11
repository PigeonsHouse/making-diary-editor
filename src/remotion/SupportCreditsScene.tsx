"use client";

import { AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { getSupportCreditsGroups, type SupportCreditsGroup } from "@/domain/support-credits";
import type { Character, ProjectDocument, SupportCreditsCache } from "@/domain/types";
import { GridBackground } from "./AssetBackground";
import {
  getSupportNameLayout,
  getSupportNameScrollOffset,
  SUPPORT_LIST_VIEWPORT_HEIGHT,
  SUPPORT_NAME_MIN_SCROLL_PX_PER_FRAME,
} from "./support-name-layout";

const secondsToFrames = (seconds: number, fps: number) => Math.max(1, Math.ceil(seconds * fps));

const animationProgress = (frame: number, start: number, end: number) =>
  end <= start
    ? Number(frame >= end)
    : interpolate(frame, [start, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

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
  const adLayout = getSupportNameLayout(video.advertisers.length, "ad", video.gifts.length === 0);
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
  const adRows = Math.ceil(video.advertisers.length / adLayout.columns);
  const adOverflow = Math.max(0, adRows * adLayout.rowHeight - SUPPORT_LIST_VIEWPORT_HEIGHT);
  const durationFrames = secondsToFrames(group.timing.duration, fps);
  const columnCount = Number(video.gifts.length > 0) + Number(video.advertisers.length > 0);
  const lastFrame = Math.max(1, durationFrames - 1);
  const exitFrames = Math.min(Math.round(0.4 * fps), Math.max(1, Math.floor(lastFrame / 3)));
  const exitStart = lastFrame - exitFrames;
  const headerEnterEnd = Math.min(Math.round(0.45 * fps), Math.floor(exitStart / 2));
  const supporterEnterEnd = Math.min(exitStart, headerEnterEnd + Math.round(0.35 * fps));
  const supporterHoldFrames = Math.max(0, exitStart - supporterEnterEnd);
  const maximumAdScrollFrames = Math.max(1, Math.floor(supporterHoldFrames / 2));
  const minimumSpeedAdScrollFrames = Math.max(1, Math.ceil(adOverflow / SUPPORT_NAME_MIN_SCROLL_PX_PER_FRAME));
  const adScrollFrames = Math.min(maximumAdScrollFrames, minimumSpeedAdScrollFrames);
  const adScrollStart = supporterEnterEnd + (supporterHoldFrames - adScrollFrames) / 2;
  const adScroll = adLayout.scroll
    ? getSupportNameScrollOffset(frame - adScrollStart, adScrollFrames + 1, adOverflow)
    : 0;
  const headerEnterProgress = animationProgress(frame, 0, headerEnterEnd);
  const supporterEnterProgress = animationProgress(frame, headerEnterEnd, supporterEnterEnd);
  const exitProgress = animationProgress(frame, exitStart, lastFrame);
  const headerOpacity = Math.min(headerEnterProgress, 1 - exitProgress);
  const supporterOpacity = Math.min(supporterEnterProgress, 1 - exitProgress);
  const headerSlideInProgress = interpolate(frame, [0, Math.max(1, headerEnterEnd)], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const headerSlideOutProgress = interpolate(frame, [exitStart, lastFrame], [0, 1], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const headerTranslateX = -140 * (1 - headerSlideInProgress) + 140 * headerSlideOutProgress;
  return (
    <AbsoluteFill className="video-support-video">
      {audio}
      <div className="video-support-header">
        <div
          className="video-support-header-content"
          style={{ opacity: headerOpacity, transform: `translateX(${headerTranslateX}px)` }}
        >
          <Img src={video.thumbnailUrl} />
          <div className="video-support-header-copy">
            <h2>{video.title}</h2>
            <div className="video-support-header-meta">
              <span>{video.videoId}</span>
            </div>
          </div>
        </div>
      </div>
      <div
        className={`video-support-columns ${columnCount === 1 ? "single" : ""}`}
        style={{ opacity: supporterOpacity }}
      >
        {video.gifts.length ? (
          <SupportList
            label="ギフト"
            kind="gift"
            names={video.gifts.map((item) => item.supporterName)}
            scroll={giftScroll}
            fontSize={giftLayout.fontSize}
            rowHeight={giftLayout.rowHeight}
            columns={giftLayout.columns}
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
            columns={adLayout.columns}
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
  columns,
}: {
  label: string;
  kind: "gift" | "ad";
  names: string[];
  scroll: number;
  fontSize: number;
  rowHeight: number;
  columns: number;
}) {
  return (
    <div className={`video-support-column video-support-${kind}`}>
      <div className="video-support-label">{label}</div>
      <div className="video-support-list-viewport">
        <div
          className="video-support-list"
          style={{ transform: `translateY(${-scroll}px)`, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
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
