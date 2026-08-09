"use client";

import "@fontsource-variable/noto-sans-jp";
import { useMemo } from "react";
import { AbsoluteFill, Audio, Sequence, useVideoConfig } from "remotion";
import { getBgmVolume, groupContinuousBgm, resolveAudioOverride, type AudioScene } from "@/domain/audio";
import { EDITOR_CONSTANTS } from "@/domain/defaults";
import { getSupportCreditsGroups } from "@/domain/support-credits";
import { calculateBlock } from "@/domain/timeline";
import type { ContentBlock } from "@/domain/types";
import { SupportCreditsScene } from "../SupportCreditsScene";
import { DiaryScene } from "./DiaryScene";
import { secondsToFrames } from "./timing";
import type { DiaryVideoProps } from "./types";
import { WishScene } from "./WishScene";

export { getVideoDuration } from "@/domain/video-duration";

export function DiaryVideo({
  project,
  characters,
  defaultEndHold,
  dialoguePsdPreviewUrls,
  assetVolumes = {},
  assetTransparency = {},
}: DiaryVideoProps) {
  const { fps } = useVideoConfig();
  const { sequences, audioScenes } = useMemo(() => {
    let cursor = 0;
    const nextSequences: React.ReactNode[] = [];
    const nextAudioScenes: AudioScene[] = [];

    if (project.wishList) {
      const block: ContentBlock = {
        id: "wish",
        title: "",
        asset: null,
        dialogues: project.wishList.dialogues,
        durationSeconds: project.wishList.durationSeconds,
        endHoldSeconds: project.wishList.endHoldSeconds,
        entrySe: { mode: "none" },
      };
      const timing = calculateBlock(block, characters, defaultEndHold);
      const duration = secondsToFrames(timing.duration, fps);
      nextSequences.push(
        <Sequence key="wish" from={cursor} durationInFrames={duration}>
          <WishScene project={project} characters={characters} block={block} defaultEndHold={defaultEndHold} />
        </Sequence>,
      );
      nextAudioScenes.push({
        key: "wish",
        from: cursor,
        duration,
        bgm: resolveAudioOverride(project.audio.bgm, project.wishList.bgm, assetVolumes),
      });
      cursor += duration;
    }

    project.diaries.forEach((diary) => {
      const introSeconds = EDITOR_CONSTANTS.dateCenterSeconds + EDITOR_CONSTANTS.diaryUiFadeSeconds;
      const blockSeconds = diary.blocks.reduce(
        (sum, block) => sum + calculateBlock(block, characters, defaultEndHold).duration,
        0,
      );
      const duration = secondsToFrames(introSeconds + blockSeconds, fps);
      nextSequences.push(
        <Sequence key={diary.id} from={cursor} durationInFrames={duration}>
          <DiaryScene
            project={project}
            diary={diary}
            characters={characters}
            defaultEndHold={defaultEndHold}
            dialoguePsdPreviewUrls={dialoguePsdPreviewUrls}
            assetVolumes={assetVolumes}
            assetTransparency={assetTransparency}
          />
        </Sequence>,
      );
      nextAudioScenes.push({
        key: diary.id,
        from: cursor,
        duration,
        bgm: resolveAudioOverride(project.audio.bgm, diary.bgm, assetVolumes),
      });
      cursor += duration;
    });

    const supportGroups = getSupportCreditsGroups(project.supportCredits, characters, defaultEndHold);
    if (supportGroups.length > 0) {
      const duration = supportGroups.reduce((sum, group) => sum + secondsToFrames(group.timing.duration, fps), 0);
      nextSequences.push(
        <Sequence key="support" from={cursor} durationInFrames={duration}>
          <SupportCreditsScene project={project} characters={characters} defaultEndHold={defaultEndHold} />
        </Sequence>,
      );
      nextAudioScenes.push({
        key: "support",
        from: cursor,
        duration,
        bgm: resolveAudioOverride(project.audio.bgm, project.supportCredits.bgm, assetVolumes),
      });
      cursor += duration;
    }
    return { sequences: nextSequences, audioScenes: nextAudioScenes };
  }, [assetTransparency, assetVolumes, characters, defaultEndHold, dialoguePsdPreviewUrls, fps, project]);

  const bgmSegments = useMemo(() => groupContinuousBgm(audioScenes), [audioScenes]);
  const sceneIntroSoundEffects = useMemo(
    () =>
      audioScenes.map((scene) => {
        const override =
          scene.key === "wish"
            ? project.wishList?.sceneIntroSe
            : scene.key === "support"
              ? project.supportCredits.sceneIntroSe
              : project.diaries.find((diary) => diary.id === scene.key)?.sceneIntroSe;
        const clip = resolveAudioOverride(project.audio.sceneIntroSe, override, assetVolumes);
        return clip ? (
          <Sequence key={`scene-intro-${scene.key}`} from={scene.from} durationInFrames={scene.duration}>
            <Audio src={clip.url} volume={clip.volume} />
          </Sequence>
        ) : null;
      }),
    [assetVolumes, audioScenes, project],
  );

  return (
    <AbsoluteFill style={{ background: "#f4f6f8", fontFamily: '"Noto Sans JP Variable", sans-serif' }}>
      {bgmSegments.map((segment) => (
        <Sequence key={segment.key} from={segment.from} durationInFrames={segment.duration}>
          <Audio
            src={segment.clip.url}
            volume={(frame) => getBgmVolume(segment, frame)}
            loop
            loopVolumeCurveBehavior="extend"
          />
        </Sequence>
      ))}
      {sceneIntroSoundEffects}
      {sequences}
    </AbsoluteFill>
  );
}
