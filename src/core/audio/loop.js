import { PATTERNS } from '../../data/patterns.js';
import { createScheduler } from './scheduler.js';

// Loop infinito de un solo instrumento: el scheduler ya loopea (stepIndex % steps)
// hasta stop(); aquí solo se agenda el tambor del módulo (minicurso).
export function playSoloLoop({ engine, patternId = 'guaira-tradicional', drumId, swing = 40, getContext } = {}) {
  const pattern = PATTERNS.find((p) => p.id === patternId);
  if (!pattern || !engine || !drumId || !pattern.steps[drumId]) return null;

  const scheduler = createScheduler({
    bpm: pattern.bpm,
    swing,
    ...(getContext ? { getContext } : {}),
    onStep(step, time) {
      if (pattern.steps[drumId]?.[step]) {
        engine.trigger(drumId, { time, accent: Boolean(pattern.accents?.[drumId]?.[step]) });
      }
    }
  });

  scheduler.start();
  return scheduler;
}
