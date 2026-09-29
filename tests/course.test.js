import { describe, expect, it } from 'vitest';
import { COURSE, COURSE_INTRO } from '../src/data/course.js';
import { PATTERNS } from '../src/data/patterns.js';
import { articulationsFor, ARTICULATIONS } from '../src/data/drums.js';

const FULIA_IDS = ['prima', 'cruzao', 'pujao', 'paila'];

describe('minicurso', () => {
  it('son 4 módulos, uno por tambor de fulia, con contenido y patrón válido', () => {
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

  it('cada módulo declara una articulación que su tambor admite', () => {
    for (const mod of COURSE) {
      expect(ARTICULATIONS[mod.articulation], mod.instrument).toBeTruthy();
      expect(articulationsFor(mod.instrument), mod.instrument).toContain(mod.articulation);
    }
  });

  it('la lección de la paila dice que no lleva baqueta', () => {
    const paila = COURSE.find((m) => m.instrument === 'paila');
    expect(paila.tecnica.toLowerCase()).toMatch(/no lleva baqueta|palmas/);
    expect(paila.articulation).toBe('mano');
  });

  it('primera, cruzao y pujao enseñan el doble parche y las dos manos', () => {
    for (const id of ['prima', 'cruzao', 'pujao']) {
      const mod = COURSE.find((m) => m.instrument === id);
      const texto = `${mod.concepto} ${mod.tecnica}`.toLowerCase();
      expect(texto, id).toMatch(/doble parche/);
      expect(texto, id).toMatch(/laurel/);
    }
  });

  it('el texto es narrable: sin caracteres fuera del alfabeto español', () => {
    for (const mod of [...COURSE.map((m) => `${m.title} ${m.concepto} ${m.tecnica}`), COURSE_INTRO.intro]) {
      const raros = mod.match(/[^\u0020-\u007E\u00A0-\u024F\u2010-\u201F]/g) ?? [];
      expect(raros, mod.slice(0, 40)).toEqual([]);
    }
  });
});

describe('introducción del curso', () => {
  it('sitúa el velorio de Cruz de Mayo con fechas y lugar', () => {
    expect(COURSE_INTRO.titulo).toMatch(/Cruz de Mayo/);
    expect(COURSE_INTRO.intro).toMatch(/mayo/);
    expect(COURSE_INTRO.intro).toMatch(/junio/);
    expect(COURSE_INTRO.intro).toMatch(/La Guaira/);
  });
});
