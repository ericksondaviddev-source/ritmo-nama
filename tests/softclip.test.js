import { describe, expect, it } from 'vitest';
import { curvaSoftClip } from '../src/core/audio/softclip.js';

describe('soft clip', () => {
  const curva = curvaSoftClip(2049);

  it('nunca sale de -1..1, ni con una entrada absurda', () => {
    for (const v of curva) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('mapea los extremos casi al límite, sin pasarse', () => {
    // Con zona lineal, una entrada de 1 sale algo por debajo: es la compresión
    // actuando justo en el tope. Lo importante es que nunca lo rebase.
    expect(Math.abs(curva[0])).toBeGreaterThan(0.85);
    expect(Math.abs(curva[0])).toBeLessThanOrEqual(1);
    expect(Math.abs(curva[curva.length - 1])).toBeGreaterThan(0.85);
    expect(Math.abs(curva[curva.length - 1])).toBeLessThanOrEqual(1);
  });

  it('cruza por cero en el centro', () => {
    const medio = curva[Math.floor(curva.length / 2)];
    expect(Math.abs(medio)).toBeLessThan(0.01);
  });

  it('es monótona: más entrada, más salida (no invierte el golpe)', () => {
    for (let i = 1; i < curva.length; i++) {
      expect(curva[i], `punto ${i}`).toBeGreaterThan(curva[i - 1]);
    }
  });

  it('deja intacta la señal por debajo de la rodilla', () => {
    // Es lo que la hace transparente: en el uso normal no cambia el color.
    for (const x of [0.1, 0.3, 0.5]) {
      const i = Math.round(((x + 1) / 2) * (curva.length - 1));
      expect(curva[i], `entrada ${x}`).toBeCloseTo(x, 2);
    }
  });

  it('comprime por encima de la rodilla sin subir nunca el nivel', () => {
    for (const x of [0.7, 0.85, 1]) {
      const i = Math.round(((x + 1) / 2) * (curva.length - 1));
      expect(curva[i], `entrada ${x}`).toBeLessThanOrEqual(x + 1e-6);
      expect(curva[i], `entrada ${x}`).toBeGreaterThan(0.6);
    }
  });

  it('respeta el límite que se le pase', () => {
    const suave = curvaSoftClip(1025, 0.5);
    for (const v of suave) {
      expect(v).toBeLessThanOrEqual(0.5);
      expect(v).toBeGreaterThanOrEqual(-0.5);
    }
  });
});
