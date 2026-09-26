import { PATTERNS } from '../../data/patterns.js';
import { createScheduler } from './scheduler.js';

export function playFuliaDemo({ engine, patternId = 'guaira-tradicional', cycles = 3, swing = 40, onStop } = {}) {
  const pattern = PATTERNS.find((p) => p.id === patternId);
  if (!pattern || !engine) return null;

  let completedCycles = 0;
  const lastStep = pattern.steps.prima.length - 1;

  const scheduler = createScheduler({
    bpm: pattern.bpm,
    swing,
    onStep(step, time) {
      if (completedCycles >= cycles) return;
      for (const [drumId, steps] of Object.entries(pattern.steps)) {
        if (steps[step]) {
          engine.trigger(drumId, { time, accent: Boolean(pattern.accents?.[drumId]?.[step]) });
        }
      }
      if (step === lastStep) {
        completedCycles += 1;
        if (completedCycles >= cycles) {
          scheduler.stop();
          onStop?.();
        }
      }
    }
  });

  scheduler.start();
  return scheduler;
}
