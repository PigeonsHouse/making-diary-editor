export type BgmMuteDialogueTiming = { from: number; muted: boolean };

export function createBgmMutedSections(
  blockFrom: number,
  blockDuration: number,
  blockMuted: boolean,
  dialogues: BgmMuteDialogueTiming[],
) {
  if (blockMuted) return [{ from: blockFrom, duration: blockDuration }];
  return dialogues.flatMap((dialogue, index) => {
    if (!dialogue.muted) return [];
    const end = dialogues[index + 1]?.from ?? blockFrom + blockDuration;
    return [{ from: dialogue.from, duration: Math.max(0, end - dialogue.from) }];
  });
}
