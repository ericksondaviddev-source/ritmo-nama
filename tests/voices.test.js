import { describe, expect, it } from 'vitest';
import { voiceSpec } from '../src/core/audio/voices.js';

describe('voiceSpec v2', () => {
  it('pujao: 3 osciladores (cuerpo 110→48 + sub 55→40 + ring 260→200) + ruido grave', () => {
    const spec = voiceSpec('pujao', 1);
    const oscs = spec.filter((s) => s.kind === 'osc');
    expect(oscs).toHaveLength(3);
    expect(oscs[0]).toMatchObject({ type: 'sine', from: 110, to: 48, glide: 0.16, gain: 1.1, decay: 0.55, stop: 0.6 });
    expect(oscs[1]).toMatchObject({ type: 'sine', from: 55, to: 40 });
    expect(oscs[2]).toMatchObject({ type: 'triangle', from: 260, to: 200 });
    expect(spec.filter((s) => s.kind === 'noise')).toHaveLength(1);
    expect(spec[0].filter).toMatchObject({ type: 'lowpass', freq: 500 });
  });

  it('prima: capas = slap(ruido bandpass 2600) + cuerpo(sine 380→210) + ring(tri 1150) + aire(lowpass 900)', () => {
    const spec = voiceSpec('prima', 1);
    expect(spec[0]).toMatchObject({ kind: 'noise', filter: { type: 'bandpass', freq: 2600, q: 4 } });
    expect(spec[1]).toMatchObject({ kind: 'osc', type: 'sine', from: 380, to: 210 });
    expect(spec[2]).toMatchObject({ kind: 'osc', type: 'triangle', from: 1150, to: 900 });
    expect(spec[3]).toMatchObject({ kind: 'noise', filter: { type: 'lowpass', freq: 900 } });
  });

  it('cruzao: cuerpo triangle 240→120 + ring sine 720 + 2 ruidos', () => {
    const spec = voiceSpec('cruzao', 1);
    const oscs = spec.filter((s) => s.kind === 'osc');
    expect(oscs[0]).toMatchObject({ type: 'triangle', from: 240, to: 120 });
    expect(oscs[1]).toMatchObject({ type: 'sine', from: 720, to: 660 });
    expect(spec.filter((s) => s.kind === 'noise')).toHaveLength(2);
  });

  it('paila: 4 osciladores con hand-slap (no parciales metálicos) + ruido de palma', () => {
    const spec = voiceSpec('paila', 1);
    const oscs = spec.filter((s) => s.kind === 'osc');
    expect(oscs).toHaveLength(2);
    expect(oscs.map((o) => o.from)).toEqual([260, 900]);
    expect(spec.filter((s) => s.kind === 'noise')).toHaveLength(2);
    expect(spec[0].filter).toMatchObject({ type: 'bandpass', freq: 1900 });
  });

  it('aplica pitchRatio a todas las frecuencias', () => {
    const spec = voiceSpec('prima', 2);
    expect(spec[1].from).toBe(760);
    expect(spec[1].to).toBe(420);
    expect(spec[0].filter.freq).toBe(5200);
  });

  it('maracas y cuatro existen; id desconocido devuelve []', () => {
    expect(voiceSpec('maracas', 1).length).toBeGreaterThan(0);
    expect(voiceSpec('cuatro', 1).length).toBeGreaterThan(0);
    expect(voiceSpec('inventado', 1)).toEqual([]);
  });
});
