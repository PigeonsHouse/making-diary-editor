"use client";

import { useMemo } from "react";
import { Audio, Sequence, useVideoConfig } from "remotion";
import { layoutSubtitleText } from "@/domain/subtitle-layout";
import { calculateBlock, dialogueAudioStartFrame } from "@/domain/timeline";
import type { Character, ContentBlock } from "@/domain/types";
import { secondsToFrames } from "./timing";

export function DialogueLayer({
  block,
  localFrame,
  blockStartFrame,
  characters,
  defaultEndHold,
  timing: providedTiming,
}: {
  block: ContentBlock;
  localFrame: number;
  blockStartFrame: number;
  characters: Character[];
  defaultEndHold?: number;
  timing?: ReturnType<typeof calculateBlock>;
}) {
  const { fps } = useVideoConfig();
  const seconds = localFrame / fps;
  const timing = useMemo(
    () => providedTiming ?? calculateBlock(block, characters, defaultEndHold),
    [block, characters, defaultEndHold, providedTiming],
  );
  const visible = timing.dialogues.filter((item) => seconds >= item.start && seconds <= item.displayEnd);
  return (
    <>
      {timing.dialogues.map((item) =>
        item.dialogue.audio.url ? (
          <Sequence
            key={`audio-${item.dialogue.id}`}
            from={dialogueAudioStartFrame(blockStartFrame, item.start, fps)}
            durationInFrames={secondsToFrames(item.audioEnd - item.start, fps)}
          >
            <Audio src={item.dialogue.audio.url} />
          </Sequence>
        ) : null,
      )}
      <div className="video-dialogue-stack">
        {visible.map((item, index) => {
          const character = characters.find((candidate) => candidate.id === item.dialogue.characterId);
          const subtitle = layoutSubtitleText(item.dialogue.text);
          return (
            <div
              key={item.dialogue.id}
              className="video-dialogue"
              style={{
                WebkitTextStroke: `10px ${character?.color ?? "#64748b"}`,
                fontSize: subtitle.fontSize,
                zIndex: index,
              }}
            >
              {subtitle.lines.map((line, lineIndex) => (
                <span className="video-dialogue-line" key={`${lineIndex}-${line}`}>
                  {line}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
