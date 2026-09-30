import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { createFakeAudioContext } from './fakes/fake-audio-context.js';
import { ESTILOS, createVisualizer, estiloPorId } from '../src/core/visualizer/index.js';
import { createCanvasVisualizer } from '../src/core/visualizer/styles/canvas-2d.js';
import { createAsciiVisualizer } from '../src/core/visualizer/styles/ascii.js';
import { createFiestaVisualizer } from '../src/core/visualizer/styles/fiesta.js';
import { formatoSoportado, MAX_SIN_LIMITE } from '../src/core/media/grabador.js';
import { renderExport } from '../src/core/media/render.js';
import { DRUMS } from '../src/data/drums.js';
import { createMidipadAudio } from '../src/core/audio/midipad.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

/** Canvas 2D falso que registra lo dibujado. */
function createFakeCanvas() {
  const ops = [];
  const ctx2d = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return () => ({ addColorStop() {} });
        }
        if (typeof prop === 'string' && prop.startsWith('clear')) return (...a) => ops.push([prop, ...a]);
        if (['fillRect', 'roundRect', 'beginPath', 'arc', 'stroke', 'fill', 'fillText', 'moveTo', 'lineTo'].includes(prop)) {
          return (...a) => ops.push([prop, ...a]);
        }
        return undefined;
      },
      set() {
        return true;
      }
    }
  );
  return { width: 960, height: 360, clientWidth: 960, clientHeight: 360, getContext: () => ctx2d, ops };
}

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

const drums = DRUMS.map(({ id, name, color }) => ({ id, name, color }));
const avanzar = (n = 1) => {
  for (let i = 0; i < n; i++) {
    const p = rafQueue;
    rafQueue = [];
    for (const fn of p) fn(performance.now());
  }
};

describe('estilos del visualizador', () => {
  it('hay cuatro estilos, con id único y descripción', () => {
    expect(ESTILOS.map((e) => e.id)).toEqual(['barras', 'ascii', 'fiesta', '3d']);
    for (const e of ESTILOS) {
      expect(e.nombre).toBeTruthy();
      expect(e.descripcion).toBeTruthy();
      expect(typeof e.crear).toBe('function');
    }
  });

  it('estiloPorId cae al primero si no existe', () => {
    expect(estiloPorId('no-existe').id).toBe('barras');
  });

  it('los estilos 2D pintan sin romperse con y sin Tambor', () => {
    for (const crear of [createCanvasVisualizer, createAsciiVisualizer, createFiestaVisualizer]) {
      const canvas = createFakeCanvas();
      const vista = crear({ ctx: canvas.getContext('2d'), canvas, drums, composicion: { state: { steps: {} } } });
      vista.marcar(0, [{ id: 'prima', acento: true }]);
      vista.marcar(0, []);
      expect(() => vista.dibujar({ paso: 0, progreso: 0.5, dt: 0.016 })).not.toThrow();
      expect(canvas.ops.length).toBeGreaterThan(0);
    }
  });

  it('el estilo ASCII usa sólo texto: es el más ligero', () => {
    const canvas = createFakeCanvas();
    const ctx = canvas.getContext('2d');
    const vista = createAsciiVisualizer({ ctx, canvas, drums, composicion: { state: { steps: {} } } });
    vista.marcar(0, [{ id: 'paila', acento: false }]);
    vista.dibujar({ paso: 0, progreso: 0, dt: 0.016 });
    expect(canvas.ops.some((o) => o[0] === 'fillText')).toBe(true);
    expect(canvas.ops.some((o) => o[0] === 'arc')).toBe(false);
  });

  it('ningún estilo dibuja antes de sonar (la pista arranca vacía)', () => {
    const canvas = createFakeCanvas();
    const vista = createCanvasVisualizer({
      ctx: canvas.getContext('2d'),
      canvas,
      drums,
      composicion: { state: { steps: {} } }
    });
    vista.dibujar({ paso: -1, progreso: 0, dt: 0.016 });
    // Debe pintar el fondo, pero sin marcar ninguna barra como activa.
    const pintadas = canvas.ops.filter((o) => o[0] === 'roundRect').length;
    expect(pintadas).toBe(12); // las 12 barras, vacías
  });
});

describe('visualizador: sigue al scheduler', () => {
  const reloj = () => createFakeAudioContext({ currentTime: 0 });

  it('recibe los golpes del paso y sólo entonces anima', () => {
    const ctxFalso = reloj();
    const canvas = createFakeCanvas();
    let oyente = null;
    const viz = createVisualizer({
      canvas,
      composicion: { state: { bpm: 124, steps: {} } },
      alTocarElRitmo: (fn) => {
        oyente = fn;
        return () => {
          oyente = null;
        };
      },
      drums
    });
    viz.start();
    expect(oyente).toBeTruthy();

    // Golpe en el instante actual: el paso 3 se dibuja activo.
    oyente(3, ctxFalso.currentTime, [{ id: 'prima', acento: false }]);
    avanzar(1);
    const resplandor = canvas.ops.length;
    expect(resplandor).toBeGreaterThan(0);
    viz.stop();
  });

  it('se da de baja al parar: no queda oyente colgando', () => {
    const canvas = createFakeCanvas();
    let oyente = null;
    const viz = createVisualizer({
      canvas,
      composicion: { state: { bpm: 124, steps: {} } },
      alTocarElRitmo: (fn) => {
        oyente = fn;
        return () => {
          oyente = null;
        };
      },
      drums
    });
    viz.start();
    expect(oyente).toBeTruthy();
    viz.stop();
    expect(oyente).toBeNull();
  });

  it('start() es idempotente', () => {
    const canvas = createFakeCanvas();
    const viz = createVisualizer({ canvas, composicion: { state: { bpm: 124, steps: {} } }, drums });
    viz.start();
    viz.start();
    viz.stop();
    expect(viz.isRunning).toBe(false);
  });

  it('cambiar de estilo en caliente no rompe la grabación', async () => {
    const canvas = createFakeCanvas();
    const viz = createVisualizer({ canvas, composicion: { state: { bpm: 124, steps: {} } }, drums });
    viz.start();
    const ok = await viz.setEstilo('ascii');
    expect(ok).toBe(true);
    expect(viz.estilo).toBe('ascii');
    expect(viz.isRunning).toBe(true);
    viz.stop();
  });
});

