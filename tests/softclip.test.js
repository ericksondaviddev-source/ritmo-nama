import { describe, expect, it } from 'vitest';
import { curvaSoftClip } from '../src/core/audio/softclip.js';
import { createFakeAudioContext } from './fakes/fake-audio-context.js';
import { createDrumEngine } from '../src/core/audio/drum-engine.js';

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

describe('la reverb no esquiva el tope', () => {
  // Regresión: la cola de reverb iba en paralelo DIRECTAMENTE al destino,
  // saltándose el compresor y el soft clip. Se midió un pico de 1,01-1,05 en el
  // render exportado, o sea muestras ya recortadas. Aquí se comprueba el orden
  // del grafo del master: todo debe pasar por la curva antes de llegar al
  // destino, y la reverb debe entrar ANTES del limitador, no después.
  function construir() {
    const ctx = createFakeAudioContext();
    const engine = createDrumEngine(() => ctx);
    engine.trigger('prima', { time: 0, context: ctx });
    return ctx;
  }

  it('sólo un nodo se conecta al destino', () => {
    const ctx = construir();
    const alDestino = ctx.nodos.filter((n) => n.connections.includes(ctx.destination));
    expect(alDestino.length).toBe(1);
  });

  it('ese nodo final es el soft clip, con curva aplicada', () => {
    const ctx = construir();
    const [final] = ctx.nodos.filter((n) => n.connections.includes(ctx.destination));
    expect(final.type).toBe('waveshaper');
    expect(final.curve).toBeTruthy();
    expect(final.curve.length).toBeGreaterThan(1024);
  });

  it('la reverb se suma antes del limitador, no en paralelo al destino', () => {
    const ctx = construir();
    const convolver = ctx.nodos.find((n) => n.type === 'convolver');
    expect(convolver).toBeTruthy();
    // Ninguna conexión de la reverb puede saltar al destino: la cola tiene que
    // pasar por la suma y de ahí al limitador y al soft clip.
    for (const destino of convolver.connections) {
      expect(destino.type, 'la reverb salta el limitador').toBe('gain');
      expect(destino.connections.includes(ctx.destination), 'la reverb llega directa al destino').toBe(false);
      // Y desde ahí se llega al soft clip en algún punto del camino.
      const alcanza = (nodo, tipo, Prof = 0) => {
        if (Prof > 6) return false;
        if (nodo.type === tipo) return true;
        return nodo.connections.some((c) => alcanza(c, tipo, Prof + 1));
      };
      expect(alcanza(destino, 'waveshaper'), 'la reverb no pasa por el soft clip').toBe(true);
    }
  });
});
