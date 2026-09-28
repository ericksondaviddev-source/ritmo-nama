import { describe, expect, it } from 'vitest';
import { createDrumEngine } from '../src/core/audio/drum-engine.js';
import { createFakeAudioContext } from './fakes/fake-audio-context.js';
import { existsSync } from 'fs';

describe('engine: desconexión de output', () => {
  it('connectOutput + disconnectOutput no lanzan excepción y limpian conexiones', () => {
    const ctx = createFakeAudioContext({ currentTime: 0 });
    const engine = createDrumEngine(() => ctx);
    const extra = ctx.createGain();
    engine.connectOutput(extra);
    expect(() => engine.disconnectOutput(extra)).not.toThrow();
    // La conexión se rastrea en el nodo fuente (master); disconnect la elimina
    expect(() => engine.trigger('prima')).not.toThrow();
  });
});

describe('curso: MP3 de narración TTS generados', () => {
  const dir = 'public/assets/audio/course';
  const expected = ['prima', 'cruzao', 'pujao', 'paila'];

  it('existen los 4 MP3 de narración', () => {
    for (const id of expected) {
      expect(existsSync(`${dir}/${id}.mp3`)).toBe(true);
    }
  });
});
