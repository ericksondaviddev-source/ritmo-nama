import { describe, expect, it } from 'vitest';
import { COURSE } from '../src/data/course.js';
import { PATTERNS } from '../src/data/patterns.js';

const FULIA_IDS = ['prima', 'cruzao', 'pujao', 'paila'];

describe('minicurso', () => {
  it('son 4 módulos, uno por instrumento de fulia, con contenido y patrón válido', () => {
    expect(COURSE).toHaveLength(4);
    expect(COURSE.map((m) => m.instrument)).toEqual(FULIA_IDS);
    for (const mod of COURSE) {
      expect(mod.title).toBeTruthy();
      expect(mod.concepto.length).toBeGreaterThan(20);
      expect(mod.tecnica.length).toBeGreaterThan(20);
      expect(PATTERNS.some((p) => p.id === mod.patternId)).toBe(true);
      const pattern = PATTERNS.find((p) => p.id === mod.patternId);
      expect(pattern.steps[mod.instrument].some(Boolean)).toBe(true);
    }
  });
});
