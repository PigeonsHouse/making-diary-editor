"use client";

import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { ContentBlock } from "@/domain/types";
import { WishMarkdown } from "../WishMarkdown";
import { DialogueLayer } from "./DialogueLayer";
import type { DiaryVideoProps } from "./types";

export function WishScene({ project, characters, block, defaultEndHold }: DiaryVideoProps & { block: ContentBlock }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill className="video-notebook">
      <WishMarkdown markdown={project.wishList?.markdown ?? ""} />
      <DialogueLayer
        block={block}
        localFrame={frame}
        blockStartFrame={0}
        characters={characters}
        defaultEndHold={defaultEndHold}
      />
    </AbsoluteFill>
  );
}
