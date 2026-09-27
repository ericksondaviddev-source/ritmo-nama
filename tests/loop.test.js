import { describe, expect, it, vi } from 'vitest';
import { createFakeAudioContext } from './fakes/fake-audio-context.js';
import { playSoloLoop } from '../src/core/audio/loop.js';
import { PATTERNS } from '../src/data/patterns.js';

describe('playSoloLoop', () => {
  it('dispara solo el instrumento del módulo y loopea', () => {
    vi.useFakeTimers();
    const ctx = createFakeAudioContext({ currentTime: 0 });
    const triggers = [];
    const engine = { trigger: (id, opts) => triggers.push({ id, ...opts }) };

    const scheduler = playSoloLoop({
      engine,
      drumId: 'prima',
      patternId: 'guaira-tradicional',
      swing: 40,
      getContext: () => ctx
    });

    expect(scheduler).toBeTruthy();
    ctx.currentTime = 3;
    vi.advanceTimersByTime(120);

    expect(triggers.length).toBeGreaterThan(0);
    expect(triggers.every((t) => t.id === 'prima')).toBe(true);
    expect(scheduler.isRunning).toBe(true);
    scheduler.stop();
    expect(scheduler.isRunning).toBe(false);
    vi.useRealTimers();
  });

  it('respeta los acentos del patrón', () => {
    vi.useFakeTimers();
    const ctx = createFakeAudioContext({ currentTime: 0 });
    const triggers = [];
    const engine = { trigger: (id, opts) => triggers.push({ id, ...opts }) };

    const scheduler = playSoloLoop({
      engine,
      drumId: 'prima',
      patternId: 'guaira-tradicional',
      swing: 40,
      getContext: () => ctx
    });
    ctx.currentTime = 6;
    vi.advanceTimersByTime(200);
    scheduler.stop();

    const pattern = PATTERNS.find((p) => p.id === 'guaira-tradicional');
    const withAccent = triggers.filter((t) => t.accent).length;
    const expected = pattern.accents.prima.filter(Boolean).length;
    expect(withAccent).toBeGreaterThanOrEqual(expected);
    vi.useRealTimers();
  });

  it('devuelve null con instrumento o patrón desconocido', () => {
    expect(playSoloLoop({ engine: { trigger() {} }, drumId: 'nope' })).toBe(null);
    expect(playSoloLoop({ engine: { trigger() {} }, drumId: 'prima', patternId: 'nope' })).toBe(null);
  });
});
