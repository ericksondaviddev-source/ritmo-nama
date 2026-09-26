import { describe, expect, it } from 'vitest';
import { MAX_SWING_PERCENT, STEPS_PER_CYCLE, stepDurationSec, swingOffsetSec } from '../src/core/audio/timing.js';

describe('timing', () => {
  it('12 pasos por ciclo y duración de paso = 60/bpm/3 (subdivisión de 6/8)', () => {
    expect(STEPS_PER_CYCLE).toBe(12);
    expect(stepDurationSec(120)).toBeCloseTo(0.166667, 5);
    expect(stepDurationSec(124)).toBeCloseTo(0.16129, 5);
  });

  it('el swing solo afecta al paso 1 de cada tercia (índice % 3 === 1)', () => {
    expect(swingOffsetSec(120, 40, 0)).toBe(0);
    expect(swingOffsetSec(120, 40, 1)).toBeGreaterThan(0);
    expect(swingOffsetSec(120, 40, 2)).toBe(0);
    expect(swingOffsetSec(120, 40, 4)).toBeGreaterThan(0);
  });

  it('con swing 0 no hay offset y el swing está acotado al 60 %', () => {
    expect(swingOffsetSec(120, 0, 1)).toBe(0);
    const atMax = swingOffsetSec(120, MAX_SWING_PERCENT, 1);
    const overMax = swingOffsetSec(120, 100, 1);
    expect(overMax).toBeCloseTo(atMax);
    expect(atMax).toBeCloseTo(0.6 * stepDurationSec(120) * 0.45);
  });
});