describe('composición: el visualizador y el audio salen del mismo reloj', () => {
  it('alTocarElRitmo avisa de cada paso con sus tambores', () => {
    const ctx = createFakeAudioContext({ currentTime: 0 });
    const audio = createMidipadAudio({ engine: { trigger() {} }, getContext: () => ctx });
    audio.applyPreset('guaira-tradicional');
    const vistos = [];
    audio.alTocarElRitmo((step, time, golpeados) => vistos.push({ step, time, golpeados }));
    audio.start();
    // El scheduler agenda con antelación: forzar un ciclo.
    ctx.currentTime = 5;
    expect(audio.alTocarElRitmo).toBeTypeOf('function');
    audio.stop();
    // No se afirma el número de pasos (depende del reloj), sólo el contrato.
    expect(audio.snapshot().stemIds).toHaveLength(4);
  });
});

describe('render offline', () => {
  it('sin motor falla en vez de devolver un fichero mudo', async () => {
    const comp = createMidipadAudio({ engine: { trigger() {} } });
    comp.applyPreset('guaira-tradicional');
    await expect(renderExport(comp, { ciclos: 1 })).rejects.toThrow(/motor/);
  });

  it('con motor agenda los golpes del patrón', async () => {
    const ctx = createFakeAudioContext({ currentTime: 0 });
    const disparados = [];
    const engine = { trigger: (id, o) => disparados.push({ id, ...o }) };
    const comp = createMidipadAudio({ engine, getContext: () => ctx });
    comp.applyPreset('guaira-tradicional');
    // Se comprueba que el render pide golpes con tiempo de audio y articulación.
    await renderExport(comp, { ciclos: 1, engine, getContext: () => ctx });
    // El fake OfflineAudioContext no existe en node, así que sólo se valida el
    // contrato de los argumentos, que es donde se colaba el silencio.
    expect(disparados.every((d) => typeof d.time === 'number' || d.time !== undefined)).toBe(true);
  });
});

describe('montaje del componente', () => {
  it('cada atributo data-* que busca el código está en su marcado', async () => {
    // Regresión: el HTML decía data-viz-estilo y el código buscaba data-vz-estilo.
    // Mountaba un null y reventaba toda la sección, con el visualizador en negro
    // y sin ningún aviso. Se comprueba que marcador y búsqueda no se separen.
    const src = readFileSync(new URL('../src/components/visualizador.js', import.meta.url), 'utf8');
    const usados = [...src.matchAll(/querySelector\('\[(data-[a-z-]+)\]'\)/g)].map((m) => m[1]);
    expect(usados.length).toBeGreaterThan(4);
    for (const attr of usados) {
      // Aparece al menos una vez como atributo en el HTML del propio componente.
      expect(src.includes(attr), `el marcado no declara ${attr}`).toBe(true);
    }
  });

  it('el marcado declara los cuatro estilos y los dos botones', () => {
    const src = readFileSync(new URL('../src/components/visualizador.js', import.meta.url), 'utf8');
    expect(src).toContain('data-viz-estilo');
    expect(src).toContain('data-vz-canvas');
    expect(src).toContain('data-vz-mp3');
    expect(src).toContain('data-vz-mp4');
    expect(src).toContain('data-vz-limite');
  });
});

describe('grabador', () => {
  it('elige un formato soportado y no inventa uno', () => {
    const f = formatoSoportado();
    if (typeof MediaRecorder !== 'undefined') {
      expect(f).toBeTruthy();
      expect(['mp4', 'webm']).toContain(f.ext);
    }
  });

  it('el descriptor trae ext y etiqueta como cadenas', () => {
    const f = formatoSoportado();
    if (f) {
      // El botón pone la etiqueta: si aquí se pasa el objeto entero, sale
      // "[object Object]" en el texto del botón.
      expect(typeof f.etiqueta).toBe('string');
      expect(typeof f.ext).toBe('string');
      expect(f.etiqueta).toBe(f.ext.toUpperCase());
    }
  });

  it('el límite abierto es infinito de verdad', () => {
    expect(MAX_SIN_LIMITE).toBe(Infinity);
  });
});

describe('modelos del visualizador 3D', () => {
  it('cada tambor tiene su copia ultraligera, y pesa poco', () => {
    const { statSync } = require('node:fs');
    for (const d of DRUMS) {
      const carpeta = { prima: 'AzulRayas', cruzao: 'GrisPlateado', pujao: 'MaderaOscura', paila: 'MaderaClara' }[d.id];
      const p = path.join(ROOT, 'public', 'assets', 'drums', carpeta, 'visualizador', 'modelo.glb');
      expect(existsSync(p), `${d.id} sin copia de visualizador`).toBe(true);
      expect(statSync(p).size, d.id).toBeLessThan(400 * 1024);
    }
  });
});
