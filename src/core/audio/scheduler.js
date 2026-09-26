import { getAudioContext } from './context.js';
import { STEPS_PER_CYCLE, stepDurationSec, swingOffsetSec } from './timing.js';

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.1;

export function createScheduler({
  getContext = getAudioContext,
  onStep,
  bpm = 124,
  swing = 40,
  lookaheadMs = LOOKAHEAD_MS,
  scheduleAheadSec = SCHEDULE_AHEAD_SEC,
  steps = STEPS_PER_CYCLE
} = {}) {
  let timer = null;
  let nextStepTime = 0;
  let stepIndex = -1;
  let currentBpm = bpm;
  let currentSwing = swing;

  function schedule() {
    const ctx = getContext();
    if (!ctx) return;
    while (nextStepTime < ctx.currentTime + scheduleAheadSec) {
      stepIndex = (stepIndex + 1) % steps;
      const offset = swingOffsetSec(currentBpm, currentSwing, stepIndex);
      onStep(stepIndex, nextStepTime + offset);
      nextStepTime += stepDurationSec(currentBpm);
    }
  }

  return {
    start() {
      const ctx = getContext();
      if (!ctx || timer !== null) return;
      nextStepTime = ctx.currentTime + 0.05;
      schedule();
      timer = setInterval(schedule, lookaheadMs);
    },
    stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      stepIndex = -1;
    },
    setBpm(value) {
      currentBpm = Math.max(40, Math.min(240, value));
    },
    setSwing(value) {
      currentSwing = Math.max(0, Math.min(60, value));
    },
    get isRunning() {
      return timer !== null;
    },
    get step() {
      return stepIndex;
    }
  };
}
