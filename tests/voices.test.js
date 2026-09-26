import { describe, expect, it } from 'vitest';
import { PAILA_PARTIALS, voiceSpec } from '../src/core/audio/voices.js';

describe('voiceSpec', () => {
  it('pujao: osc sine con caída 130→48 en 0.18 s y ruido filtrado grave', () => {
    const [osc, noise] = voiceSpec('pujao', 1);
    expect(osc).toMatchObject({
      kind: 'osc',
      type: 'sine',
      from: 130,
      to: 48,
      glide: 0.18,
      gain: 1,
      decay: 0.45,
      stop: 0.48
    });
    expect(noise).toMatchObject({ kind: 'noise', filter: { type: 'lowpass', freq: 600 } });
  });

  it('prima: slap agudo con ruido bandpass 2400 y Q 4', () => {
    const [osc, noise] = voiceSpec('prima', 1);
    expect(osc.from).toBe(380);
    expect(osc.to).toBe(210);
    expect(noise.filter).toMatchObject({ type: 'bandpass', freq: 2400, q: 4 });
  });

  it('cruzao: triángulo medio con ruido bandpass 1200', () => {
    const [osc, noise] = voiceSpec('cruzao', 1);
    expect(osc.type).toBe('triangle');
    expect(noise.filter.freq).toBe(1200);
  });

  it('paila: 4 parciales metálicos decrecientes + ruido highpass', () => {
    const spec = voiceSpec('paila', 1);
    const oscs = spec.filter((s) => s.kind === 'osc');
    expect(oscs).toHaveLength(PAILA_PARTIALS.length);
    expect(oscs.map((o) => o.from)).toEqual(PAILA_PARTIALS);
    expect(oscs[0].gain).toBeGreaterThan(oscs[1].gain);
    expect(spec.at(-1).filter.type).toBe('highpass');
  });

  it('aplica pitchRatio a todas las frecuencias', () => {
    const [osc, noise] = voiceSpec('prima', 2);
    expect(osc.from).toBe(760);
    expect(osc.to).toBe(420);
    expect(noise.filter.freq).toBe(4800);
  });

  it('maracas y cuatro existen; id desconocido devuelve []', () => {
    expect(voiceSpec('maracas', 1).length).toBeGreaterThan(0);
    expect(voiceSpec('cuatro', 1).length).toBeGreaterThan(0);
    expect(voiceSpec('inventado', 1)).toEqual([]);
  });
});
