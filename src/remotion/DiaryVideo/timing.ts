export const secondsToFrames = (seconds: number, fps: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(fps) || fps <= 0) return 1;
  const frames = Math.ceil(seconds * fps);
  return Number.isSafeInteger(frames) && frames > 0 ? frames : 1;
};
