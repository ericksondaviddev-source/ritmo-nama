import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { createDrumEngine } from '../src/core/audio/drum-engine.js';
import { createVisualizer } from '../src/core/audio/visualizer.js';
import { createFakeAudioContext } from './fakes/fake-audio-context.js';
import { existsSync } from 'fs';
import { PATTERNS } from '../src/data/patterns.js';

// --- Doble de canvas 2D que registra lo dibujado -------------------
function createFakeCanvas() {
  const ops = [];
  const ctx2d = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'clearRect') return (...a) => ops.push(['clearRect', ...a]);
        if (prop === 'fillRect') return (...a) => ops.push(['fillRect', ...a]);
        if (prop === 'beginPath' || prop === 'arc' || prop === 'stroke') {
          return (...a) => ops.push([prop, ...a]);
        }
        return undefined;
      },
      set() {
        return true;
      }
    }
  );
  return { width: 960, height: 320, getContext: () => ctx2d, ops };
}

// requestAnimationFrame controlable para avanzar fotogramas a mano.
let rafQueue = [];
beforeEach(() => {
  rafQueue = [];
  vi.stubGlobal('requestAnimationFrame', (fn) => {
    rafQueue.push(fn);
    return rafQueue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  rafQueue = [];
});

const flushFrames = (n, clock, advance = 0.05) => {
  for (let i = 0; i < n; i++) {
    const pending = rafQueue;
    rafQueue = [];
    if (clock) clock.currentTime += advance;
    for (const fn of pending) fn(clock ? clock.currentTime * 1000 : 0);
  }
};

const allVisible = () => ({}); // stemVisibility[id] !== false

describe('visualizador: dispara el patrón real a través del engine', () => {
  it('llama a engine.trigger con el tiempo de audio de cada hit', () => {
    const clock = createFakeAudioContext({ currentTime: 0 });
    const canvas = createFakeCanvas();
    const trigger = vi.fn();
    const engine = { trigger };

    const viz = createVisualizer({
      patternId: 'guaira-tradicional',
      bpm: 124,
      swing: 40,
      getContext: () => clock,
      canvas,
      stemVisibility: allVisible(),
      style: 'barras',
      engine
    });

    viz.start();
    flushFrames(3, clock);
    viz.stop();

    expect(trigger).toHaveBeenCalled();
    // Todo trigger debe llevar un tiempo numérico de AudioContext.
    for (const [id, opts] of trigger.mock.calls) {
      expect(typeof opts.time).toBe('number');
      expect(opts.time).toBeGreaterThan(0);
      expect(id).toBeTruthy();
    }
  });

  it('sin engine no lanza y solo dibuja', () => {
    const clock = createFakeAudioContext({ currentTime: 0 });
    const canvas = createFakeCanvas();
    const viz = createVisualizer({
      patternId: 'guaira-tradicional',
      bpm: 124,
      getContext: () => clock,
      canvas,
      stemVisibility: allVisible(),
      style: 'barras',
      engine: null
    });
    expect(() => {
      viz.start();
      flushFrames(3, clock);
      viz.stop();
    }).not.toThrow();
  });

  it('respeta el filtro de stems: no dispara los ocultos', () => {
    const clock = createFakeAudioContext({ currentTime: 0 });
    const canvas = createFakeCanvas();
    const trigger = vi.fn();
    const visibility = { maracas: false, cuatro: false, prima: true, cruzao: true, pujao: true, paila: true };

    const viz = createVisualizer({
      patternId: 'guaira-tradicional',
      bpm: 124,
      getContext: () => clock,
      canvas,
      stemVisibility: visibility,
      style: 'barras',
      engine: { trigger }
    });

    viz.start();
    flushFrames(4, clock);
    viz.stop();

    const called = new Set(trigger.mock.calls.map(([id]) => id));
    expect(called.has('maracas')).toBe(false);
    expect(called.has('cuatro')).toBe(false);
  });
});

describe('visualizador: sincronía con el reloj de AudioContext', () => {
  it('no adelanta el step: la cola se consume según ctx.currentTime', () => {
    const clock = createFakeAudioContext({ currentTime: 0 });
    const canvas = createFakeCanvas();
    const engine = { trigger: vi.fn() };

    const viz = createVisualizer({
      patternId: 'guaira-tradicional',
      bpm: 124,
      getContext: () => clock,
      canvas,
      stemVisibility: allVisible(),
      style: 'anillos-reactivos',
      engine
    });

    viz.start();
    // Primer fotograma SIN avanzar el reloj: el scheduler ya agendó por
    // delante, pero ctx.currentTime sigue en 0 -> aún no se dibuja ningún step.
    flushFrames(1, clock, 0);
    const ringsAtZero = canvas.ops.filter((o) => o[0] === 'arc').length;
    expect(ringsAtZero).toBe(0);

    // Al avanzar el reloj, el step agendado pasa a ser visible.
    clock.currentTime = 0.5;
    flushFrames(1, clock, 0);
    expect(canvas.ops.filter((o) => o[0] === 'arc').length).toBeGreaterThan(0);
    viz.stop();
  });
});

describe('visualizador: ciclo de vida', () => {
  it('start() es idempotente y stop() limpia el canvas', () => {
    const clock = createFakeAudioContext({ currentTime: 0 });
    const canvas = createFakeCanvas();
    const engine = { trigger: vi.fn() };
    const viz = createVisualizer({
      patternId: 'guaira-tradicional',
      bpm: 124,
      getContext: () => clock,
      canvas,
      stemVisibility: allVisible(),
      style: 'barras',
      engine
    });

    viz.start();
    const afterFirst = engine.trigger.mock.calls.length;
    viz.start(); // no debe duplicar
    expect(engine.trigger.mock.calls.length).toBe(afterFirst);

    viz.stop();
    expect(viz.isRunning).toBe(false);
    expect(canvas.ops[canvas.ops.length - 1][0]).toBe('clearRect');
  });

  it('setStyle cambia el estilo en caliente sin reiniciar', () => {
    const clock = createFakeAudioContext({ currentTime: 0 });
    const canvas = createFakeCanvas();
    const viz = createVisualizer({
      patternId: 'guaira-tradicional',
      bpm: 124,
      getContext: () => clock,
      canvas,
      stemVisibility: allVisible(),
      style: 'barras',
      engine: { trigger: vi.fn() }
    });
    viz.start();
    flushFrames(2, clock);
    const before = canvas.ops.filter((o) => o[0] === 'fillRect').length;
    viz.setStyle('ondas-circulares');
    flushFrames(2, clock);
    // Tras el cambio ya no dibuja barras: dibuja arcos.
    expect(canvas.ops.slice(-20).some((o) => o[0] === 'arc')).toBe(true);
    expect(before).toBeGreaterThan(0);
    viz.stop();
  });

  it('devuelve null si el patrón no existe', () => {
    const canvas = createFakeCanvas();
    const viz = createVisualizer({
      patternId: 'no-existe',
      bpm: 124,
      getContext: () => createFakeAudioContext(),
      canvas,
      stemVisibility: allVisible(),
      style: 'barras'
    });
    expect(viz).toBeNull();
  });
});

describe('patrones: estructura usada por el visualizador', () => {
  it('todo patrón tiene steps de 12 posiciones', () => {
    for (const p of PATTERNS) {
      for (const [stem, arr] of Object.entries(p.steps)) {
        expect(arr.length, `${p.id}.${stem}`).toBe(12);
      }
    }
  });
});

describe('engine: output de grabación', () => {
  it('connectOutput + disconnectOutput no lanzan y siguen disparando', () => {
    const ctx = createFakeAudioContext({ currentTime: 0 });
    const engine = createDrumEngine(() => ctx);
    const extra = ctx.createGain();
    engine.connectOutput(extra);
    expect(() => engine.disconnectOutput(extra)).not.toThrow();
    expect(() => engine.trigger('prima')).not.toThrow();
  });
});

describe('curso: MP3 de narración TTS generados', () => {
  const dir = 'public/assets/audio/course';
  for (const id of ['prima', 'cruzao', 'pujao', 'paila']) {
    it(`existe ${id}.mp3`, () => {
      expect(existsSync(`${dir}/${id}.mp3`)).toBe(true);
    });
  }
});
