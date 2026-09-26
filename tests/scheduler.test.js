import { afterEach, describe, expect, it, vi } from 'vitest';
import { createScheduler } from '../src/core/audio/scheduler.js';
import { createFakeAudioContext } from './fakes/fake-audio-context.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('scheduler (lookahead)', () => {
  it('agenda el primer paso al iniciar y el siguiente dentro de la ventana', () => {
    vi.useFakeTimers();
    const ctx = createFakeAudioContext({ currentTime: 0 });
    const steps = [];

    const scheduler = createScheduler({
      getContext: () => ctx,
      onStep: (step, time) => steps.push({ step, time }),
      bpm: 120,
      swing: 0
    });

    scheduler.start();
    expect(steps).toEqual([{ step: 0, time: 0.05 }]);

    ctx.currentTime = 0.25;
    vi.advanceTimersByTime(25);
    expect(steps.map((s) => s.step)).toEqual([0, 1]);
    expect(steps[1].time).toBeCloseTo(0.05 + 60 / 120 / 3);

    scheduler.stop();
    ctx.currentTime = 1;
    vi.advanceTimersByTime(100);
    expect(steps).toHaveLength(2);
  });

  it('el swing desplaza el tiempo reportado del paso 1', () => {
    vi.useFakeTimers();
    const ctx = createFakeAudioContext({ currentTime: 0 });
    const steps = [];

    const scheduler = createScheduler({
      getContext: () => ctx,
      onStep: (step, time) => steps.push({ step, time }),
      bpm: 120,
      swing: 40
    });

    scheduler.start();
    ctx.currentTime = 0.3;
    vi.advanceTimersByTime(25);

    const step1 = steps.find((s) => s.step === 1);
    const expected = 0.05 + 60 / 120 / 3 + (40 / 100) * (60 / 120 / 3) * 0.45;
    expect(step1.time).toBeCloseTo(expected);
    scheduler.stop();
  });

  it('setBpm cambia la duración de los pasos siguientes', () => {
    vi.useFakeTimers();
    const ctx = createFakeAudioContext({ currentTime: 0 });
    const steps = [];

    const scheduler = createScheduler({
      getContext: () => ctx,
      onStep: (step, time) => steps.push({ step, time }),
      bpm: 120,
      swing: 0
    });

    scheduler.start();
    scheduler.setBpm(60);
    ctx.currentTime = 1;
    vi.advanceTimersByTime(25);

    const durations = steps.slice(1).map((s, i) => s.time - steps[i].time);
    expect(durations.at(-1)).toBeCloseTo(60 / 60 / 3);
    scheduler.stop();
  });
});
