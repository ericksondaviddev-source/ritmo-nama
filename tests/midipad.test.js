import { describe, expect, it, vi } from 'vitest';
import { createFakeAudioContext } from './fakes/fake-audio-context.js';
import { createMidipadAudio } from '../src/core/audio/midipad.js';
import { PATTERNS } from '../src/data/patterns.js';

const STEM_IDS = ['prima', 'cruzao', 'pujao', 'paila', 'maracas', 'cuatro'];

describe('midipad: estado', () => {
  it('toggleCell cicla 0 → 1 → 2 → 0 y rechaza índices inválidos', () => {
    const pad = createMidipadAudio({ engine: { trigger() {} } });
    expect(pad.toggleCell('prima', 0)).toBe(1);
    expect(pad.toggleCell('prima', 0)).toBe(2);
    expect(pad.toggleCell('prima', 0)).toBe(0);
    expect(pad.toggleCell('prima', -1)).toBe(null);
    expect(pad.toggleCell('prima', 12)).toBe(null);
    expect(pad.toggleCell('nope', 0)).toBe(null);
  });

  it('applyPreset carga steps (acento=2), bpm y swing; false con id desconocido', () => {
    const pad = createMidipadAudio({ engine: { trigger() {} } });
    expect(pad.applyPreset('guaira-tradicional')).toBe(true);
    const pattern = PATTERNS.find((p) => p.id === 'guaira-tradicional');
    expect(pad.state.steps.prima[0]).toBe(2); // golpe con acento
    expect(pad.state.steps.cruzao[0]).toBe(0);
    expect(pad.state.steps.paila.filter((c) => c > 0).length).toBe(
      pattern.steps.paila.filter(Boolean).length
    );
    expect(pad.state.bpm).toBe(pattern.bpm);
    expect(pad.applyPreset('nope')).toBe(false);
  });

  it('setMixer clampea volumen/pan/afinación', () => {
    const pad = createMidipadAudio({ engine: { trigger() {} } });
    expect(pad.setMixer('prima', { volume: 5, pan: 2, tuning: -20 })).toBe(true);
    expect(pad.state.mixer.prima.volume).toBe(1.5);
    expect(pad.state.mixer.prima.pan).toBe(1);
    expect(pad.state.mixer.prima.tuning).toBe(-12);
    expect(pad.setMixer('nope', { volume: 1 })).toBe(false);
  });
});

describe('midipad: reproducción', () => {
  it('playHit respeta mute y solo', () => {
    const triggers = [];
    const pad = createMidipadAudio({ engine: { trigger: (id, o) => triggers.push({ id, ...o }) } });
    pad.setMixer('prima', { mute: true });
    pad.playHit('prima', 0, 1);
    expect(triggers).toHaveLength(0);

    pad.setMixer('prima', { mute: false });
    pad.setMixer('cruzao', { solo: true });
    pad.playHit('prima', 0, 1);
    expect(triggers).toHaveLength(0);
    pad.playHit('cruzao', 0, 1);
    expect(triggers).toHaveLength(1);
    expect(triggers[0].accent).toBe(false);
  });

  it('playHit aplica mixer y acento al golpe', () => {
    const triggers = [];
    const pad = createMidipadAudio({ engine: { trigger: (id, o) => triggers.push({ id, ...o }) } });
    pad.setMixer('pujao', { volume: 0.8, pan: -0.5, tuning: -5 });
    pad.playHit('pujao', 1.25, 2);
    expect(triggers[0]).toMatchObject({
      id: 'pujao',
      time: 1.25,
      accent: true,
      volume: 0.8,
      pan: -0.5,
      pitchShift: -5
    });
  });

  it('start/stop con context inyectado agenda los golpes de la grid', () => {
    vi.useFakeTimers();
    const ctx = createFakeAudioContext({ currentTime: 0 });
    const triggers = [];
    const pad = createMidipadAudio({
      engine: { trigger: (id, o) => triggers.push({ id, ...o }) },
      getContext: () => ctx
    });
    pad.applyPreset('guaira-tradicional');
    pad.start();
    ctx.currentTime = 2;
    vi.advanceTimersByTime(120);
    expect(triggers.length).toBeGreaterThan(0);
    expect(triggers.every((t) => STEM_IDS.includes(t.id))).toBe(true);
    expect(pad.isRunning).toBe(true);
    pad.stop();
    expect(pad.isRunning).toBe(false);
    vi.useRealTimers();
  });

  it('warmUp dispara cada stem con volumen 0', () => {
    const triggers = [];
    const pad = createMidipadAudio({
      engine: { trigger: (id, o) => triggers.push({ id, ...o }) },
      getContext: () => createFakeAudioContext({ currentTime: 5 })
    });
    pad.warmUp();
    expect(triggers).toHaveLength(6);
    expect(triggers.every((t) => t.volume === 0)).toBe(true);
  });
});
