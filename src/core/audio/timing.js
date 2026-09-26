export const STEPS_PER_CYCLE = 12;
export const MAX_SWING_PERCENT = 60;

export function stepDurationSec(bpm) {
  return 60 / bpm / 3;
}

export function swingOffsetSec(bpm, swingPercent, stepIndex) {
  if (swingPercent <= 0) return 0;
  if (stepIndex % 3 !== 1) return 0;
  const capped = Math.min(swingPercent, MAX_SWING_PERCENT);
  return (capped / 100) * stepDurationSec(bpm) * 0.45;
}
