import { PATTERNS } from '../../data/patterns.js';
import { createScheduler } from './scheduler.js';

// Loop infinito de un solo instrumento: el scheduler ya loopea (stepIndex % steps)
// hasta stop(); aquí solo se agenda el tambor del módulo (minicurso).
export function playSoloLoop({
  engine,
  patternId = 'guaira-tradicional',
  drumId,
  swing = 40,
  articulation = null,
  getContext
} = {}) {
  const pattern = PATTERNS.find((p) => p.id === patternId);
  if (!pattern || !engine || !drumId || !pattern.steps[drumId]) return null;
  // Por defecto la articulación que declara el propio patrón: si no, la paila
  // sonaría a baqueta de laurel, que no existe para ella.
  const artic = articulation ?? pattern.articulation?.[drumId] ?? null;

  const scheduler = createScheduler({
    bpm: pattern.bpm,
    swing,
    ...(getContext ? { getContext } : {}),
    onStep(step, time) {
      if (pattern.steps[drumId]?.[step]) {
        engine.trigger(drumId, {
          time,
          accent: Boolean(pattern.accents?.[drumId]?.[step]),
          articulation: artic
        });
      }
    }
  });

  scheduler.start();
  return scheduler;
}
